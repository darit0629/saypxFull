const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const {
  isWebsiteConfigured,
  getPortfolio,
  uploadPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  listAlbums,
  getAlbum,
  createAlbum,
  updateAlbum,
  deleteAlbum,
  duplicateAlbum,
  uploadAlbumPage,
  reorderAlbumPages,
  replaceAlbumPage,
  duplicateAlbumPage,
  deleteAlbumPage,
  uploadAlbumCover,
  setImageCenter,
  getAlbumQr,
} = require('../lib/websiteProxy');

const router = express.Router();

const TMP_DIR = path.join(__dirname, '..', 'uploads', 'website-tmp');
fs.mkdirSync(TMP_DIR, { recursive: true });
const upload = multer({
  dest: TMP_DIR,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype) || /^video\//.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only image or video files are allowed'));
  },
});

router.use((req, res, next) => {
  if (!isWebsiteConfigured()) return res.status(503).json({ error: 'Website integration is not configured' });
  next();
});

router.get('/portfolio', async (req, res) => {
  try {
    res.json(await getPortfolio());
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/portfolio', upload.single('file'), async (req, res) => {
  const cleanup = () => { if (req.file) fs.unlink(req.file.path, () => {}); };
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const result = await uploadPortfolioItem(req.body, req.file);
    cleanup();
    res.json(result);
  } catch (e) {
    cleanup();
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.put('/portfolio/:index', async (req, res) => {
  try {
    res.json(await updatePortfolioItem(req.params.index, req.body));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.delete('/portfolio/:index', async (req, res) => {
  try {
    res.json(await deletePortfolioItem(req.params.index));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// ---- Digital Photo Book albums ----
router.get('/albums', async (req, res) => {
  try {
    res.json(await listAlbums(req.query));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.get('/albums/:id', async (req, res) => {
  try {
    res.json(await getAlbum(req.params.id));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/albums', async (req, res) => {
  try {
    res.status(201).json(await createAlbum(req.body));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.patch('/albums/:id', async (req, res) => {
  try {
    res.json(await updateAlbum(req.params.id, req.body));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.delete('/albums/:id', async (req, res) => {
  try {
    res.json(await deleteAlbum(req.params.id));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/albums/:id/duplicate', async (req, res) => {
  try {
    res.status(201).json(await duplicateAlbum(req.params.id));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/albums/:id/pages', upload.single('file'), async (req, res) => {
  const cleanup = () => { if (req.file) fs.unlink(req.file.path, () => {}); };
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const result = await uploadAlbumPage(req.params.id, req.file);
    cleanup();
    res.status(201).json(result);
  } catch (e) {
    cleanup();
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.patch('/albums/:id/pages/reorder', async (req, res) => {
  try {
    res.json(await reorderAlbumPages(req.params.id, req.body?.pageIds));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/albums/:id/pages/:pageId/replace', upload.single('file'), async (req, res) => {
  const cleanup = () => { if (req.file) fs.unlink(req.file.path, () => {}); };
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const result = await replaceAlbumPage(req.params.id, req.params.pageId, req.file);
    cleanup();
    res.json(result);
  } catch (e) {
    cleanup();
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/albums/:id/pages/:pageId/duplicate', async (req, res) => {
  try {
    res.status(201).json(await duplicateAlbumPage(req.params.id, req.params.pageId));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.delete('/albums/:id/pages/:pageId', async (req, res) => {
  try {
    res.json(await deleteAlbumPage(req.params.id, req.params.pageId));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/albums/:id/cover', upload.single('file'), async (req, res) => {
  const cleanup = () => { if (req.file) fs.unlink(req.file.path, () => {}); };
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const result = await uploadAlbumCover(req.params.id, req.file, 'front');
    cleanup();
    res.status(201).json(result);
  } catch (e) {
    cleanup();
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/albums/:id/back-cover', upload.single('file'), async (req, res) => {
  const cleanup = () => { if (req.file) fs.unlink(req.file.path, () => {}); };
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const result = await uploadAlbumCover(req.params.id, req.file, 'back');
    cleanup();
    res.status(201).json(result);
  } catch (e) {
    cleanup();
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.patch('/albums/:id/images/:imageId/center', async (req, res) => {
  try {
    res.json(await setImageCenter(req.params.id, req.params.imageId, req.body?.centerXPct));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.get('/albums/:id/qr', async (req, res) => {
  try {
    const { buffer, contentType } = await getAlbumQr(req.params.id, req.query.format);
    res.setHeader('Content-Type', contentType);
    res.send(buffer);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

module.exports = router;
