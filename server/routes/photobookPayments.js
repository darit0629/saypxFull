const express = require('express');
const db = require('../db');

const router = express.Router();

// Read-only reconciliation view against Razorpay's own dashboard - never
// exposes raw_payload_json (large, and mostly Razorpay-internal fields) or
// razorpay_signature (write-only, verified once at intake time).
function serializePayment(row) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(row.order_id);
  const customer = order ? db.prepare('SELECT id, email, name, business_name FROM customers WHERE id = ?').get(order.customer_id) : null;
  const plan = order ? db.prepare('SELECT id, name FROM plans WHERE id = ?').get(order.plan_id) : null;
  return {
    id: row.id,
    razorpayPaymentId: row.razorpay_payment_id,
    status: row.status,
    createdAt: row.created_at,
    order: order
      ? {
          id: order.id,
          razorpayOrderId: order.razorpay_order_id,
          amountPaise: order.amount_paise,
          status: order.status,
          customer: customer ? { id: customer.id, email: customer.email, name: customer.name, businessName: customer.business_name } : null,
          plan: plan ? { id: plan.id, name: plan.name } : null,
        }
      : null,
  };
}

router.get('/', (req, res) => {
  const { status } = req.query;
  let sql = 'SELECT * FROM payments WHERE 1=1';
  const params = [];
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(serializePayment));
});

module.exports = router;
