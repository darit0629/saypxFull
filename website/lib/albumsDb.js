const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, '..', 'albums.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS digital_albums (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL DEFAULT 1,
  title TEXT NOT NULL,
  client_name TEXT,
  event_type TEXT,
  event_date INTEGER,
  photographer_name TEXT,
  description TEXT,
  bride_name TEXT,
  groom_name TEXT,
  venue TEXT,
  location TEXT,
  custom_message TEXT,
  public_code TEXT UNIQUE NOT NULL,
  page_mode TEXT NOT NULL DEFAULT 'SINGLE_PAGE' CHECK(page_mode IN ('SINGLE_PAGE','FULL_SPREAD')),
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PROCESSING','PUBLISHED','UNPUBLISHED','ARCHIVED')),
  cover_image_id INTEGER,
  back_cover_image_id INTEGER,
  allow_download INTEGER NOT NULL DEFAULT 0,
  allow_share INTEGER NOT NULL DEFAULT 1,
  sound_enabled INTEGER NOT NULL DEFAULT 1,
  watermark_enabled INTEGER NOT NULL DEFAULT 0,
  watermark_json TEXT,
  compress_images INTEGER NOT NULL DEFAULT 1,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  published_at INTEGER
);

CREATE TABLE IF NOT EXISTS digital_album_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  album_id INTEGER NOT NULL REFERENCES digital_albums(id) ON DELETE CASCADE,
  original_path TEXT NOT NULL,
  display_path TEXT NOT NULL,
  thumbnail_path TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  mime_type TEXT,
  file_size INTEGER,
  center_x_pct REAL NOT NULL DEFAULT 50,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE TABLE IF NOT EXISTS digital_album_pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  album_id INTEGER NOT NULL REFERENCES digital_albums(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  spread_number INTEGER,
  sort_order INTEGER NOT NULL,
  image_id INTEGER NOT NULL REFERENCES digital_album_images(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE INDEX IF NOT EXISTS idx_album_pages_album ON digital_album_pages(album_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_album_images_album ON digital_album_images(album_id);

CREATE TABLE IF NOT EXISTS digital_album_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  album_id INTEGER NOT NULL REFERENCES digital_albums(id) ON DELETE CASCADE,
  viewed_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  device_type TEXT
);

CREATE INDEX IF NOT EXISTS idx_album_views_album ON digital_album_views(album_id);

CREATE TABLE IF NOT EXISTS digital_album_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  album_id INTEGER REFERENCES digital_albums(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  detail TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
`);

// Additive migration: an early dev build of this table used cover_page_id /
// back_cover_page_id (misleadingly - these always store an image id, not a
// page id, so a separately-uploaded cover isn't forced to also be a numbered
// interior page). Rename in place if an old-shaped DB is still on disk.
const albumCols = db.prepare("PRAGMA table_info(digital_albums)").all().map((c) => c.name);
if (albumCols.includes('cover_page_id') && !albumCols.includes('cover_image_id')) {
  db.exec('ALTER TABLE digital_albums RENAME COLUMN cover_page_id TO cover_image_id');
}
if (albumCols.includes('back_cover_page_id') && !albumCols.includes('back_cover_image_id')) {
  db.exec('ALTER TABLE digital_albums RENAME COLUMN back_cover_page_id TO back_cover_image_id');
}
if (!albumCols.includes('compress_images')) {
  db.exec('ALTER TABLE digital_albums ADD COLUMN compress_images INTEGER NOT NULL DEFAULT 1');
}
// customer_id/package_id are purely additive - NULL means "admin/legacy album",
// structurally indistinguishable from before this column existed. Entitlement
// state itself lives entirely in the Billing app's own database; these are
// just traceability references, resolved by application code (no cross-DB FK
// is possible - Billing and Saypxmain are separate SQLite files/processes).
if (!albumCols.includes('customer_id')) {
  db.exec('ALTER TABLE digital_albums ADD COLUMN customer_id INTEGER');
}
if (!albumCols.includes('package_id')) {
  db.exec('ALTER TABLE digital_albums ADD COLUMN package_id INTEGER');
}

module.exports = db;
