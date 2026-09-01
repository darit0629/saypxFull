const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const mediaStorageService = require('./mediaStorageService');

const ALBUMS_DIR = path.join(__dirname, '..', 'albums');
// Same temp dir albumRoutes.js's multer instance uses - defined again here
// (rather than imported) to avoid a circular require between the two files.
const TMP_DIR = path.join(__dirname, '..', '.uploads-tmp');
fs.mkdirSync(TMP_DIR, { recursive: true });

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

// A stored path is either a legacy local-disk relative path ("albums/12/...")
// or a "/media/<key>" reference into object storage - distinguishing the two
// is what lets old and newly-uploaded images keep working side by side
// without a migration pass.
function isMediaPath(p) {
  return typeof p === 'string' && p.startsWith('/media/');
}

function mediaKeyFromPath(p) {
  return p.slice('/media/'.length);
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
  const useObjectStorage = mediaStorageService.isConfigured();
  const ext = '.jpg';
  // multer's temp path has no extension, so derive it from the real uploaded
  // filename instead (falling back to .jpg if that's somehow missing too).
  const srcExt = (originalFilename && path.extname(originalFilename)) || path.extname(srcPath) || '.jpg';
  const originalExt = compress ? ext : srcExt;

  // Object storage renders to a flat scratch dir (bytes get uploaded then
  // discarded); local disk renders straight into the album's own
  // original/display/thumbnail subfolders, exactly as before.
  const base = useObjectStorage ? TMP_DIR : ensureAlbumDirs(albumId);
  const originalDest = useObjectStorage
    ? path.join(base, `${filenameBase}-original${originalExt}`)
    : path.join(base, 'original', filenameBase + originalExt);
  const displayDest = useObjectStorage
    ? path.join(base, `${filenameBase}-display${ext}`)
    : path.join(base, 'display', filenameBase + ext);
  const thumbDest = useObjectStorage
    ? path.join(base, `${filenameBase}-thumbnail${ext}`)
    : path.join(base, 'thumbnail', filenameBase + ext);

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

  // Compression always re-encodes the original to JPEG regardless of the
  // uploaded format, so the stored mime type must reflect that too.
  const finalMimeType = compress ? 'image/jpeg' : (mimeType || 'image/jpeg');

  if (useObjectStorage) {
    const originalKey = mediaStorageService.generateKey(`albums/${albumId}/original`, filenameBase + originalExt);
    const displayKey = mediaStorageService.generateKey(`albums/${albumId}/display`, filenameBase + ext);
    const thumbKey = mediaStorageService.generateKey(`albums/${albumId}/thumbnail`, filenameBase + ext);
    await mediaStorageService.upload(originalKey, fs.readFileSync(originalDest), { contentType: finalMimeType });
    await mediaStorageService.upload(displayKey, fs.readFileSync(displayDest), { contentType: 'image/jpeg' });
    await mediaStorageService.upload(thumbKey, fs.readFileSync(thumbDest), { contentType: 'image/jpeg' });
    fs.unlink(originalDest, () => {});
    fs.unlink(displayDest, () => {});
    fs.unlink(thumbDest, () => {});
    return {
      originalPath: `/media/${originalKey}`,
      displayPath: `/media/${displayKey}`,
      thumbnailPath: `/media/${thumbKey}`,
      width: meta.width,
      height: meta.height,
      mimeType: finalMimeType,
    };
  }

  const relBase = `albums/${albumId}`;
  return {
    originalPath: `${relBase}/original/${path.basename(originalDest)}`,
    displayPath: `${relBase}/display/${path.basename(displayDest)}`,
    thumbnailPath: `${relBase}/thumbnail/${path.basename(thumbDest)}`,
    width: meta.width,
    height: meta.height,
    mimeType: finalMimeType,
  };
}

// Used when duplicating an album - each album owns its own files under
// albums/<id>/, so a duplicate must get real independent copies, not shared
// paths (otherwise deleting one album's directory would corrupt the other's).
// Each field copies within whichever storage it already lives in - an image
// uploaded before R2 was wired in stays on local disk when duplicated, one
// uploaded after stays in the bucket (an R2-side copy, no bytes downloaded).
async function copyImageToNewAlbum(destAlbumId, image) {
  const relBase = `albums/${destAlbumId}`;
  const out = {};
  for (const [key, sub] of [['original_path', 'original'], ['display_path', 'display'], ['thumbnail_path', 'thumbnail']]) {
    const srcPath = image[key];
    if (isMediaPath(srcPath)) {
      const srcKey = mediaKeyFromPath(srcPath);
      const destKey = mediaStorageService.generateKey(`${relBase}/${sub}`, path.basename(srcKey));
      await mediaStorageService.copy(srcKey, destKey);
      out[key] = `/media/${destKey}`;
    } else {
      const base = ensureAlbumDirs(destAlbumId);
      const srcAbs = path.join(__dirname, '..', srcPath);
      const filename = path.basename(srcPath);
      const destAbs = path.join(base, sub, filename);
      fs.copyFileSync(srcAbs, destAbs);
      out[key] = `${relBase}/${sub}/${filename}`;
    }
  }
  return out;
}

function deleteAlbumImageFiles(image) {
  for (const p of [image.original_path, image.display_path, image.thumbnail_path]) {
    if (!p) continue;
    if (isMediaPath(p)) {
      mediaStorageService.delete(mediaKeyFromPath(p)).catch(() => {});
    } else {
      fs.unlink(path.join(__dirname, '..', p), () => {});
    }
  }
}

function deleteAlbumDir(albumId) {
  fs.rm(albumDir(albumId), { recursive: true, force: true }, () => {});
}

// Generic single-path delete for the standalone assets (logo, background
// music) that don't go through processAlbumImage's original/display/
// thumbnail triad - same local-vs-R2 branch as deleteAlbumImageFiles.
function deleteAlbumMediaPath(p) {
  if (!p) return;
  if (isMediaPath(p)) {
    mediaStorageService.delete(mediaKeyFromPath(p)).catch(() => {});
  } else {
    fs.unlink(path.join(__dirname, '..', p), () => {});
  }
}

// Uploads a standalone asset (logo/music) that skips the image triad -
// object storage when configured, else the existing local-disk copy.
async function uploadAlbumAsset(albumId, srcPath, subfolder, filename, contentType) {
  if (mediaStorageService.isConfigured()) {
    const key = mediaStorageService.generateKey(`albums/${albumId}/${subfolder}`, filename);
    await mediaStorageService.upload(key, fs.readFileSync(srcPath), { contentType });
    return `/media/${key}`;
  }
  const dir = path.join(albumDir(albumId), subfolder);
  fs.mkdirSync(dir, { recursive: true });
  const destPath = path.join(dir, filename);
  fs.copyFileSync(srcPath, destPath);
  return `albums/${albumId}/${subfolder}/${filename}`;
}

module.exports = {
  processAlbumImage,
  copyImageToNewAlbum,
  deleteAlbumImageFiles,
  deleteAlbumDir,
  deleteAlbumMediaPath,
  uploadAlbumAsset,
  isMediaPath,
  ALBUMS_DIR,
};
