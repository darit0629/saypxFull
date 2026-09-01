require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieSession = require('cookie-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');

const { slugify, uniqueSlug, processImage, processVideo } = require('./lib/mediaProcessing');
const { readItems, writeItems, existingSlugSet } = require('./lib/portfolioStore');
const { bumpCacheVersion, getCategoryMap, addFilterButton } = require('./lib/siteHtml');
const mediaStorageService = require('./lib/mediaStorageService');

const PORT = parseInt(process.argv[2] || process.env.PORT || '5000', 10);
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH || !SESSION_SECRET) {
  console.error('Missing ADMIN_USERNAME / ADMIN_PASSWORD_HASH / SESSION_SECRET in .env - admin panel disabled.');
}

const app = express();
app.disable('x-powered-by');

app.use(cookieSession({
  name: 'saypx_admin_session',
  keys: [SESSION_SECRET || 'insecure-fallback-secret-change-me'],
  maxAge: 12 * 60 * 60 * 1000,
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV !== 'development'
}));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ---- Simple in-memory login rate limiting ----
const loginAttempts = new Map(); // ip -> { count, lockedUntil }
function isLockedOut(ip) {
  const rec = loginAttempts.get(ip);
  return rec && rec.lockedUntil && rec.lockedUntil > Date.now();
}
function recordFailedLogin(ip) {
  const rec = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  rec.count++;
  if (rec.count >= 5) {
    rec.lockedUntil = Date.now() + 10 * 60 * 1000;
    rec.count = 0;
  }
  loginAttempts.set(ip, rec);
}
function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

function requireAuth(req, res, next) {
  // req.originalUrl (not req.path) - app.use(prefix, ...) mounts strip the
  // matched prefix from req.path/req.url for every handler in that layer,
  // not just inside a nested Router, so req.path alone isn't reliable here.
  const fullPath = req.originalUrl.split('?')[0];
  // Lets the separate SAYPX Billing app manage portfolio media server-to-server,
  // without knowing the real admin password (only its bcrypt hash exists on disk).
  // Scoped to /api/ only - the human /admin browser login is unaffected.
  if (
    fullPath.startsWith('/api/') &&
    process.env.INTERNAL_API_TOKEN &&
    req.headers['x-internal-token'] === process.env.INTERNAL_API_TOKEN
  ) {
    return next();
  }
  if (req.session && req.session.authenticated) return next();
  if (fullPath.startsWith('/api/')) return res.status(401).json({ error: 'Not authenticated' });
  return res.redirect('/admin/login');
}

// ---- Admin auth routes ----
app.get('/admin/login', (req, res) => {
  if (req.session && req.session.authenticated) return res.redirect('/admin');
  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});

app.post('/admin/login', (req, res) => {
  const ip = req.ip;
  if (isLockedOut(ip)) {
    return res.redirect('/admin/login?error=locked');
  }
  const { username, password } = req.body;
  const validUser = ADMIN_USERNAME && username === ADMIN_USERNAME;
  const validPass = ADMIN_PASSWORD_HASH && password && bcrypt.compareSync(password, ADMIN_PASSWORD_HASH);
  if (validUser && validPass) {
    clearLoginAttempts(ip);
    req.session.authenticated = true;
    return res.redirect('/admin');
  }
  recordFailedLogin(ip);
  return res.redirect('/admin/login?error=1');
});

app.post('/admin/logout', (req, res) => {
  req.session = null;
  res.redirect('/admin/login');
});

app.get('/admin', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'dashboard.html'));
});

app.use('/admin/assets', requireAuth, express.static(path.join(__dirname, 'admin', 'assets')));

// ---- Uploads (temp storage, processed then discarded) ----
const TMP_DIR = path.join(__dirname, '.uploads-tmp');
fs.mkdirSync(TMP_DIR, { recursive: true });
const upload = multer({
  dest: TMP_DIR,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype) || /^video\//.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only image or video files are allowed'));
  }
});

