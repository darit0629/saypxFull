// One-time, additive, non-destructive migration of existing local-disk media
// (Portfolio + Digital Photo Book) into R2. Never deletes or modifies a
// local file - it only uploads a copy, verifies the copy landed intact
// (byte-size match), and then flips the stored reference to "/media/<key>".
// If verification fails for a given file, that reference is left pointing
// at local disk exactly as before, so nothing can end up referencing a
// half-uploaded or missing object.
//
// Safe to re-run: anything already pointing at "/media/..." is skipped, so
// an interrupted run just picks up where it left off.
//
// Usage:
//   node scripts/migrateMediaToR2.js                 # dry run (default)
//   node scripts/migrateMediaToR2.js --apply          # actually migrate
//   node scripts/migrateMediaToR2.js --apply --only=portfolio
//   node scripts/migrateMediaToR2.js --apply --only=albums
//   node scripts/migrateMediaToR2.js --apply --limit=20   # cap item count, for a first small batch

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const mediaStorageService = require('../lib/mediaStorageService');
const { readItems, writeItems } = require('../lib/portfolioStore');
const db = require('../lib/albumsDb');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const ONLY = (args.find((a) => a.startsWith('--only=')) || '').split('=')[1] || null;
const LIMIT = Number((args.find((a) => a.startsWith('--limit=')) || '').split('=')[1]) || Infinity;

const stats = { uploaded: 0, bytes: 0, skippedAlreadyMigrated: 0, missingLocalFile: 0, verifyFailed: 0, itemsTouched: 0 };

function isMediaPath(p) {
  return typeof p === 'string' && p.startsWith('/media/');
}

function contentTypeFor(ext) {
  const e = ext.toLowerCase();
  if (e === '.mp4') return 'video/mp4';
  if (e === '.png') return 'image/png';
  if (e === '.mp3') return 'audio/mpeg';
  return 'image/jpeg';
}

// Uploads one local file to R2 under `prefix`, verifies the object's size
// matches the local file before reporting success. Returns the new
// "/media/<key>" path, or null if the local file is missing or the
// post-upload verification failed (caller must leave the old path alone).
async function migrateOneFile(relPath, prefix) {
  if (!relPath || isMediaPath(relPath)) return null;
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) {
    stats.missingLocalFile++;
    console.warn(`  [missing] ${relPath}`);
    return null;
  }
  const localSize = fs.statSync(abs).size;
  const ext = path.extname(relPath) || '.jpg';
  if (!APPLY) {
    stats.uploaded++;
    stats.bytes += localSize;
    return `/media/${prefix}/DRY-RUN${ext}`;
  }
  const key = mediaStorageService.generateKey(prefix, path.basename(relPath));
  await mediaStorageService.upload(key, fs.readFileSync(abs), { contentType: contentTypeFor(ext) });
  const meta = await mediaStorageService.getMetadata(key);
  if (meta.size !== localSize) {
    stats.verifyFailed++;
    console.error(`  [verify FAILED] ${relPath} -> ${key} (local ${localSize}B, remote ${meta.size}B)`);
    return null;
  }
  stats.uploaded++;
  stats.bytes += localSize;
  return `/media/${key}`;
}

async function migratePortfolio() {
  console.log('\n=== Portfolio ===');
  const items = readItems();
  let touchedAny = false;
  let processed = 0;

  for (const item of items) {
    if (processed >= LIMIT) break;
    const isVideo = item.type === 'video';
    const fields = isVideo ? [['video', 'portfolio/videos'], ['poster', 'portfolio/posters']] : [['src', 'portfolio/images'], ['thumb', 'portfolio/thumbnails']];
    const alreadyDone = fields.every(([key]) => !item[key] || isMediaPath(item[key]));
    if (alreadyDone) {
      stats.skippedAlreadyMigrated++;
      continue;
    }

    processed++;
    console.log(`[${processed}] ${item.title || '(untitled)'}`);
    let itemTouched = false;
    for (const [key, prefix] of fields) {
      const newPath = await migrateOneFile(item[key], prefix);
      if (newPath) {
        if (APPLY) item[key] = newPath;
        itemTouched = true;
      }
    }
    if (itemTouched) {
      stats.itemsTouched++;
      touchedAny = true;
      if (APPLY) writeItems(items); // persist incrementally so an interrupted run keeps its progress
    }
  }

  if (!touchedAny) console.log('Nothing to migrate.');
}

