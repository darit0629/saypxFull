const DEFAULT_EXPIRING_SOON_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Pure, time+credits based - never touches admin_override_status. The two are
// deliberately kept on separate axes; callers combine them (override wins when
// restrictive) rather than this function ever knowing about overrides at all.
function computeStatus(pkg, now = Date.now(), expiringSoonWindowMs = DEFAULT_EXPIRING_SOON_WINDOW_MS) {
  if (pkg.starts_at && now < pkg.starts_at) return 'PENDING';
  if (pkg.expires_at && now > pkg.expires_at) return 'EXPIRED';
  if (pkg.expires_at && pkg.expires_at - now < expiringSoonWindowMs) return 'EXPIRING_SOON';
  return 'ACTIVE';
}

// Admin-configurable via the Renewals settings page (photo_book_settings);
// falls back to the original 7-day default if the settings row doesn't exist
// yet or holds something invalid.
function getExpiringSoonWindowMs(db) {
  const row = db.prepare('SELECT expiring_soon_days FROM photo_book_settings WHERE id = 1').get();
  const days = row && Number.isInteger(row.expiring_soon_days) && row.expiring_soon_days > 0 ? row.expiring_soon_days : 7;
  return days * 24 * 60 * 60 * 1000;
}

// Reads a package, recomputes computed_status, persists it if it changed (so
// admin list views that don't recompute stay reasonably fresh), and returns
// the up-to-date row. This is the "lazy recompute on read" mechanism - the
// expiry sweep below does the same thing proactively for all packages.
function refreshPackageStatus(db, packageId) {
  const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(packageId);
  if (!pkg) return null;
  const fresh = computeStatus(pkg, Date.now(), getExpiringSoonWindowMs(db));
  if (fresh !== pkg.computed_status) {
    db.prepare('UPDATE packages SET computed_status = ?, updated_at = unixepoch() * 1000 WHERE id = ?').run(fresh, packageId);
    pkg.computed_status = fresh;
  }
  return pkg;
}

// Proactively recomputes computed_status for every non-terminal package
// (EXPIRED is terminal - nothing left to transition). On an -> EXPIRED
// transition, logs a 0-amount PACKAGE_EXPIRY ledger marker so the Credits
// page shows exactly when/why a customer's access was cut, same as every
// other status change already gets an audit trail entry. Called on a timer
// from server.js; also safe to call ad hoc (e.g. after changing the
// EXPIRING_SOON threshold) since it's just a batched refreshPackageStatus.
function runExpirySweep(db) {
  const windowMs = getExpiringSoonWindowMs(db);
  const now = Date.now();
  const rows = db.prepare("SELECT * FROM packages WHERE computed_status != 'EXPIRED'").all();
  let transitioned = 0;
  for (const pkg of rows) {
    const fresh = computeStatus(pkg, now, windowMs);
    if (fresh === pkg.computed_status) continue;
    db.prepare('UPDATE packages SET computed_status = ?, updated_at = unixepoch() * 1000 WHERE id = ?').run(fresh, pkg.id);
    if (fresh === 'EXPIRED') {
      const balanceAfter = pkg.credits_total - pkg.credits_used;
      db.prepare(
        `INSERT INTO credit_transactions (package_id, customer_id, type, amount, balance_after, actor_type, actor_id, note)
         VALUES (?, ?, 'PACKAGE_EXPIRY', 0, ?, 'SYSTEM', 'expiry-sweep', 'Package expired')`
      ).run(pkg.id, pkg.customer_id, balanceAfter);
      transitioned++;
    }
  }
  return { checked: rows.length, transitioned };
}

module.exports = { computeStatus, refreshPackageStatus, runExpirySweep, getExpiringSoonWindowMs };
