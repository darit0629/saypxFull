const express = require('express');
const db = require('../db');
const { verifyWebhookSignature } = require('../lib/razorpay');
const { fulfillOrder } = require('../lib/fulfillOrder');

const router = express.Router();

// The authoritative activation path - unlike the client /verify callback,
// this fires even if the customer's browser closed right after paying.
// Razorpay retries delivery on anything but a 2xx response, and legitimately
// re-sends the same event more than once as normal behavior (not an error
// case) - both need to be safe to call repeatedly.
router.post('/', (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  if (!signature || !req.rawBody || !verifyWebhookSignature(req.rawBody, signature)) {
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const event = req.body || {};
  const payment = event.payload && event.payload.payment && event.payload.payment.entity;

  // Razorpay's webhook payload doesn't carry a dedicated top-level event id
  // in every configuration, so the dedupe key is built from data guaranteed
  // unique per real payment instead: the event type + the payment's own id.
  const dedupeKey = `${event.event || 'unknown'}:${(payment && payment.id) || 'no-payment-id'}`;

  try {
    db.prepare('INSERT INTO webhook_events (razorpay_event_id, event_type) VALUES (?, ?)').run(dedupeKey, event.event || 'unknown');
  } catch (e) {
    // UNIQUE constraint hit = we've already processed this exact delivery.
    // Razorpay just wants a 2xx to stop retrying; this is not an error.
    return res.status(200).json({ ok: true, duplicate: true });
  }

  if (event.event !== 'payment.captured' || !payment) {
    return res.status(200).json({ ok: true, ignored: true });
  }

  const order = db.prepare('SELECT * FROM orders WHERE razorpay_order_id = ?').get(payment.order_id);
  if (!order) {
    return res.status(200).json({ ok: true, ignored: true, reason: 'unknown order' });
  }

  try {
    if (!db.prepare('SELECT id FROM payments WHERE razorpay_payment_id = ?').get(payment.id)) {
      db.prepare(
        `INSERT INTO payments (order_id, razorpay_payment_id, status, raw_payload_json)
         VALUES (?, ?, 'CAPTURED', ?)`
      ).run(order.id, payment.id, JSON.stringify(event));
    }
    // fulfillOrder is itself idempotent (checks for an existing package on
    // this order first) - this is the second layer of duplicate protection,
    // covering the case where /verify already ran for the same order.
    fulfillOrder(order.id);
    res.status(200).json({ ok: true });
  } catch (e) {
    // Signature was valid but something else broke - a 500 makes Razorpay
    // retry, which is what we want here (unlike the duplicate-event case above).
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
