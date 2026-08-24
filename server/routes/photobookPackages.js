const express = require('express');
const db = require('../db');
const { refreshPackageStatus } = require('../lib/packageStatus');
const { serializePlan } = require('./photobookPlans');

const router = express.Router();

const ADMIN_ACTOR = process.env.ADMIN_USERNAME || 'admin';

function serializePackage(pkg) {
  const customer = db.prepare('SELECT id, email, name, business_name FROM customers WHERE id = ?').get(pkg.customer_id);
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(pkg.plan_id);
  return {
    id: pkg.id,
    customer: customer
      ? { id: customer.id, email: customer.email, name: customer.name, businessName: customer.business_name }
      : null,
    plan: plan ? serializePlan(plan) : null,
    creditsTotal: pkg.credits_total,
    creditsUsed: pkg.credits_used,
    creditsRemaining: pkg.credits_total - pkg.credits_used,
    startsAt: pkg.starts_at,
    expiresAt: pkg.expires_at,
    computedStatus: pkg.computed_status,
    adminOverrideStatus: pkg.admin_override_status,
    adminOverrideReason: pkg.admin_override_reason,
    adminOverrideBy: pkg.admin_override_by,
    adminOverrideAt: pkg.admin_override_at,
    createdAt: pkg.created_at,
    updatedAt: pkg.updated_at,
  };
}

function loadFresh(id) {
  return refreshPackageStatus(db, id);
}

function logAudit(packageId, action, before, after, reason) {
  db.prepare(
    `INSERT INTO admin_package_audit_log (package_id, action, before_json, after_json, reason, performed_by)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(packageId, action, JSON.stringify(before), JSON.stringify(after), reason || null, ADMIN_ACTOR);
}

function logCreditTransaction(pkg, type, amount, note) {
  const balanceAfter = pkg.credits_total - pkg.credits_used;
  db.prepare(
    `INSERT INTO credit_transactions (package_id, customer_id, type, amount, balance_after, actor_type, actor_id, note)
     VALUES (?, ?, ?, ?, ?, 'ADMIN', ?, ?)`
  ).run(pkg.id, pkg.customer_id, type, amount, balanceAfter, ADMIN_ACTOR, note || null);
}

router.get('/', (req, res) => {
  const { customerId, status } = req.query;
  let rows = db.prepare('SELECT * FROM packages ORDER BY created_at DESC').all();
  rows = rows.map((r) => loadFresh(r.id));
  if (customerId) rows = rows.filter((r) => String(r.customer_id) === String(customerId));
  if (status) rows = rows.filter((r) => r.computed_status === status || r.admin_override_status === status);
  res.json(rows.map(serializePackage));
});

router.get('/:id', (req, res) => {
  const pkg = loadFresh(req.params.id);
  if (!pkg) return res.status(404).json({ error: 'Package not found' });
  const auditLog = db
    .prepare('SELECT * FROM admin_package_audit_log WHERE package_id = ? ORDER BY created_at DESC')
    .all(pkg.id);
  const ledger = db
    .prepare('SELECT * FROM credit_transactions WHERE package_id = ? ORDER BY created_at DESC')
    .all(pkg.id);
  res.json({ ...serializePackage(pkg), auditLog, ledger });
});

// Manual admin creation - the non-Razorpay path for granting a package (comping
// a customer, migrating an existing arrangement, etc).
router.post('/', (req, res) => {
  const { customerId, planId, startsAt, creditsOverride } = req.body || {};
  const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(customerId);
  if (!customer) return res.status(400).json({ error: 'Customer not found' });
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(planId);
  if (!plan) return res.status(400).json({ error: 'Plan not found' });

  const starts = Number.isInteger(startsAt) ? startsAt : Date.now();
  const expires = starts + plan.duration_days * 24 * 60 * 60 * 1000;
  const credits = Number.isInteger(creditsOverride) && creditsOverride > 0 ? creditsOverride : plan.credits;

  const result = db
    .prepare(
      `INSERT INTO packages (customer_id, plan_id, credits_total, starts_at, expires_at, computed_status)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(customerId, planId, credits, starts, expires, starts > Date.now() ? 'PENDING' : 'ACTIVE');

  const pkg = loadFresh(result.lastInsertRowid);
  logCreditTransaction(pkg, 'PACKAGE_PURCHASE', credits, 'Manually created by admin');
  logAudit(pkg.id, 'CREATE', null, serializePackage(pkg), 'Manual admin creation');
  res.status(201).json(serializePackage(pkg));
});