async function migrateAlbums() {
  console.log('\n=== Digital Photo Book albums ===');
  const images = db.prepare(
    `SELECT * FROM digital_album_images
     WHERE original_path NOT LIKE '/media/%' OR display_path NOT LIKE '/media/%' OR thumbnail_path NOT LIKE '/media/%'`
  ).all();

  let processed = 0;
  for (const img of images) {
    if (processed >= LIMIT) break;
    processed++;
    console.log(`[image ${img.id}] album ${img.album_id}`);
    const updates = {};
    const fieldMap = [
      ['original_path', `albums/${img.album_id}/original`],
      ['display_path', `albums/${img.album_id}/display`],
      ['thumbnail_path', `albums/${img.album_id}/thumbnail`],
    ];
    for (const [col, prefix] of fieldMap) {
      const newPath = await migrateOneFile(img[col], prefix);
      if (newPath) updates[col] = newPath;
    }
    if (APPLY && Object.keys(updates).length) {
      const sets = Object.keys(updates).map((c) => `${c} = ?`).join(', ');
      db.prepare(`UPDATE digital_album_images SET ${sets} WHERE id = ?`).run(...Object.values(updates), img.id);
      stats.itemsTouched++;
    } else if (Object.keys(updates).length) {
      stats.itemsTouched++;
    }
  }

  const albums = db.prepare(
    `SELECT id, logo_path, background_music_path FROM digital_albums
     WHERE (logo_path IS NOT NULL AND logo_path NOT LIKE '/media/%')
        OR (background_music_path IS NOT NULL AND background_music_path NOT LIKE '/media/%')`
  ).all();
  for (const album of albums) {
    if (album.logo_path && !isMediaPath(album.logo_path)) {
      const newPath = await migrateOneFile(album.logo_path, `albums/${album.id}/logo`);
      if (newPath) {
        if (APPLY) db.prepare('UPDATE digital_albums SET logo_path = ? WHERE id = ?').run(newPath, album.id);
        stats.itemsTouched++;
      }
    }
    if (album.background_music_path && !isMediaPath(album.background_music_path)) {
      const newPath = await migrateOneFile(album.background_music_path, `albums/${album.id}/audio`);
      if (newPath) {
        if (APPLY) db.prepare('UPDATE digital_albums SET background_music_path = ? WHERE id = ?').run(newPath, album.id);
        stats.itemsTouched++;
      }
    }
  }

  if (!images.length && !albums.length) console.log('Nothing to migrate.');
}

async function main() {
  if (!mediaStorageService.isConfigured()) {
    console.error('Object storage is not configured (missing R2_* env vars) - nothing to do.');
    process.exit(1);
  }
  console.log(APPLY ? 'Running in APPLY mode - files will be uploaded and references updated.' : 'Running in DRY-RUN mode - no uploads, no writes. Pass --apply to actually migrate.');

  if (!ONLY || ONLY === 'portfolio') await migratePortfolio();
  if (!ONLY || ONLY === 'albums') await migrateAlbums();

  console.log('\n=== Summary ===');
  console.log(`Items touched:            ${stats.itemsTouched}`);
  console.log(`Files uploaded:           ${stats.uploaded}`);
  console.log(`Total bytes:              ${(stats.bytes / 1024 / 1024).toFixed(1)} MB`);
  console.log(`Already migrated (skip):  ${stats.skippedAlreadyMigrated}`);
  console.log(`Missing local file:       ${stats.missingLocalFile}`);
  console.log(`Verification failures:    ${stats.verifyFailed}`);
  if (!APPLY) console.log('\nThis was a dry run - nothing was uploaded or changed. Re-run with --apply to migrate for real.');
}

main().catch((e) => {
  console.error('Migration script crashed:', e);
  process.exit(1);
});
