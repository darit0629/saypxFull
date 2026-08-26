const express = require('express');
const db = require('../db');

const router = express.Router();

function serializePlan(row) {
  return {
    id: row.id,
    name: row.name,
    planType: row.plan_type || 'FIXED',
    credits: row.credits,
    durationDays: row.duration_days,
    basePricePaise: row.base_price_paise,
    discountPaise: row.discount_paise,
    finalPricePaise: row.final_price_paise,
    minCredits: row.min_credits,
    pricePerCreditPaise: row.price_per_credit_paise,
    discountPerCreditPaise: row.discount_per_credit_paise,
    durationOptions: JSON.parse(row.duration_options_json || '[]'),
    features: JSON.parse(row.features_json || '[]'),
    isActive: !!row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Extra selectable duration tiers for a FIXED plan (its primary duration_days/
// base_price_paise/discount_paise is always tier zero - these are additional
// ones, e.g. "2 years" / "3 years" with a bigger discount the longer the
// customer commits).
//
// CORE BUSINESS RULE: every tier grants the SAME album credits as the parent
// plan - a longer duration buys longer validity and a bigger discount, never
// more credits. `credits` is therefore forced to `parentCredits` here
// unconditionally - any credits value a caller sends is discarded, not just
// validated, so this can never drift even if a client (admin UI, a future
// API consumer, anything) tries to send something else. This is the single
// place that decides what a tier's credits are; nothing downstream (order
// creation, fulfillment) ever reads credits from a tier - see
// customerOrders.js's resolveFixedTier, which deliberately only extracts
// durationDays/finalPricePaise.
function validateDurationOptions(raw, parentCredits) {
  if (raw === undefined) return undefined; // caller keeps existing value
  if (!Array.isArray(raw)) throw new Error('durationOptions must be an array');
  return raw.map((opt) => {
    const durationDays = opt && opt.durationDays;
    const basePricePaise = opt && opt.basePricePaise;
    const discountPaise = Number.isInteger(opt && opt.discountPaise) && opt.discountPaise > 0 ? opt.discountPaise : 0;
    if (!Number.isInteger(durationDays) || durationDays <= 0) throw new Error('Each duration option needs a positive whole number of days');
    if (!Number.isInteger(basePricePaise) || basePricePaise < 0) throw new Error('Each duration option needs a base price');
    if (discountPaise > basePricePaise) throw new Error('A duration option\'s discount cannot exceed its base price');
    return {
      durationDays,
      credits: parentCredits,
      basePricePaise,
      discountPaise,
      finalPricePaise: Math.max(0, basePricePaise - discountPaise),
    };
  });
}

// Custom plans don't have a single credits/price - the customer picks a
// quantity (>= minCredits) at purchase time. The plain credits/
// base_price_paise/final_price_paise columns stay populated with the "buy
// exactly the minimum" figures, so every existing consumer of those columns
// (admin Orders/Payments/Credits views, list cards) still shows something
// meaningful without needing to know about plan_type at all.
function deriveCustomPricing(minCredits, pricePerCreditPaise, discountPerCreditPaise) {
  const basePricePaise = minCredits * pricePerCreditPaise;
  const discountPaise = minCredits * discountPerCreditPaise;
  return { credits: minCredits, basePricePaise, discountPaise, finalPricePaise: Math.max(0, basePricePaise - discountPaise) };
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM plans ORDER BY sort_order ASC, created_at DESC').all();
  res.json(rows.map(serializePlan));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Plan not found' });
  res.json(serializePlan(row));
});

router.post('/', (req, res) => {
  const {
    name,
    planType,
    durationDays,
    features,
    sortOrder,
    // FIXED
    credits,
    basePricePaise,
    discountPaise,
    durationOptions,
    // CUSTOM
    minCredits,
    pricePerCreditPaise,
    discountPerCreditPaise,
  } = req.body || {};

  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!Number.isInteger(durationDays) || durationDays <= 0) return res.status(400).json({ error: 'Duration (days) must be a positive whole number' });

  const isCustom = planType === 'CUSTOM';
  let pricing;
  if (isCustom) {
    if (!Number.isInteger(minCredits) || minCredits <= 0) return res.status(400).json({ error: 'Minimum credits must be a positive whole number' });
    if (!Number.isInteger(pricePerCreditPaise) || pricePerCreditPaise < 0) return res.status(400).json({ error: 'Price per credit is required' });
    const discount = Number.isInteger(discountPerCreditPaise) && discountPerCreditPaise > 0 ? discountPerCreditPaise : 0;
    if (discount > pricePerCreditPaise) return res.status(400).json({ error: 'Discount per credit cannot exceed the price per credit' });
    pricing = deriveCustomPricing(minCredits, pricePerCreditPaise, discount);
    pricing.minCredits = minCredits;
    pricing.pricePerCreditPaise = pricePerCreditPaise;
    pricing.discountPerCreditPaise = discount;
  } else {
    if (!Number.isInteger(credits) || credits <= 0) return res.status(400).json({ error: 'Credits must be a positive whole number' });
    if (!Number.isInteger(basePricePaise) || basePricePaise < 0) return res.status(400).json({ error: 'Base price is required' });
    const discount = Number.isInteger(discountPaise) && discountPaise > 0 ? discountPaise : 0;
    pricing = { credits, basePricePaise, discountPaise: discount, finalPricePaise: Math.max(0, basePricePaise - discount) };
  }

  let resolvedDurationOptions;
  try {
    resolvedDurationOptions = isCustom ? [] : validateDurationOptions(durationOptions, pricing.credits) || [];
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const result = db
    .prepare(
      `INSERT INTO plans (
         name, plan_type, credits, duration_days, base_price_paise, discount_paise, final_price_paise,
         min_credits, price_per_credit_paise, discount_per_credit_paise, duration_options_json, features_json, sort_order
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      name.trim(),
      isCustom ? 'CUSTOM' : 'FIXED',
      pricing.credits,
      durationDays,
      pricing.basePricePaise,
      pricing.discountPaise,
      pricing.finalPricePaise,
      isCustom ? pricing.minCredits : null,
      isCustom ? pricing.pricePerCreditPaise : null,
      isCustom ? pricing.discountPerCreditPaise : 0,
      JSON.stringify(resolvedDurationOptions),
      JSON.stringify(features || []),
      sortOrder || 0
    );

  const row = db.prepare('SELECT * FROM plans WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(serializePlan(row));
});

router.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Plan not found' });

  const {
    name,
    planType,
    durationDays,
    features,
    isActive,
    sortOrder,
    credits,
    basePricePaise,
    discountPaise,
    durationOptions,
    minCredits,
    pricePerCreditPaise,
    discountPerCreditPaise,
  } = req.body || {};

  const nextType = planType === 'CUSTOM' || planType === 'FIXED' ? planType : existing.plan_type;
  const isCustom = nextType === 'CUSTOM';

  let pricing;
  if (isCustom) {
    const nextMinCredits = Number.isInteger(minCredits) ? minCredits : existing.min_credits;
    const nextPricePerCredit = Number.isInteger(pricePerCreditPaise) ? pricePerCreditPaise : existing.price_per_credit_paise;
    const nextDiscountPerCredit = Number.isInteger(discountPerCreditPaise) ? discountPerCreditPaise : existing.discount_per_credit_paise || 0;
    if (!Number.isInteger(nextMinCredits) || nextMinCredits <= 0) return res.status(400).json({ error: 'Minimum credits must be a positive whole number' });
    if (!Number.isInteger(nextPricePerCredit) || nextPricePerCredit < 0) return res.status(400).json({ error: 'Price per credit is required' });
    if (nextDiscountPerCredit > nextPricePerCredit) return res.status(400).json({ error: 'Discount per credit cannot exceed the price per credit' });
    pricing = deriveCustomPricing(nextMinCredits, nextPricePerCredit, nextDiscountPerCredit);
    pricing.minCredits = nextMinCredits;
    pricing.pricePerCreditPaise = nextPricePerCredit;
    pricing.discountPerCreditPaise = nextDiscountPerCredit;
  } else {
    const nextCredits = Number.isInteger(credits) ? credits : existing.credits;
    const nextBasePrice = Number.isInteger(basePricePaise) ? basePricePaise : existing.base_price_paise;
    const nextDiscount = Number.isInteger(discountPaise) ? discountPaise : existing.discount_paise;
    pricing = { credits: nextCredits, basePricePaise: nextBasePrice, discountPaise: nextDiscount, finalPricePaise: Math.max(0, nextBasePrice - nextDiscount) };
  }

  // If the plan's own credits changed but durationOptions wasn't touched in
  // this request, re-stamp every existing tier's credits to match - a tier
  // must never keep displaying a stale credits figure after the plan's
  // credits are edited.
  let resolvedDurationOptions;
  try {
    resolvedDurationOptions = isCustom
      ? []
      : validateDurationOptions(durationOptions, pricing.credits) ??
        JSON.parse(existing.duration_options_json || '[]').map((t) => ({ ...t, credits: pricing.credits }));
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  db.prepare(
    `UPDATE plans SET
      name = COALESCE(?, name),
      plan_type = ?,
      credits = ?,
      duration_days = COALESCE(?, duration_days),
      base_price_paise = ?,
      discount_paise = ?,
      final_price_paise = ?,
      min_credits = ?,
      price_per_credit_paise = ?,
      discount_per_credit_paise = ?,
      duration_options_json = ?,
      features_json = COALESCE(?, features_json),
      is_active = COALESCE(?, is_active),
      sort_order = COALESCE(?, sort_order),
      updated_at = unixepoch() * 1000
    WHERE id = ?`
  ).run(
    name || null,
    nextType,
    pricing.credits,
    Number.isInteger(durationDays) ? durationDays : null,
    pricing.basePricePaise,
    pricing.discountPaise,
    pricing.finalPricePaise,
    isCustom ? pricing.minCredits : null,
    isCustom ? pricing.pricePerCreditPaise : null,
    isCustom ? pricing.discountPerCreditPaise : 0,
    JSON.stringify(resolvedDurationOptions),
    features ? JSON.stringify(features) : null,
    typeof isActive === 'boolean' ? (isActive ? 1 : 0) : null,
    Number.isInteger(sortOrder) ? sortOrder : null,
    req.params.id
  );

  const row = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id);
  res.json(serializePlan(row));
});

// Soft-disable only - packages reference plans historically, so plans are never
// hard-deleted once any package exists against them.
router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT id FROM plans WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Plan not found' });
  db.prepare('UPDATE plans SET is_active = 0, updated_at = unixepoch() * 1000 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
module.exports.serializePlan = serializePlan;
