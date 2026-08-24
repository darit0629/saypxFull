const EXPIRING_SOON_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Pure, time+credits based - never touches admin_override_status. The two are
// deliberately kept on separate axes; callers combine them (override wins when
// restrictive) rather than this function ever knowing about overrides at all.
function computeStatus(pkg, now = Date.now()) {
  if (pkg.starts_at && now < pkg.starts_at) return 'PENDING';
  if (pkg.expires_at && now > pkg.expires_at) return 'EXPIRED';
  if (pkg.expires_at && pkg.expires_at - now < EXPIRING_SOON_WINDOW_MS) return 'EXPIRING_SOON';
  return 'ACTIVE';
}

// Reads a package, recomputes computed_status, persists it if it changed (so
// admin list views that don't recompute stay reasonably fresh), and returns
// the up-to-date row. This is the "lazy recompute on read" mechanism - the
// Phase 6 sweep job does the same thing proactively for all packages.
function refreshPackageStatus(db, packageId) {
  const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(packageId);
  if (!pkg) return null;
  const fresh = computeStatus(pkg);
  if (fresh !== pkg.computed_status) {
    db.prepare('UPDATE packages SET computed_status = ?, updated_at = unixepoch() * 1000 WHERE id = ?').run(fresh, packageId);
    pkg.computed_status = fresh;
  }
  return pkg;
}

module.exports = { computeStatus, refreshPackageStatus };
