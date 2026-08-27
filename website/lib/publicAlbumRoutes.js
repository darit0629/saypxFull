const path = require('path');
const db = require('./albumsDb');

// Unauthenticated - serves only the minimum a public viewer needs. Never
// return internal numeric ids, owner info, original (non-optimized) image
// paths, or audit/analytics data here.
function buildRouter() {
  const express = require('express');
  const router = express.Router();

  function detectDeviceType(userAgent) {
    const ua = (userAgent || '').toLowerCase();
    if (/mobile|iphone|android.*mobile/.test(ua)) return 'mobile';
    if (/ipad|tablet|android(?!.*mobile)/.test(ua)) return 'tablet';
    return 'desktop';
  }

  function publicImage(img) {
    if (!img) return null;
    return { displayUrl: img.display_path, thumbnailUrl: img.thumbnail_path, width: img.width, height: img.height, centerXPct: img.center_x_pct };
  }

  router.get('/:code', (req, res) => {
    const code = String(req.params.code || '').toUpperCase();
    const album = db.prepare('SELECT * FROM digital_albums WHERE public_code = ?').get(code);
    if (!album) return res.status(404).json({ error: 'Album not found' });
    if (album.status !== 'PUBLISHED') {
      return res.status(403).json({ error: 'This digital album is currently unavailable.', status: album.status });
    }

    const pages = db
      .prepare(
        `SELECT p.page_number, p.spread_number, i.display_path, i.thumbnail_path, i.width, i.height, i.center_x_pct
         FROM digital_album_pages p JOIN digital_album_images i ON i.id = p.image_id
         WHERE p.album_id = ? ORDER BY p.sort_order ASC`
      )
      .all(album.id);
    const coverImage = album.cover_image_id
      ? publicImage(db.prepare('SELECT display_path, thumbnail_path, width, height, center_x_pct FROM digital_album_images WHERE id = ?').get(album.cover_image_id))
      : null;
    const backCoverImage = album.back_cover_image_id
      ? publicImage(db.prepare('SELECT display_path, thumbnail_path, width, height, center_x_pct FROM digital_album_images WHERE id = ?').get(album.back_cover_image_id))
      : null;

    db.prepare('UPDATE digital_albums SET view_count = view_count + 1 WHERE id = ?').run(album.id);
    db.prepare('INSERT INTO digital_album_views (album_id, device_type) VALUES (?, ?)').run(album.id, detectDeviceType(req.headers['user-agent']));

    res.json({
      publicCode: album.public_code,
      title: album.title,
      description: album.description,
      eventType: album.event_type,
      customMessage: album.custom_message,
      pageMode: album.page_mode,
      soundEnabled: !!album.sound_enabled,
      allowDownload: !!album.allow_download,
      allowShare: !!album.allow_share,
      watermarkEnabled: !!album.watermark_enabled,
      watermarkJson: album.watermark_enabled ? album.watermark_json : null,
      loadingTagline: album.loading_tagline || null,
      logoUrl: album.logo_path || null,
      musicUrl: album.background_music_path || null,
      audioMode: album.audio_mode,
      musicVolume: album.music_volume,
      musicLoop: !!album.music_loop,
      coverImage,
      backCoverImage,
      pages: pages.map((p) => ({
        pageNumber: p.page_number,
        spreadNumber: p.spread_number,
        ...publicImage(p),
      })),
    });
  });

  return router;
}

module.exports = { buildRouter };
