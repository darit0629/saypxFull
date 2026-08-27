const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const QRCode = require('qrcode');
const db = require('./albumsDb');
const { processAlbumImage, copyImageToNewAlbum, deleteAlbumImageFiles, deleteAlbumDir, ALBUMS_DIR } = require('./albumProcessing');

// The real production domain, per the requirement to never hardcode a fake
// one - overridable via env for local testing against a different port.
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://saypx.in';

function publicAlbumUrl(code) {
  return `${PUBLIC_BASE_URL}/album/${code}`;
}

const TMP_DIR = path.join(__dirname, '..', '.uploads-tmp');
fs.mkdirSync(TMP_DIR, { recursive: true });
const upload = multer({
  dest: TMP_DIR,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  },
});

// Separate instance for background music - the image multer above only
// accepts image/* and isn't reusable here.
const uploadAudio = multer({
  dest: TMP_DIR,
  limits: { fileSize: 30 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^audio\//.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only audio files are allowed'));
  },
});

// Excludes visually-ambiguous characters (0/O, 1/I/l) so codes are easy to
// type correctly from a printed QR card.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

function uniqueCode() {
  const existing = db.prepare('SELECT 1 FROM digital_albums WHERE public_code = ?');
  let code;
  do {
    code = generateCode();
  } while (existing.get(code));
  return code;
}

function logAudit(albumId, action, detail) {
  db.prepare('INSERT INTO digital_album_audit_log (album_id, action, detail) VALUES (?, ?, ?)').run(
    albumId,
    action,
    detail ? JSON.stringify(detail) : null
  );
}

function serializeAlbum(row) {
  const pageCount = db
    .prepare('SELECT COUNT(*) AS n FROM digital_album_pages WHERE album_id = ?')
    .get(row.id).n;
  const digitalPageCount = row.page_mode === 'FULL_SPREAD' ? pageCount * 2 : pageCount;

  // List/card views need a thumbnail without fetching the full album - use
  // the explicit cover if set, otherwise fall back to the first page (same
  // fallback the public viewer itself uses when no cover has been chosen).
  let coverThumbnail = null;
  if (row.cover_image_id) {
    const img = db.prepare('SELECT thumbnail_path FROM digital_album_images WHERE id = ?').get(row.cover_image_id);
    coverThumbnail = img ? img.thumbnail_path : null;
  }
  if (!coverThumbnail) {
    const first = db
      .prepare(
        `SELECT i.thumbnail_path FROM digital_album_pages p
         JOIN digital_album_images i ON i.id = p.image_id
         WHERE p.album_id = ? ORDER BY p.sort_order ASC LIMIT 1`
      )
      .get(row.id);
    coverThumbnail = first ? first.thumbnail_path : null;
  }

  return {
    ...row,
    allow_download: !!row.allow_download,
    allow_share: !!row.allow_share,
    sound_enabled: !!row.sound_enabled,
    watermark_enabled: !!row.watermark_enabled,
    compress_images: !!row.compress_images,
    spread_count: row.page_mode === 'FULL_SPREAD' ? pageCount : null,
    page_count: digitalPageCount,
    public_url: publicAlbumUrl(row.public_code),
    cover_thumbnail: coverThumbnail,
  };
}

