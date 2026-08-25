const Razorpay = require('razorpay');
const crypto = require('crypto');

// Test-mode key for now (see server/.env) - the live key belongs to a
// different business (ridepay) on the same Razorpay account and must never
// be touched by this app. Going live here means either getting saypx.in its
// own approved website on that account, or a separate Razorpay account
// entirely - a deliberate decision for later, not something to default into.
const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

if (!KEY_ID || !KEY_SECRET) {
  console.error('Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in .env — package checkout will fail');
}

const razorpay = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });

function verifyPaymentSignature(orderId, paymentId, signature) {
  const expected = crypto.createHmac('sha256', KEY_SECRET || '').update(`${orderId}|${paymentId}`).digest('hex');
  return expected === signature;
}

function verifyWebhookSignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return expected === signature;
}

module.exports = { razorpay, KEY_ID, verifyPaymentSignature, verifyWebhookSignature };
