const express = require('express');
const db = require('../db');
const { refreshPackageStatus } = require('../lib/packageStatus');
const websiteProxy = require('../lib/websiteProxy');

const router = express.Router();

// The full "User Active? -> Package Active? -> Admin Override Allows? ->
// Entitlement Valid? -> ALLOW" chain from the plan, evaluated fresh on every
// request. Never trust a client-sent flag - this is the one place that
// decides whether a customer is allowed to spend a credit. Returns either
// { ok: true, pkg } or { ok: false, code, message }.
function checkEntitlement(customerId) {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  if (!customer || customer.status !== 'ACTIVE') {
    return { ok: false, code: 'ACCOUNT_INACTIVE', message: 'Your account is not active.' };
  }

  const packages = db
    .prepare('SELECT * FROM packages WHERE customer_id = ? ORDER BY created_at DESC')
    .all(customerId)
    .map((p) => refreshPackageStatus(db, p.id));

  // Prefer a package that's genuinely usable right now over one that's merely
  // the most recent - a customer can have an old EXPIRED package and a newer
  // ACTIVE one, and the newer one should win.
  const usable = packages.find((p) => {
    if (p.admin_override_status === 'SUSPENDED' || p.admin_override_status === 'CANCELLED') return false;
    if (p.computed_status !== 'ACTIVE' && p.computed_status !== 'EXPIRING_SOON' && p.admin_override_status !== 'FORCE_ACTIVE') return false;
    return p.credits_used < p.credits_total;
  });

  if (!usable) {
    // Give a specific, honest reason using the most recent package if one exists.
    const mostRecent = packages[0];
    if (!mostRecent) return { ok: false, code: 'NO_ACTIVE_PACKAGE', message: 'You do not have a package yet.' };
    if (mostRecent.admin_override_status === 'SUSPENDED') {
      return { ok: false, code: 'PACKAGE_SUSPENDED', message: 'Your package has been suspended. Contact SAYPX support.' };
    }
    if (mostRecent.admin_override_status === 'CANCELLED') {
      return { ok: false, code: 'PACKAGE_CANCELLED', message: 'Your package has been cancelled.' };
    }
    if (mostRecent.computed_status === 'EXPIRED') {
      return { ok: false, code: 'PACKAGE_EXPIRED', message: 'Your package has expired. Renew to continue creating albums.' };
    }
    if (mostRecent.credits_used >= mostRecent.credits_total) {
      return { ok: false, code: 'NO_CREDITS', message: 'You have used all your album credits.' };
    }
    return { ok: false, code: 'NO_ACTIVE_PACKAGE', message: 'You do not have an active package.' };
  }

  return { ok: true, pkg: usable };
}

router.get('/', async (req, res) => {
  try {
    const albums = await websiteProxy.listAlbums({ customerId: req.customerSession.customerId });
    res.json(albums);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const album = await websiteProxy.getAlbum(req.params.id);
    if (String(album.customer_id) !== String(req.customerSession.customerId)) {
      return res.status(404).json({ error: 'Album not found' });
    }
    res.json(album);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.post('/', async (req, res) => {
  const customerId = req.customerSession.customerId;
  const check = checkEntitlement(customerId);
  if (!check.ok) {
    return res.status(403).json({ error: check.message, code: check.code });
  }
  const pkg = check.pkg;

  // Deduct the credit BEFORE calling Saypxmain, then compensate with a refund
  // if the downstream call fails - a real cross-process transaction isn't
  // possible since Billing and Saypxmain are separate SQLite databases.
  const deduct = db.transaction(() => {
    db.prepare('UPDATE packages SET credits_used = credits_used + 1, updated_at = unixepoch() * 1000 WHERE id = ?').run(pkg.id);
    const updated = db.prepare('SELECT * FROM packages WHERE id = ?').get(pkg.id);
    db.prepare(
      `INSERT INTO credit_transactions (package_id, customer_id, type, amount, balance_after, actor_type, actor_id)
       VALUES (?, ?, 'ALBUM_CREATED', -1, ?, 'CUSTOMER', ?)`
    ).run(pkg.id, customerId, updated.credits_total - updated.credits_used, String(customerId));
  });

  try {
    deduct();
  } catch (e) {
    return res.status(500).json({ error: 'Failed to reserve a credit' });
  }

  try {
    const album = await websiteProxy.createAlbum({ ...req.body, customerId, packageId: pkg.id });
    res.status(201).json(album);
  } catch (e) {
    // Compensating refund - the credit was reserved but the album never got created.
    const refund = db.transaction(() => {
      db.prepare('UPDATE packages SET credits_used = credits_used - 1, updated_at = unixepoch() * 1000 WHERE id = ?').run(pkg.id);
      const updated = db.prepare('SELECT * FROM packages WHERE id = ?').get(pkg.id);
      db.prepare(
        `INSERT INTO credit_transactions (package_id, customer_id, type, amount, balance_after, actor_type, actor_id, note)
         VALUES (?, ?, 'CREDIT_REFUND', 1, ?, 'SYSTEM', 'auto', ?)`
      ).run(pkg.id, customerId, updated.credits_total - updated.credits_used, 'Album creation failed: ' + e.message);
    });
    refund();
    res.status(e.status || 500).json({ error: e.message || 'Failed to create album' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const existing = await websiteProxy.getAlbum(req.params.id);
    if (String(existing.customer_id) !== String(req.customerSession.customerId)) {
      return res.status(404).json({ error: 'Album not found' });
    }
    // Editing an existing album never consumes another credit.
    const album = await websiteProxy.updateAlbum(req.params.id, req.body);
    res.json(album);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.delete('/:id', async (req, res) => {
  const customerId = req.customerSession.customerId;
  try {
    const existing = await websiteProxy.getAlbum(req.params.id);
    if (String(existing.customer_id) !== String(customerId)) {
      return res.status(404).json({ error: 'Album not found' });
    }
    await websiteProxy.deleteAlbum(req.params.id);

    // Deleting does NOT refund a credit - it's logged for audit purposes only.
    if (existing.package_id) {
      const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(existing.package_id);
      if (pkg) {
        db.prepare(
          `INSERT INTO credit_transactions (package_id, customer_id, type, amount, balance_after, album_id, actor_type, actor_id)
           VALUES (?, ?, 'ALBUM_DELETED', 0, ?, ?, 'CUSTOMER', ?)`
        ).run(pkg.id, customerId, pkg.credits_total - pkg.credits_used, existing.id, String(customerId));
      }
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

module.exports = router;
