const express = require('express');
const db = require('../db');
const { razorpay, KEY_ID, verifyPaymentSignature } = require('../lib/razorpay');
const { fulfillOrder } = require('../lib/fulfillOrder');
const { refreshPackageStatus } = require('../lib/packageStatus');

const router = express.Router();

function serializeOrder(row) {
  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(row.plan_id);
  return {
    id: row.id,
    kind: row.order_kind,
    plan: plan ? { id: plan.id, name: plan.name, credits: plan.credits, durationDays: plan.duration_days } : null,
    creditsPurchased: row.credits_purchased,
    amountPaise: row.amount_paise,
    status: row.status,
    createdAt: row.created_at,
  };
}

// A FIXED plan's primary duration_days/final_price_paise is tier zero;
// duration_options_json holds any additional selectable tiers. Returns null
// if the requested duration isn't one of this plan's actual tiers.
//
// Deliberately extracts ONLY durationDays/finalPricePaise here, never a
// tier's `credits` field - the core business rule is "longer duration never
// means more credits", so the caller below always uses plan.credits for the
// actual entitlement regardless of which tier this resolves to. A tier's
// `credits` (present in the stored JSON, forced equal to plan.credits by
// photobookPlans.js) exists for display/self-documentation, not as a value
// this purchase path is allowed to read.
function resolveFixedTier(plan, requestedDurationDays) {
  if (requestedDurationDays === undefined || requestedDurationDays === null || requestedDurationDays === plan.duration_days) {
    return { durationDays: plan.duration_days, finalPricePaise: plan.final_price_paise };
  }
  const options = JSON.parse(plan.duration_options_json || '[]');
  const match = options.find((o) => o.durationDays === requestedDurationDays);
  return match ? { durationDays: match.durationDays, finalPricePaise: match.finalPricePaise } : null;
}

// CUSTOM plans: the customer picks a quantity AND a duration - each
// duration carries its own percentage discount off (credits * price per
// credit), e.g. 1 year at 0%, 3 years at 18%. No quantity/volume discount -
// deliberately kept simple. Falls back to the plan's own duration_days at
// 0% if the admin hasn't configured any custom_duration_options_json yet.
function resolveCustomDuration(plan, requestedDurationDays) {
  const options = JSON.parse(plan.custom_duration_options_json || '[]');
  if (options.length === 0) {
    if (requestedDurationDays === undefined || requestedDurationDays === null || requestedDurationDays === plan.duration_days) {
      return { durationDays: plan.duration_days, discountPercent: 0 };
    }
    return null;
  }
  const match = options.find((o) => o.durationDays === requestedDurationDays);
  return match ? { durationDays: match.durationDays, discountPercent: match.discountPercent } : null;
}

// Same "usable" definition checkEntitlement (customerAlbums.js) uses to gate
// album creation - a package you can't create albums with shouldn't be
// toppable either. Deliberately ignores credits_used/credits_total (topping
// up is exactly for when credits are low or exhausted).
function isPackageUsable(pkg) {
  if (pkg.admin_override_status === 'SUSPENDED' || pkg.admin_override_status === 'CANCELLED') return false;
  if (pkg.computed_status !== 'ACTIVE' && pkg.computed_status !== 'EXPIRING_SOON' && pkg.admin_override_status !== 'FORCE_ACTIVE') return false;
  return true;
}

router.get('/', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC')
    .all(req.customerSession.customerId);
  res.json(rows.map(serializeOrder));
});

