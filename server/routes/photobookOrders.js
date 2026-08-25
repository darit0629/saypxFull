const express = require('express');
const db = require('../db');
const { serializePlan } = require('./photobookPlans');

const router = express.Router();

function serializeCustomerRef(customer) {
  return customer ? { id: customer.id, email: customer.email, name: customer.name, businessName: customer.business_name } : null;
}

function serializeOrder(row) {
  const customer = db.prepare('SELECT id, email, name, business_name FROM customers WHERE id = ?').get(row.customer_id);
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(row.plan_id);
  return {
    id: row.id,
    customer: serializeCustomerRef(customer),
    plan: plan ? serializePlan(plan) : null,
    amountPaise: row.amount_paise,
    razorpayOrderId: row.razorpay_order_id,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get('/', (req, res) => {
  const { customerId, status } = req.query;
  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params = [];
  if (customerId) {
    sql += ' AND customer_id = ?';
    params.push(customerId);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(serializeOrder));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Order not found' });
  const payments = db.prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC').all(row.id);
  res.json({
    ...serializeOrder(row),
    payments: payments.map((p) => ({
      id: p.id,
      razorpayPaymentId: p.razorpay_payment_id,
      status: p.status,
      createdAt: p.created_at,
    })),
  });
});

module.exports = router;