// ---- Portfolio API ----
app.get('/api/admin/portfolio', requireAuth, (req, res) => {
  try {
    const items = readItems();
    const categories = getCategoryMap();
    const withIndex = items.map((item, index) => ({ ...item, _index: index }));
    res.json({ items: withIndex, categories });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/portfolio', requireAuth, upload.single('file'), async (req, res) => {
  const cleanup = () => { if (req.file) fs.unlink(req.file.path, () => {}); };
  try {
    let { title, subtitle, category, newCategoryLabel } = req.body;
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
    if (!category || !category.trim()) return res.status(400).json({ error: 'Category is required' });

    // Never trust a client-computed slug for a "new category" sentinel -
    // always derive it server-side from the human-entered label.
    if (category.trim() === '__new__' || !getCategoryMap()[category.trim()]) {
      const label = (newCategoryLabel && newCategoryLabel.trim()) || category.trim();
      if (!label || label === '__new__') return res.status(400).json({ error: 'New category name is required' });
      category = slugify(label);
      newCategoryLabel = label;
    }

    const isVideo = /^video\//.test(req.file.mimetype);
    const items = readItems();
    const slugSet = existingSlugSet(items);
    const baseSlug = slugify(title);
    const slug = uniqueSlug(baseSlug, slugSet);

    // New uploads go to object storage when it's configured; if it isn't
    // (e.g. a local dev box without R2 credentials), fall back to the
    // original local-disk layout exactly as before so nothing breaks.
    const useObjectStorage = mediaStorageService.isConfigured();

    let entry;
    if (isVideo) {
      if (useObjectStorage) {
        const tmpVideo = path.join(TMP_DIR, slug + '-' + Date.now() + '.mp4');
        const tmpPoster = path.join(TMP_DIR, slug + '-' + Date.now() + '.jpg');
        const { orientation } = processVideo(req.file.path, tmpVideo, tmpPoster);
        const videoKey = mediaStorageService.generateKey('portfolio/videos', slug + '.mp4');
        const posterKey = mediaStorageService.generateKey('portfolio/posters', slug + '.jpg');
        await mediaStorageService.upload(videoKey, fs.readFileSync(tmpVideo), { contentType: 'video/mp4' });
        await mediaStorageService.upload(posterKey, fs.readFileSync(tmpPoster), { contentType: 'image/jpeg' });
        fs.unlink(tmpVideo, () => {});
        fs.unlink(tmpPoster, () => {});
        entry = {
          category: category.trim(),
          orientation,
          type: 'video',
          video: '/media/' + videoKey,
          poster: '/media/' + posterKey,
          alt: title.trim(),
          placeholderClass: null,
          title: title.trim(),
          subtitle: (subtitle || '').trim() || category.trim()
        };
      } else {
        const destVideo = path.join(__dirname, 'videos', 'portfolio', slug + '.mp4');
        const destPoster = path.join(__dirname, 'videos', 'posters', slug + '.jpg');
        const { orientation } = processVideo(req.file.path, destVideo, destPoster);
        entry = {
          category: category.trim(),
          orientation,
          type: 'video',
          video: 'videos/portfolio/' + slug + '.mp4',
          poster: 'videos/posters/' + slug + '.jpg',
          alt: title.trim(),
          placeholderClass: null,
          title: title.trim(),
          subtitle: (subtitle || '').trim() || category.trim()
        };
      }
    } else if (useObjectStorage) {
      const tmpImage = path.join(TMP_DIR, slug + '-' + Date.now() + '.jpg');
      const tmpThumb = path.join(TMP_DIR, slug + '-' + Date.now() + '-thumb.jpg');
      const { orientation, width, height } = await processImage(req.file.path, tmpImage, tmpThumb);
      const imageKey = mediaStorageService.generateKey('portfolio/images', slug + '.jpg');
      const thumbKey = mediaStorageService.generateKey('portfolio/thumbnails', slug + '.jpg');
      await mediaStorageService.upload(imageKey, fs.readFileSync(tmpImage), { contentType: 'image/jpeg' });
      await mediaStorageService.upload(thumbKey, fs.readFileSync(tmpThumb), { contentType: 'image/jpeg' });
      fs.unlink(tmpImage, () => {});
      fs.unlink(tmpThumb, () => {});
      entry = {
        category: category.trim(),
        orientation,
        width,
        height,
        src: '/media/' + imageKey,
        thumb: '/media/' + thumbKey,
        alt: title.trim(),
        placeholderClass: null,
        title: title.trim(),
        subtitle: (subtitle || '').trim() || category.trim()
      };
    } else {
      const destImage = path.join(__dirname, 'images', 'portfolio', slug + '.jpg');
      const thumbDir = path.join(__dirname, 'images', 'portfolio', 'thumbnails');
      fs.mkdirSync(thumbDir, { recursive: true });
      const destThumb = path.join(thumbDir, slug + '.jpg');
      const { orientation, width, height } = await processImage(req.file.path, destImage, destThumb);
      entry = {
        category: category.trim(),
        orientation,
        width,
        height,
        src: 'images/portfolio/' + slug + '.jpg',
        thumb: 'images/portfolio/thumbnails/' + slug + '.jpg',
        alt: title.trim(),
        placeholderClass: null,
        title: title.trim(),
        subtitle: (subtitle || '').trim() || category.trim()
      };
    }

    items.push(entry);
    writeItems(items);

    // If this is a brand-new category slug, register a filter button for it.
    const knownCategories = getCategoryMap();
    if (!knownCategories[category.trim()]) {
      const label = (newCategoryLabel && newCategoryLabel.trim()) || category.trim();
      addFilterButton(category.trim(), label);
    }

    bumpCacheVersion();
    cleanup();
    res.json({ ok: true, entry });
  } catch (e) {
    cleanup();
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/admin/portfolio/:index', requireAuth, (req, res) => {
  try {
    const idx = parseInt(req.params.index, 10);
    const items = readItems();
    if (!items[idx]) return res.status(404).json({ error: 'Item not found' });
    const { title, subtitle, category } = req.body;
    if (title !== undefined) { items[idx].title = title.trim(); items[idx].alt = title.trim(); }
    if (subtitle !== undefined) items[idx].subtitle = subtitle.trim();
    if (category !== undefined && category.trim()) items[idx].category = category.trim();
    writeItems(items);
    bumpCacheVersion();
    res.json({ ok: true, entry: items[idx] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Deletes one item's files regardless of which storage they live in - an
// R2-backed path ("/media/<key>") needs an actual API delete call, while a
// legacy local path just needs fs.unlink, exactly as this used to work
// before R2 existed.
function deletePortfolioItemFiles(item) {
  for (const p of [item.src, item.thumb, item.video, item.poster]) {
    if (!p) continue;
    if (p.startsWith('/media/')) {
      mediaStorageService.delete(p.slice('/media/'.length)).catch(() => {});
    } else {
      fs.unlink(path.join(__dirname, p), () => {});
    }
  }
}

app.delete('/api/admin/portfolio/:index', requireAuth, (req, res) => {
  try {
    const idx = parseInt(req.params.index, 10);
    const items = readItems();
    const item = items[idx];
    if (!item) return res.status(404).json({ error: 'Item not found' });

    deletePortfolioItemFiles(item);

    items.splice(idx, 1);
    writeItems(items);
    bumpCacheVersion();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- Digital Photo Book admin API ----
app.use('/api/admin/albums', requireAuth, require('./lib/albumRoutes').buildRouter());

// ---- Digital Photo Book public viewer API (no auth - the album's public
// code itself is the access control) ----
app.use('/api/public/digital-albums', require('./lib/publicAlbumRoutes').buildRouter());

// ---- Digital Photo Book public viewer page ----
// /album/:code is the current short link; /a/:code and /digital-album/:code
// are kept working indefinitely since earlier albums' printed QR cards and
// shared links may already point at them.
app.get('/album/:code', (req, res) => {
  res.sendFile(path.join(__dirname, 'digital-album.html'));
});
app.get('/a/:code', (req, res) => {
  res.sendFile(path.join(__dirname, 'digital-album.html'));
});
app.get('/digital-album/:code', (req, res) => {
  res.sendFile(path.join(__dirname, 'digital-album.html'));
});

// The viewer's own JS/CSS get iterated on and re-deployed often, unlike the
// rest of the static site - the default long browser cache on those two
// meant a shipped fix could stay invisible to anyone who'd already loaded
// an album for up to 4 hours. ETag revalidation still keeps repeat loads
// fast; this only forces a freshness check instead of trusting a stale copy.
app.use(['/digital-album.js', '/digital-album.css'], (req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache');
  next();
});

// ---- Object-storage media proxy ----
// Serves objects uploaded to R2 (new Portfolio uploads) at a stable local
// URL instead of a public bucket domain, so private/public access stays a
// server-side decision rather than a whole-bucket setting. Range passthrough
// is what makes video seeking work correctly.
app.get('/media/*', async (req, res) => {
  const key = req.params[0];
  if (!key) return res.status(400).end();
  try {
    const result = await mediaStorageService.downloadStream(key, { range: req.headers.range });
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (result.contentType) res.setHeader('Content-Type', result.contentType);
    if (result.isPartial) {
      res.status(206);
      if (result.contentRange) res.setHeader('Content-Range', result.contentRange);
      res.setHeader('Accept-Ranges', 'bytes');
    } else {
      res.setHeader('Accept-Ranges', 'bytes');
    }
    if (result.contentLength != null) res.setHeader('Content-Length', result.contentLength);
    result.body.pipe(res);
    result.body.on('error', () => res.end());
  } catch (e) {
    if (e.name === 'NoSuchKey' || (e.$metadata && e.$metadata.httpStatusCode === 404)) {
      return res.status(404).end();
    }
    console.error('media proxy error:', e.message);
    res.status(502).end();
  }
});

// ---- Static site (must come after /admin routes) ----
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`SAYPX server running on port ${PORT}`);
});
