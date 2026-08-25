const express = require('express');
const db = require('../db');

const router = express.Router();

// Global searchable ledger across every customer/package - this doubles as
// the audit log of every manual admin credit action (actor_type = 'ADMIN'),
// same rows photobookPackages.js writes on add-credits/remove-credits, plus
// every SYSTEM (renewal, expiry) and CUSTOMER (album created/deleted) entry.
function serializeCreditTransaction(row) {
  const customer = db.prepare('SELECT id, email, name, business_name FROM customers WHERE id = ?').get(row.customer_id);
  const pkg = db.prepare('SELECT id, plan_id FROM packages WHERE id = ?').get(row.package_id);
  const plan = pkg ? db.prepare('SELECT id, name FROM plans WHERE id = ?').get(pkg.plan_id) : null;
  return {
    id: row.id,
    customer: customer ? { id: customer.id, email: customer.email, name: customer.name, businessName: customer.business_name } : null,
    package: pkg ? { id: pkg.id, plan: plan ? { id: plan.id, name: plan.name } : null } : null,
    type: row.type,
    amount: row.amount,
    balanceAfter: row.balance_after,
    actorType: row.actor_type,
    actorId: row.actor_id,
    note: row.note,
    createdAt: row.created_at,
  };
}

router.get('/', (req, res) => {
  const { customerId, type, actorType } = req.query;
  let sql = 'SELECT * FROM credit_transactions WHERE 1=1';
  const params = [];
  if (customerId) {
    sql += ' AND customer_id = ?';
    params.push(customerId);
  }
  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }
  if (actorType) {
    sql += ' AND actor_type = ?';
    params.push(actorType);
  }
  sql += ' ORDER BY created_at DESC LIMIT 500';
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(serializeCreditTransaction));
});

module.exports = router;