router.post('/', async (req, res) => {
  const customerId = req.customerSession.customerId;
  const { kind } = req.body || {};

  if (kind === 'TOPUP') {
    const { packageId, credits } = req.body || {};
    const pkg = refreshPackageStatus(db, packageId);
    if (!pkg || String(pkg.customer_id) !== String(customerId)) return res.status(404).json({ error: 'Package not found' });
    if (!isPackageUsable(pkg)) return res.status(400).json({ error: 'This package cannot be topped up right now' });
    if (!Number.isInteger(credits) || credits <= 0) return res.status(400).json({ error: 'Choose a positive number of credits' });

    const settings = db.prepare('SELECT topup_price_per_credit_paise FROM photo_book_settings WHERE id = 1').get();
    const topupRate = settings && settings.topup_price_per_credit_paise;
    if (!Number.isInteger(topupRate) || topupRate <= 0) return res.status(400).json({ error: 'Credit top-ups are not available right now' });

    const amountPaise = credits * topupRate;
    try {
      const receipt = `saypx_topup_${customerId}_${Date.now()}`;
      const rzpOrder = await razorpay.orders.create({ amount: amountPaise, currency: 'INR', receipt });
      const result = db
        .prepare(
          `INSERT INTO orders (customer_id, plan_id, amount_paise, razorpay_order_id, status, credits_purchased, order_kind, package_id)
           VALUES (?, ?, ?, ?, 'CREATED', ?, 'TOPUP', ?)`
        )
        .run(customerId, pkg.plan_id, amountPaise, rzpOrder.id, credits, pkg.id);

      return res.status(201).json({
        orderId: result.lastInsertRowid,
        razorpayOrderId: rzpOrder.id,
        amountPaise,
        currency: 'INR',
        keyId: KEY_ID,
        planName: 'Credit Top-Up',
      });
    } catch (e) {
      return res.status(500).json({ error: e.message || 'Failed to create order' });
    }
  }

  const { planId, credits, durationDays } = req.body || {};
  const plan = db.prepare('SELECT * FROM plans WHERE id = ? AND is_active = 1').get(planId);
  if (!plan) return res.status(400).json({ error: 'Plan not found' });

  let amountPaise;
  let creditsPurchased;
  let resolvedDurationDays;
  if (plan.plan_type === 'CUSTOM') {
    if (!Number.isInteger(credits) || credits < plan.min_credits) {
      return res.status(400).json({ error: `Choose at least ${plan.min_credits} credits for this plan` });
    }
    if (Number.isInteger(plan.max_credits) && credits > plan.max_credits) {
      return res.status(400).json({ error: `Choose at most ${plan.max_credits} credits for this plan` });
    }
    const duration = resolveCustomDuration(plan, durationDays);
    if (!duration) return res.status(400).json({ error: 'That duration is not available for this plan' });
    const basePaise = credits * plan.price_per_credit_paise;
    amountPaise = Math.round(basePaise * (1 - duration.discountPercent / 100));
    // Always exactly the quantity the customer chose, regardless of
    // duration - a 5-year purchase of 350 albums grants 350 credits, not
    // 350 * 5. Duration only changes validity and the discount applied.
    creditsPurchased = credits;
    resolvedDurationDays = duration.durationDays;
  } else {
    const tier = resolveFixedTier(plan, durationDays);
    if (!tier) return res.status(400).json({ error: 'That duration is not available for this plan' });
    amountPaise = tier.finalPricePaise;
    // Always plan.credits, regardless of which duration tier was chosen -
    // a 3-year purchase grants the exact same credits as a 1-year one, only
    // the price and validity period differ. Never plan.credits * years.
    creditsPurchased = plan.credits;
    resolvedDurationDays = tier.durationDays;
  }

  try {
    const receipt = `saypx_${customerId}_${Date.now()}`;
    const rzpOrder = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt,
    });

    const result = db
      .prepare(
        `INSERT INTO orders (customer_id, plan_id, amount_paise, razorpay_order_id, status, credits_purchased, duration_days_purchased)
         VALUES (?, ?, ?, ?, 'CREATED', ?, ?)`
      )
      .run(customerId, plan.id, amountPaise, rzpOrder.id, creditsPurchased, resolvedDurationDays);

    res.status(201).json({
      orderId: result.lastInsertRowid,
      razorpayOrderId: rzpOrder.id,
      amountPaise,
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