function buildRouter() {
  const express = require('express');
  const router = express.Router();

  router.get('/', (req, res) => {
    const { status, search, sort, customerId } = req.query;
    let sql = 'SELECT * FROM digital_albums WHERE 1=1';
    const params = [];
    if (customerId) {
      sql += ' AND customer_id = ?';
      params.push(customerId);
    }
    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(status.toUpperCase());
    } else {
      sql += " AND status != 'ARCHIVED'";
    }
    if (search) {
      sql += ' AND (title LIKE ? OR client_name LIKE ? OR event_type LIKE ? OR public_code LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    const sortMap = {
      newest: 'created_at DESC',
      oldest: 'created_at ASC',
      updated: 'updated_at DESC',
      name_asc: 'title ASC',
      name_desc: 'title DESC',
      views: 'view_count DESC',
    };
    sql += ` ORDER BY ${sortMap[sort] || sortMap.newest}`;

    const rows = db.prepare(sql).all(...params);
    res.json(rows.map(serializeAlbum));
  });

  router.get('/:id', (req, res) => {
    const row = db.prepare('SELECT * FROM digital_albums WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Album not found' });
    const pages = db
      .prepare(
        `SELECT p.*, i.thumbnail_path, i.display_path, i.width, i.height, i.center_x_pct
         FROM digital_album_pages p JOIN digital_album_images i ON i.id = p.image_id
         WHERE p.album_id = ? ORDER BY p.sort_order ASC`
      )
      .all(req.params.id);
    const getImage = (id) => (id ? db.prepare('SELECT id, thumbnail_path, display_path FROM digital_album_images WHERE id = ?').get(id) : null);
    res.json({
      ...serializeAlbum(row),
      pages,
      coverImage: getImage(row.cover_image_id),
      backCoverImage: getImage(row.back_cover_image_id),
    });
  });

  // format=png (default, for on-screen display/download) or format=svg
  // (preferred for physical print quality in the album/thank-you card).
  router.get('/:id/qr', async (req, res) => {
    try {
      const album = db.prepare('SELECT public_code FROM digital_albums WHERE id = ?').get(req.params.id);
      if (!album) return res.status(404).json({ error: 'Album not found' });
      const url = publicAlbumUrl(album.public_code);

      if (req.query.format === 'svg') {
        const svg = await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'H', margin: 2 });
        res.setHeader('Content-Type', 'image/svg+xml');
        return res.send(svg);
      }
      const png = await QRCode.toBuffer(url, { type: 'png', errorCorrectionLevel: 'H', margin: 2, width: 800 });
      res.setHeader('Content-Type', 'image/png');
      res.send(png);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/', (req, res) => {
    const { title, clientName, eventType, eventDate, photographerName, description, pageMode, compressImages, customerId, packageId } = req.body || {};
    if (!title || !title.trim()) return res.status(400).json({ error: 'Album name is required' });

    const code = uniqueCode();
    const result = db
      .prepare(
        `INSERT INTO digital_albums (title, client_name, event_type, event_date, photographer_name, description, public_code, page_mode, compress_images, customer_id, package_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        title.trim(),
        clientName || null,
        eventType || null,
        eventDate || null,
        photographerName || null,
        description || null,
        code,
        pageMode === 'FULL_SPREAD' ? 'FULL_SPREAD' : 'SINGLE_PAGE',
        compressImages === false ? 0 : 1,
        customerId || null,
        packageId || null
      );

    logAudit(result.lastInsertRowid, 'album_created', { title });
    const row = db.prepare('SELECT * FROM digital_albums WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(serializeAlbum(row));
  });

  router.patch('/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM digital_albums WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Album not found' });

    const allowed = [
      'title', 'client_name', 'event_type', 'event_date', 'photographer_name', 'description',
      'bride_name', 'groom_name', 'venue', 'location', 'custom_message',
      'cover_image_id', 'back_cover_image_id', 'allow_download', 'allow_share',
      'sound_enabled', 'watermark_enabled', 'watermark_json', 'status', 'compress_images',
      'audio_mode', 'music_volume', 'music_loop', 'loading_tagline',
    ];
    const fields = [];
    const params = [];
    for (const key of allowed) {
      const bodyKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      if (req.body && Object.prototype.hasOwnProperty.call(req.body, bodyKey)) {
        fields.push(`${key} = ?`);
        const val = req.body[bodyKey];
        params.push(typeof val === 'boolean' ? (val ? 1 : 0) : val);
      }
    }
    if (req.body?.status === 'PUBLISHED' && existing.status !== 'PUBLISHED') {
      const pageCount = db.prepare('SELECT COUNT(*) AS n FROM digital_album_pages WHERE album_id = ?').get(existing.id).n;
      if (pageCount === 0) return res.status(400).json({ error: 'Add at least one page before publishing' });
      fields.push('published_at = ?');
      params.push(Date.now());
    }
    if (fields.length === 0) return res.json(serializeAlbum(existing));

    fields.push('updated_at = ?');
    params.push(Date.now());
    params.push(req.params.id);
    db.prepare(`UPDATE digital_albums SET ${fields.join(', ')} WHERE id = ?`).run(...params);

    if (req.body?.status) logAudit(req.params.id, `status_${req.body.status.toLowerCase()}`, null);

    const row = db.prepare('SELECT * FROM digital_albums WHERE id = ?').get(req.params.id);
    res.json(serializeAlbum(row));
  });

  router.delete('/:id', (req, res) => {
    const existing = db.prepare('SELECT * FROM digital_albums WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Album not found' });
    db.prepare('DELETE FROM digital_albums WHERE id = ?').run(req.params.id);
    deleteAlbumDir(req.params.id);
    res.json({ ok: true });
  });

  router.post('/:id/duplicate', (req, res) => {
    const existing = db.prepare('SELECT * FROM digital_albums WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Album not found' });

    const code = uniqueCode();
    const result = db
      .prepare(
        `INSERT INTO digital_albums (title, client_name, event_type, event_date, photographer_name, description,
           bride_name, groom_name, venue, location, custom_message, public_code, page_mode,
           allow_download, allow_share, sound_enabled, watermark_enabled, watermark_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        existing.title + ' (Copy)', existing.client_name, existing.event_type, existing.event_date,
        existing.photographer_name, existing.description, existing.bride_name, existing.groom_name,
        existing.venue, existing.location, existing.custom_message, code, existing.page_mode,
        existing.allow_download, existing.allow_share, existing.sound_enabled, existing.watermark_enabled,
        existing.watermark_json
      );
    const newAlbumId = result.lastInsertRowid;

    const pages = db.prepare('SELECT * FROM digital_album_pages WHERE album_id = ? ORDER BY sort_order').all(req.params.id);
    for (const p of pages) {
      const img = db.prepare('SELECT * FROM digital_album_images WHERE id = ?').get(p.image_id);
      // Real independent file copies - the duplicate must not share files
      // with the source album, since either one can be deleted separately.
      const copied = copyImageToNewAlbum(newAlbumId, img);
      const imgResult = db
        .prepare(
          `INSERT INTO digital_album_images (album_id, original_path, display_path, thumbnail_path, width, height, mime_type, file_size, center_x_pct)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(newAlbumId, copied.original_path, copied.display_path, copied.thumbnail_path, img.width, img.height, img.mime_type, img.file_size, img.center_x_pct);
      db.prepare(
        'INSERT INTO digital_album_pages (album_id, page_number, spread_number, sort_order, image_id) VALUES (?, ?, ?, ?, ?)'
      ).run(newAlbumId, p.page_number, p.spread_number, p.sort_order, imgResult.lastInsertRowid);
    }

    logAudit(newAlbumId, 'album_duplicated', { fromAlbumId: existing.id });
    const row = db.prepare('SELECT * FROM digital_albums WHERE id = ?').get(newAlbumId);
    res.status(201).json(serializeAlbum(row));
  });

  // Reassigns page_number/spread_number sequentially from current sort_order -
  // called after any insert/delete/reorder so numbering never has gaps.
  function renumberPages(albumId, pageMode) {
    const pages = db.prepare('SELECT id FROM digital_album_pages WHERE album_id = ? ORDER BY sort_order ASC').all(albumId);
    const stmt = db.prepare('UPDATE digital_album_pages SET page_number = ?, spread_number = ?, updated_at = ? WHERE id = ?');
    pages.forEach((p, i) => {
      const n = i + 1;
      stmt.run(n, pageMode === 'FULL_SPREAD' ? n : null, Date.now(), p.id);
    });
  }

  router.post('/:id/pages', upload.single('file'), async (req, res) => {
    const cleanup = () => { if (req.file) fs.unlink(req.file.path, () => {}); };
    try {
      const album = db.prepare('SELECT * FROM digital_albums WHERE id = ?').get(req.params.id);
      if (!album) { cleanup(); return res.status(404).json({ error: 'Album not found' }); }
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS n FROM digital_album_pages WHERE album_id = ?').get(album.id).n;
      const filenameBase = `page-${Date.now()}-${crypto.randomInt(1e6)}`;
      const processed = await processAlbumImage(album.id, req.file.path, filenameBase, req.file.mimetype, req.file.originalname, !!album.compress_images);

      const imgResult = db
        .prepare(
          `INSERT INTO digital_album_images (album_id, original_path, display_path, thumbnail_path, width, height, mime_type, file_size)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(album.id, processed.originalPath, processed.displayPath, processed.thumbnailPath, processed.width, processed.height, processed.mimeType, req.file.size);

      const pageResult = db
        .prepare('INSERT INTO digital_album_pages (album_id, page_number, spread_number, sort_order, image_id) VALUES (?, 0, NULL, ?, ?)')
        .run(album.id, maxOrder + 1, imgResult.lastInsertRowid);

      renumberPages(album.id, album.page_mode);
      db.prepare('UPDATE digital_albums SET updated_at = ? WHERE id = ?').run(Date.now(), album.id);
      cleanup();

      const page = db
        .prepare(
          `SELECT p.*, i.thumbnail_path, i.display_path, i.width, i.height, i.center_x_pct
           FROM digital_album_pages p JOIN digital_album_images i ON i.id = p.image_id WHERE p.id = ?`
        )
        .get(pageResult.lastInsertRowid);
      res.status(201).json(page);
    } catch (e) {
      cleanup();
      res.status(500).json({ error: e.message });
    }
  });

  router.patch('/:id/pages/reorder', (req, res) => {
    try {
      const album = db.prepare('SELECT * FROM digital_albums WHERE id = ?').get(req.params.id);
      if (!album) return res.status(404).json({ error: 'Album not found' });
      const { pageIds } = req.body || {};
      if (!Array.isArray(pageIds) || pageIds.length === 0) return res.status(400).json({ error: 'pageIds array is required' });

      const stmt = db.prepare('UPDATE digital_album_pages SET sort_order = ?, updated_at = ? WHERE id = ? AND album_id = ?');
      const tx = db.transaction(() => {
        pageIds.forEach((id, i) => stmt.run(i, Date.now(), id, album.id));
        renumberPages(album.id, album.page_mode);
      });
      tx();
      logAudit(album.id, 'pages_reordered', null);
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/:id/pages/:pageId/replace', upload.single('file'), async (req, res) => {
    const cleanup = () => { if (req.file) fs.unlink(req.file.path, () => {}); };
    try {
      const page = db.prepare('SELECT * FROM digital_album_pages WHERE id = ? AND album_id = ?').get(req.params.pageId, req.params.id);
      if (!page) { cleanup(); return res.status(404).json({ error: 'Page not found' }); }
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const album = db.prepare('SELECT compress_images FROM digital_albums WHERE id = ?').get(req.params.id);
      const oldImage = db.prepare('SELECT * FROM digital_album_images WHERE id = ?').get(page.image_id);
      const filenameBase = `page-${Date.now()}-${crypto.randomInt(1e6)}`;
      const processed = await processAlbumImage(req.params.id, req.file.path, filenameBase, req.file.mimetype, req.file.originalname, !!album?.compress_images);

      db.prepare(
        `UPDATE digital_album_images SET original_path=?, display_path=?, thumbnail_path=?, width=?, height=?, mime_type=?, file_size=?, center_x_pct=50
         WHERE id = ?`
      ).run(processed.originalPath, processed.displayPath, processed.thumbnailPath, processed.width, processed.height, processed.mimeType, req.file.size, page.image_id);

      deleteAlbumImageFiles(oldImage);
      db.prepare('UPDATE digital_album_pages SET updated_at = ? WHERE id = ?').run(Date.now(), page.id);
      cleanup();
      logAudit(req.params.id, 'page_replaced', { pageId: page.id });
      res.json({ ok: true });
    } catch (e) {
      cleanup();
      res.status(500).json({ error: e.message });
    }
  });

  router.post('/:id/pages/:pageId/duplicate', (req, res) => {
    try {
      const page = db.prepare('SELECT * FROM digital_album_pages WHERE id = ? AND album_id = ?').get(req.params.pageId, req.params.id);
      if (!page) return res.status(404).json({ error: 'Page not found' });
      const album = db.prepare('SELECT page_mode FROM digital_albums WHERE id = ?').get(req.params.id);
      const img = db.prepare('SELECT * FROM digital_album_images WHERE id = ?').get(page.image_id);

      const copied = copyImageToNewAlbum(req.params.id, img);
      const imgResult = db
        .prepare(
          `INSERT INTO digital_album_images (album_id, original_path, display_path, thumbnail_path, width, height, mime_type, file_size, center_x_pct)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(req.params.id, copied.original_path, copied.display_path, copied.thumbnail_path, img.width, img.height, img.mime_type, img.file_size, img.center_x_pct);

      const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS n FROM digital_album_pages WHERE album_id = ?').get(req.params.id).n;
      db.prepare('INSERT INTO digital_album_pages (album_id, page_number, spread_number, sort_order, image_id) VALUES (?, 0, NULL, ?, ?)')
        .run(req.params.id, maxOrder + 1, imgResult.lastInsertRowid);

      renumberPages(req.params.id, album.page_mode);
      res.status(201).json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  router.delete('/:id/pages/:pageId', (req, res) => {
    try {
      const page = db.prepare('SELECT * FROM digital_album_pages WHERE id = ? AND album_id = ?').get(req.params.pageId, req.params.id);
      if (!page) return res.status(404).json({ error: 'Page not found' });
      const album = db.prepare('SELECT page_mode FROM digital_albums WHERE id = ?').get(req.params.id);
      const img = db.prepare('SELECT * FROM digital_album_images WHERE id = ?').get(page.image_id);

      db.prepare('DELETE FROM digital_album_pages WHERE id = ?').run(page.id);
      db.prepare('DELETE FROM digital_album_images WHERE id = ?').run(img.id);
      deleteAlbumImageFiles(img);
      renumberPages(req.params.id, album.page_mode);
      // Compare against the deleted page's image_id, not its page id -
      // cover_image_id/back_cover_image_id always reference an image row.
      db.prepare(
        'UPDATE digital_albums SET cover_image_id = CASE WHEN cover_image_id = ? THEN NULL ELSE cover_image_id END, back_cover_image_id = CASE WHEN back_cover_image_id = ? THEN NULL ELSE back_cover_image_id END WHERE id = ?'
      ).run(img.id, img.id, req.params.id);
      logAudit(req.params.id, 'page_deleted', { pageId: page.id });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // Uploads a cover/back-cover image that is NOT one of the numbered
  // interior pages (addendum option "dedicated cover JPG"). The image row
  // is created but never inserted into digital_album_pages.
  function buildCoverUploadHandler(column) {
    return async (req, res) => {
      const cleanup = () => { if (req.file) fs.unlink(req.file.path, () => {}); };
      try {
        const album = db.prepare('SELECT * FROM digital_albums WHERE id = ?').get(req.params.id);
        if (!album) { cleanup(); return res.status(404).json({ error: 'Album not found' }); }
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const filenameBase = `${column}-${Date.now()}-${crypto.randomInt(1e6)}`;
        const processed = await processAlbumImage(album.id, req.file.path, filenameBase, req.file.mimetype, req.file.originalname, !!album.compress_images);
        const imgResult = db
          .prepare(
            `INSERT INTO digital_album_images (album_id, original_path, display_path, thumbnail_path, width, height, mime_type, file_size)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(album.id, processed.originalPath, processed.displayPath, processed.thumbnailPath, processed.width, processed.height, processed.mimeType, req.file.size);

        db.prepare(`UPDATE digital_albums SET ${column} = ?, updated_at = ? WHERE id = ?`).run(imgResult.lastInsertRowid, Date.now(), album.id);
        cleanup();
        logAudit(album.id, `${column}_uploaded`, null);
        res.status(201).json({ ok: true, imageId: imgResult.lastInsertRowid });
      } catch (e) {
        cleanup();
        res.status(500).json({ error: e.message });
      }
    };
  }
  router.post('/:id/cover', upload.single('file'), buildCoverUploadHandler('cover_image_id'));
  router.post('/:id/back-cover', upload.single('file'), buildCoverUploadHandler('back_cover_image_id'));

  // Background music - no original/display/thumbnail triad needed like
  // images get; just a straight validated file copy under albums/<id>/audio/,
  // auto-served by the site's existing blanket static mount (same as the
  // image folders already are).
  router.post('/:id/music', uploadAudio.single('file'), async (req, res) => {
    const cleanup = () => { if (req.file) fs.unlink(req.file.path, () => {}); };
    try {
      const album = db.prepare('SELECT id FROM digital_albums WHERE id = ?').get(req.params.id);
      if (!album) { cleanup(); return res.status(404).json({ error: 'Album not found' }); }
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const audioDir = path.join(ALBUMS_DIR, String(album.id), 'audio');
      fs.mkdirSync(audioDir, { recursive: true });
      const ext = path.extname(req.file.originalname) || '.mp3';
      const filename = `music-${Date.now()}-${crypto.randomInt(1e6)}${ext}`;
      const destPath = path.join(audioDir, filename);
      fs.copyFileSync(req.file.path, destPath);
      cleanup();

      const relPath = `albums/${album.id}/audio/${filename}`;
      db.prepare('UPDATE digital_albums SET background_music_path = ?, updated_at = ? WHERE id = ?').run(relPath, Date.now(), album.id);
      logAudit(album.id, 'music_uploaded', { filename });
      res.status(201).json({ ok: true, path: relPath });
    } catch (e) {
      cleanup();
      res.status(500).json({ error: e.message });
    }
  });

  router.delete('/:id/music', (req, res) => {
    const album = db.prepare('SELECT background_music_path FROM digital_albums WHERE id = ?').get(req.params.id);
    if (!album) return res.status(404).json({ error: 'Album not found' });
    if (album.background_music_path) {
      fs.unlink(path.join(__dirname, '..', album.background_music_path), () => {});
    }
    db.prepare("UPDATE digital_albums SET background_music_path = NULL, updated_at = ? WHERE id = ?").run(Date.now(), req.params.id);
    res.json({ ok: true });
  });

  // Brand logo shown on the public loading screen in place of the default
  // SAYPX wordmark. Like music, a straight validated copy - no
  // original/display/thumbnail triad needed since it's never a page.
  router.post('/:id/logo', upload.single('file'), async (req, res) => {
    const cleanup = () => { if (req.file) fs.unlink(req.file.path, () => {}); };
    try {
      const album = db.prepare('SELECT id, logo_path FROM digital_albums WHERE id = ?').get(req.params.id);
      if (!album) { cleanup(); return res.status(404).json({ error: 'Album not found' }); }
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const logoDir = path.join(ALBUMS_DIR, String(album.id), 'logo');
      fs.mkdirSync(logoDir, { recursive: true });
      const ext = path.extname(req.file.originalname) || '.png';
      const filename = `logo-${Date.now()}-${crypto.randomInt(1e6)}${ext}`;
      const destPath = path.join(logoDir, filename);
      fs.copyFileSync(req.file.path, destPath);
      cleanup();

      if (album.logo_path) fs.unlink(path.join(__dirname, '..', album.logo_path), () => {});
      const relPath = `albums/${album.id}/logo/${filename}`;
      db.prepare('UPDATE digital_albums SET logo_path = ?, updated_at = ? WHERE id = ?').run(relPath, Date.now(), album.id);
      logAudit(album.id, 'logo_uploaded', { filename });
      res.status(201).json({ ok: true, path: relPath });
    } catch (e) {
      cleanup();
      res.status(500).json({ error: e.message });
    }
  });

  router.delete('/:id/logo', (req, res) => {
    const album = db.prepare('SELECT logo_path FROM digital_albums WHERE id = ?').get(req.params.id);
    if (!album) return res.status(404).json({ error: 'Album not found' });
    if (album.logo_path) fs.unlink(path.join(__dirname, '..', album.logo_path), () => {});
    db.prepare('UPDATE digital_albums SET logo_path = NULL, updated_at = ? WHERE id = ?').run(Date.now(), req.params.id);
    res.json({ ok: true });
  });

  // Manual center-fold adjustment for a Full Spread image whose exported
  // canvas is slightly off-center - the image itself is never touched.
  router.patch('/:id/images/:imageId/center', (req, res) => {
    try {
      const img = db.prepare('SELECT * FROM digital_album_images WHERE id = ? AND album_id = ?').get(req.params.imageId, req.params.id);
      if (!img) return res.status(404).json({ error: 'Image not found' });
      const pct = Number(req.body?.centerXPct);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) return res.status(400).json({ error: 'centerXPct must be 0-100' });
      db.prepare('UPDATE digital_album_images SET center_x_pct = ? WHERE id = ?').run(pct, img.id);
      res.json({ ok: true, centerXPct: pct });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}

module.exports = { buildRouter, serializeAlbum, logAudit, uniqueCode };
