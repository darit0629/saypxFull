const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ALBUMS_DIR = path.join(__dirname, '..', 'albums');

function albumDir(albumId) {
  return path.join(ALBUMS_DIR, String(albumId));
}

function ensureAlbumDirs(albumId) {
  const base = albumDir(albumId);
  for (const sub of ['original', 'display', 'thumbnail']) {
    fs.mkdirSync(path.join(base, sub), { recursive: true });
  }
  return base;
}

// Processes one uploaded page/spread image: generates a display-quality
// version (for the viewer) and a small thumbnail (for the admin page
// manager). Returns paths + dimensions for center-fold math.
//
// `compress` controls what happens to the "original" copy (the one used for
// downloads/print, never the viewer itself, which always uses displayPath):
//   - true  (default): re-encode at a large-but-bounded size with a high-
//     quality JPEG encoder instead of storing the raw upload byte-for-byte.
//     A 20-30MB scanned page typically becomes a few MB with no visible
//     quality loss at normal viewing/print sizes - this is what actually
//     saves storage across a hundred-plus-page album.
//   - false: copy the exact uploaded file untouched, for albums where
//     preserving the precise original bytes matters more than storage.
async function processAlbumImage(albumId, srcPath, filenameBase, mimeType, originalFilename, compress = true) {
  const base = ensureAlbumDirs(albumId);
  const ext = '.jpg';
  // multer's temp path has no extension, so derive it from the real uploaded
  // filename instead (falling back to .jpg if that's somehow missing too).
  const srcExt = (originalFilename && path.extname(originalFilename)) || path.extname(srcPath) || '.jpg';
  const originalDest = compress
    ? path.join(base, 'original', filenameBase + ext)
    : path.join(base, 'original', filenameBase + srcExt);
  const displayDest = path.join(base, 'display', filenameBase + ext);
  const thumbDest = path.join(base, 'thumbnail', filenameBase + ext);

  if (compress) {
    await sharp(srcPath)
      .resize({ width: 3500, height: 3500, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 92, mozjpeg: true })
      .toFile(originalDest);
  } else {
    fs.copyFileSync(srcPath, originalDest);
  }

  const meta = await sharp(srcPath).metadata();
  await sharp(srcPath)
    .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 88 })
    .toFile(displayDest);
  await sharp(srcPath)
    .resize({ width: 500, height: 500, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toFile(thumbDest);

  const relBase = `albums/${albumId}`;
  return {
    originalPath: `${relBase}/original/${path.basename(originalDest)}`,
    displayPath: `${relBase}/display/${path.basename(displayDest)}`,
    thumbnailPath: `${relBase}/thumbnail/${path.basename(thumbDest)}`,
    width: meta.width,
    height: meta.height,
    // Compression always re-encodes the original to JPEG regardless of the
    // uploaded format, so the stored mime type must reflect that too.
    mimeType: compress ? 'image/jpeg' : (mimeType || 'image/jpeg'),
  };
}

// Used when duplicating an album - each album owns its own files under
// albums/<id>/, so a duplicate must get real independent copies, not shared
// paths (otherwise deleting one album's directory would corrupt the other's).
function copyImageToNewAlbum(destAlbumId, image) {
  const base = ensureAlbumDirs(destAlbumId);
  const relBase = `albums/${destAlbumId}`;
  const out = {};
  for (const [key, sub] of [['original_path', 'original'], ['display_path', 'display'], ['thumbnail_path', 'thumbnail']]) {
    const srcAbs = path.join(__dirname, '..', image[key]);
    const filename = path.basename(image[key]);
    const destAbs = path.join(base, sub, filename);
    fs.copyFileSync(srcAbs, destAbs);
    out[key] = `${relBase}/${sub}/${filename}`;
  }
  return out;
}

function deleteAlbumImageFiles(image) {
  for (const p of [image.original_path, image.display_path, image.thumbnail_path]) {
    if (p) fs.unlink(path.join(__dirname, '..', p), () => {});
  }
}

function deleteAlbumDir(albumId) {
  fs.rm(albumDir(albumId), { recursive: true, force: true }, () => {});
}

module.exports = { processAlbumImage, copyImageToNewAlbum, deleteAlbumImageFiles, deleteAlbumDir, ALBUMS_DIR };