function overrideAction(action, applyFn) {
  return (req, res) => {
    const pkg = loadFresh(req.params.id);
    if (!pkg) return res.status(404).json({ error: 'Package not found' });
    const before = serializePackage(pkg);
    try {
      applyFn(pkg, req.body || {});
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    const after = loadFresh(req.params.id);
    logAudit(pkg.id, action, before, serializePackage(after), (req.body || {}).reason);
    res.json(serializePackage(after));
  };
}

// These routes only ever touch admin_override_status (or credits) - never
// computed_status directly, keeping the two axes independent per the explicit
// requirement that automated and manual state never collapse into one field.
router.post(
  '/:id/activate',
  overrideAction('ACTIVATE', (pkg) => {
    db.prepare(
      'UPDATE packages SET admin_override_status = NULL, admin_override_reason = NULL, admin_override_by = ?, admin_override_at = unixepoch() * 1000, updated_at = unixepoch() * 1000 WHERE id = ?'
    ).run(ADMIN_ACTOR, pkg.id);
  })
);

router.post(
  '/:id/suspend',
  overrideAction('SUSPEND', (pkg, body) => {
    db.prepare(
      'UPDATE packages SET admin_override_status = ?, admin_override_reason = ?, admin_override_by = ?, admin_override_at = unixepoch() * 1000, updated_at = unixepoch() * 1000 WHERE id = ?'
    ).run('SUSPENDED', body.reason || null, ADMIN_ACTOR, pkg.id);
  })
);

router.post(
  '/:id/reactivate',
  overrideAction('REACTIVATE', (pkg) => {
    db.prepare(
      'UPDATE packages SET admin_override_status = NULL, admin_override_reason = NULL, admin_override_by = ?, admin_override_at = unixepoch() * 1000, updated_at = unixepoch() * 1000 WHERE id = ?'
    ).run(ADMIN_ACTOR, pkg.id);
  })
);

router.post(
  '/:id/cancel',
  overrideAction('CANCEL', (pkg, body) => {
    db.prepare(
      'UPDATE packages SET admin_override_status = ?, admin_override_reason = ?, admin_override_by = ?, admin_override_at = unixepoch() * 1000, updated_at = unixepoch() * 1000 WHERE id = ?'
    ).run('CANCELLED', body.reason || null, ADMIN_ACTOR, pkg.id);
  })
);

router.post(
  '/:id/extend',
  overrideAction('EXTEND', (pkg, body) => {
    const days = body.days;
    if (!Number.isInteger(days) || days <= 0) throw new Error('days must be a positive whole number');
    const base = pkg.expires_at && pkg.expires_at > Date.now() ? pkg.expires_at : Date.now();
    const newExpiry = base + days * 24 * 60 * 60 * 1000;
    db.prepare('UPDATE packages SET expires_at = ?, updated_at = unixepoch() * 1000 WHERE id = ?').run(newExpiry, pkg.id);
  })
);

router.post(
  '/:id/change-expiry',
  overrideAction('CHANGE_EXPIRY', (pkg, body) => {
    if (!Number.isInteger(body.expiresAt)) throw new Error('expiresAt (timestamp) is required');
    db.prepare('UPDATE packages SET expires_at = ?, updated_at = unixepoch() * 1000 WHERE id = ?').run(body.expiresAt, pkg.id);
  })
);

router.post(
  '/:id/add-credits',
  overrideAction('ADD_CREDITS', (pkg, body) => {
    const amount = body.amount;
    if (!Number.isInteger(amount) || amount <= 0) throw new Error('amount must be a positive whole number');
    db.prepare('UPDATE packages SET credits_total = credits_total + ?, updated_at = unixepoch() * 1000 WHERE id = ?').run(amount, pkg.id);
    const updated = loadFresh(pkg.id);
    logCreditTransaction(updated, 'ADMIN_ADJUSTMENT', amount, body.reason || 'Admin added credits');
  })
);

router.post(
  '/:id/remove-credits',
  overrideAction('REMOVE_CREDITS', (pkg, body) => {
    const amount = body.amount;
    if (!Number.isInteger(amount) || amount <= 0) throw new Error('amount must be a positive whole number');
    if (pkg.credits_total - amount < pkg.credits_used) {
      throw new Error('Cannot remove more credits than remain unused');
    }
    db.prepare('UPDATE packages SET credits_total = credits_total - ?, updated_at = unixepoch() * 1000 WHERE id = ?').run(amount, pkg.id);
    const updated = loadFresh(pkg.id);
    logCreditTransaction(updated, 'ADMIN_ADJUSTMENT', -amount, body.reason || 'Admin removed credits');
  })
);

module.exports = router;
