const express = require('express');
const db = require('../db');
const { razorpay, KEY_ID, verifyPaymentSignature } = require('../lib/razorpay');
const { fulfillOrder } = require('../lib/fulfillOrder');

const router = express.Router();

function serializeOrder(row) {
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(row.plan_id);
  return {
    id: row.id,
    plan: plan ? { id: plan.id, name: plan.name, credits: plan.credits, durationDays: plan.duration_days } : null,
    amountPaise: row.amount_paise,
    status: row.status,
    createdAt: row.created_at,
  };
}

router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC')
    .all(req.customerSession.customerId);
  res.json(rows.map(serializeOrder));
});

router.post('/', async (req, res) => {
  const customerId = req.customerSession.customerId;
  const { planId } = req.body || {};
  const plan = db.prepare('SELECT * FROM plans WHERE id = ? AND is_active = 1').get(planId);
  if (!plan) return res.status(400).json({ error: 'Plan not found' });

  try {
    const receipt = `saypx_${customerId}_${Date.now()}`;
    const rzpOrder = await razorpay.orders.create({
      amount: plan.final_price_paise,
      currency: 'INR',
      receipt,
    });

    const result = db
      .prepare(
        `INSERT INTO orders (customer_id, plan_id, amount_paise, razorpay_order_id, status)
         VALUES (?, ?, ?, ?, 'CREATED')`
      )
      .run(customerId, plan.id, plan.final_price_paise, rzpOrder.id);

    res.status(201).json({
      orderId: result.lastInsertRowid,
      razorpayOrderId: rzpOrder.id,
      amountPaise: plan.final_price_paise,
      currency: 'INR',
      keyId: KEY_ID,
      planName: plan.name,
    });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to create order' });
  }
});

// Client-side callback path, fired after Razorpay Checkout's success handler.
// This is the fast path for the common case, but is NOT the source of truth -
// the webhook route is authoritative for "payment succeeded but the browser
// closed before this ever ran."
router.post('/:id/verify', (req, res) => {
  const customerId = req.customerSession.customerId;
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND customer_id = ?').get(req.params.id, customerId);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.razorpay_order_id !== razorpay_order_id) {
    return res.status(400).json({ error: 'Order mismatch' });
  }

  if (!verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    return res.status(400).json({ error: 'Payment verification failed' });
  }

  try {
    if (!db.prepare('SELECT id FROM payments WHERE razorpay_payment_id = ?').get(razorpay_payment_id)) {
      db.prepare(
        `INSERT INTO payments (order_id, razorpay_payment_id, razorpay_signature, status)
         VALUES (?, ?, ?, 'CAPTURED')`
      ).run(order.id, razorpay_payment_id, razorpay_signature);
    }
    const pkg = fulfillOrder(order.id);
    res.json({ ok: true, packageId: pkg.id });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to activate package' });
  }
});

module.exports = router;
