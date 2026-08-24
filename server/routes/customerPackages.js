const express = require('express');
const db = require('../db');
const { refreshPackageStatus } = require('../lib/packageStatus');
const { serializePlan } = require('./photobookPlans');

const router = express.Router();

// Read-only display data for the customer's own dashboard. This is NOT the
// entitlement enforcement point - that lives server-side at album-creation
// time (Phase 3). A customer here only ever sees their own package(s).
function serializeForCustomer(pkg) {
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(pkg.plan_id);
  return {
    id: pkg.id,
    plan: plan ? serializePlan(plan) : null,
    creditsTotal: pkg.credits_total,
    creditsUsed: pkg.credits_used,
    creditsRemaining: pkg.credits_total - pkg.credits_used,
    startsAt: pkg.starts_at,
    expiresAt: pkg.expires_at,
    status: pkg.admin_override_status === 'SUSPENDED' || pkg.admin_override_status === 'CANCELLED'
      ? pkg.admin_override_status
      : pkg.computed_status,
  };
}

router.get('/current', (req, res) => {
  const customerId = req.customerSession.customerId;
  const rows = db
    .prepare(
      `SELECT * FROM packages WHERE customer_id = ? AND admin_override_status IS NOT 'CANCELLED'
       ORDER BY created_at DESC`
    )
    .all(customerId)
    .map((r) => refreshPackageStatus(db, r.id));

  res.json(rows.map(serializeForCustomer));
});

module.exports = router;
