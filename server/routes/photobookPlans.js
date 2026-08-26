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
    maxCredits: row.max_credits,
    pricePerCreditPaise: row.price_per_credit_paise,
    discountPerCreditPaise: row.discount_per_credit_paise,
    customDurationOptions: JSON.parse(row.custom_duration_options_json || '[]'),
    durationOptions: JSON.parse(row.duration_options_json || '[]'),
    features: JSON.parse(row.features_json || '[]'),
    tagline: row.tagline || null,
    icon: row.icon || null,
    themeColor: row.theme_color || null,
    isActive: !!row.is_active,
    isFeatured: !!row.is_featured,
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
// PRICING MODEL: the admin enters only `years` and the final customer price
// per tier - base price and discount are always DERIVED, never entered:
//   basePricePaise = parentBasePricePaise * years   (parent's own base price
//                                                     IS the "1-year base price")
//   discountPaise  = basePricePaise - finalPricePaise
// This is a live relationship, not a snapshot: editing the parent's base
// price re-derives every tier's base/discount next time this runs (see the
// PATCH route's fallback path, and db.js's boot-time normalization pass).
//
// CORE BUSINESS RULE: every tier grants the SAME album credits as the parent
// plan - a longer duration buys longer validity and a bigger discount, never
// more credits. `credits` is therefore forced to `parentCredits` here
// unconditionally - any credits value a caller sends is discarded, not just
// validated. This is the single place that decides what a tier's credits
// are; nothing downstream (order creation, fulfillment) ever reads credits
// from a tier - see customerOrders.js's resolveFixedTier, which deliberately
// only extracts durationDays/finalPricePaise.
function validateDurationOptions(raw, parentCredits, parentBasePricePaise) {
  if (raw === undefined) return undefined; // caller keeps existing value
  if (!Array.isArray(raw)) throw new Error('durationOptions must be an array');
  return raw.map((opt) => {
    const years = opt && opt.years;
    const finalPricePaise = opt && opt.finalPricePaise;
    if (!Number.isInteger(years) || years <= 0) throw new Error('Each duration option needs a positive whole number of years');
    if (!Number.isInteger(finalPricePaise) || finalPricePaise < 0) throw new Error('Each duration option needs a final price');
    const basePricePaise = parentBasePricePaise * years;
    const discountPaise = Math.max(0, basePricePaise - finalPricePaise);
    return {
      years,
      durationDays: years * 365,
      credits: parentCredits,
      basePricePaise,
      discountPaise,
      finalPricePaise,
    };
  });
}

// Re-derives base/discount for tiers already on the plan (years/finalPrice
// unchanged) against the plan's CURRENT base price/credits - used when a
// request edits the plan's base price or credits without also resending
// durationOptions, so tiers never keep stale numbers.
function restampDurationOptions(existingJson, parentCredits, parentBasePricePaise) {
  const tiers = JSON.parse(existingJson || '[]');
  return tiers.map((t) => {
    if (Number.isInteger(t.years) && t.years > 0) {
      const basePricePaise = parentBasePricePaise * t.years;
      const discountPaise = Math.max(0, basePricePaise - t.finalPricePaise);
      return { ...t, credits: parentCredits, basePricePaise, discountPaise };
    }
    return { ...t, credits: parentCredits };
  });
}

// CUSTOM plan duration options: the customer picks BOTH a quantity and a
// duration; each duration carries its own percentage discount off
// (credits * pricePerCreditPaise) - e.g. 6mo/1yr at 0%, 2yr at 10%, 5yr at
// 30%. No quantity-based volume discount - kept deliberately simple per the
// explicit "don't make the first version too complicated" direction.
function validateCustomDurationOptions(raw) {
  if (raw === undefined) return undefined; // caller keeps existing value
  if (!Array.isArray(raw)) throw new Error('customDurationOptions must be an array');
  return raw.map((opt) => {
    const durationDays = opt && opt.durationDays;
    const discountPercent = opt && opt.discountPercent;
    if (!Number.isInteger(durationDays) || durationDays <= 0) throw new Error('Each duration option needs a positive whole number of days');
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) throw new Error('Discount percent must be between 0 and 100');
    return { durationDays, discountPercent };
  });
}

// Custom plans don't have a single credits/price - the customer picks a
// quantity (>= minCredits) and a duration at purchase time. The plain
// credits/base_price_paise/final_price_paise columns stay populated with
// the "buy exactly the minimum, at the first configured duration's
// discount" figures, so every existing consumer of those columns (admin
// Orders/Payments/Credits views, list cards) still shows something
// meaningful without needing to know about plan_type at all.
function deriveCustomPricing(minCredits, pricePerCreditPaise, customDurationOptions) {
  const basePricePaise = minCredits * pricePerCreditPaise;
  const representativeDiscountPercent = customDurationOptions && customDurationOptions[0] ? customDurationOptions[0].discountPercent : 0;
  const discountPaise = Math.round((basePricePaise * representativeDiscountPercent) / 100);
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
    isFeatured,
    tagline,
    icon,
    themeColor,
    // FIXED
    credits,
    basePricePaise,
    discountPaise,
    durationOptions,
    // CUSTOM
    minCredits,
    maxCredits,
    pricePerCreditPaise,
    customDurationOptions,
  } = req.body || {};

  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!Number.isInteger(durationDays) || durationDays <= 0) return res.status(400).json({ error: 'Duration (days) must be a positive whole number' });

  const isCustom = planType === 'CUSTOM';
  let pricing;
  let resolvedCustomDurationOptions = [];
  if (isCustom) {
    if (!Number.isInteger(minCredits) || minCredits <= 0) return res.status(400).json({ error: 'Minimum credits must be a positive whole number' });
    if (maxCredits !== undefined && maxCredits !== null && (!Number.isInteger(maxCredits) || maxCredits < minCredits)) {
      return res.status(400).json({ error: 'Maximum credits must be a whole number >= minimum credits' });
    }
    if (!Number.isInteger(pricePerCreditPaise) || pricePerCreditPaise < 0) return res.status(400).json({ error: 'Price per credit is required' });
    try {
      resolvedCustomDurationOptions = validateCustomDurationOptions(customDurationOptions) || [];
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    pricing = deriveCustomPricing(minCredits, pricePerCreditPaise, resolvedCustomDurationOptions);
    pricing.minCredits = minCredits;
    pricing.maxCredits = Number.isInteger(maxCredits) ? maxCredits : null;
    pricing.pricePerCreditPaise = pricePerCreditPaise;
  } else {
    if (!Number.isInteger(credits) || credits <= 0) return res.status(400).json({ error: 'Credits must be a positive whole number' });
    if (!Number.isInteger(basePricePaise) || basePricePaise < 0) return res.status(400).json({ error: 'Base price is required' });
    const discount = Number.isInteger(discountPaise) && discountPaise > 0 ? discountPaise : 0;
    pricing = { credits, basePricePaise, discountPaise: discount, finalPricePaise: Math.max(0, basePricePaise - discount) };
  }

  let resolvedDurationOptions;
  try {
    resolvedDurationOptions = isCustom ? [] : validateDurationOptions(durationOptions, pricing.credits, pricing.basePricePaise) || [];
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  const result = db
    .prepare(
      `INSERT INTO plans (
         name, plan_type, credits, duration_days, base_price_paise, discount_paise, final_price_paise,
         min_credits, max_credits, price_per_credit_paise, discount_per_credit_paise, duration_options_json,
         custom_duration_options_json, features_json, sort_order, is_featured, tagline, icon, theme_color
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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
      isCustom ? pricing.maxCredits : null,
      isCustom ? pricing.pricePerCreditPaise : null,
      0,
      JSON.stringify(resolvedDurationOptions),
      JSON.stringify(isCustom ? resolvedCustomDurationOptions : []),
      JSON.stringify(features || []),
      sortOrder || 0,
      isFeatured ? 1 : 0,
      tagline || null,
      icon || null,
      themeColor || null
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
    isFeatured,
    sortOrder,
    tagline,
    icon,
    themeColor,
    credits,
    basePricePaise,
    discountPaise,
    durationOptions,
    minCredits,
    maxCredits,
    pricePerCreditPaise,
    customDurationOptions,
  } = req.body || {};

  const nextType = planType === 'CUSTOM' || planType === 'FIXED' ? planType : existing.plan_type;
  const isCustom = nextType === 'CUSTOM';

  let pricing;
  let resolvedCustomDurationOptions = [];
  if (isCustom) {
    const nextMinCredits = Number.isInteger(minCredits) ? minCredits : existing.min_credits;
    const nextMaxCredits = maxCredits === undefined ? existing.max_credits : maxCredits;
    const nextPricePerCredit = Number.isInteger(pricePerCreditPaise) ? pricePerCreditPaise : existing.price_per_credit_paise;
    if (!Number.isInteger(nextMinCredits) || nextMinCredits <= 0) return res.status(400).json({ error: 'Minimum credits must be a positive whole number' });
    if (nextMaxCredits !== null && (!Number.isInteger(nextMaxCredits) || nextMaxCredits < nextMinCredits)) {
      return res.status(400).json({ error: 'Maximum credits must be a whole number >= minimum credits' });
    }
    if (!Number.isInteger(nextPricePerCredit) || nextPricePerCredit < 0) return res.status(400).json({ error: 'Price per credit is required' });
    try {
      resolvedCustomDurationOptions = validateCustomDurationOptions(customDurationOptions) ?? JSON.parse(existing.custom_duration_options_json || '[]');
    } catch (e) {
      return res.status(400).json({ error: e.message });
    }
    pricing = deriveCustomPricing(nextMinCredits, nextPricePerCredit, resolvedCustomDurationOptions);
    pricing.minCredits = nextMinCredits;
    pricing.maxCredits = nextMaxCredits;
    pricing.pricePerCreditPaise = nextPricePerCredit;
  } else {
    const nextCredits = Number.isInteger(credits) ? credits : existing.credits;
    const nextBasePrice = Number.isInteger(basePricePaise) ? basePricePaise : existing.base_price_paise;
    const nextDiscount = Number.isInteger(discountPaise) ? discountPaise : existing.discount_paise;
    pricing = { credits: nextCredits, basePricePaise: nextBasePrice, discountPaise: nextDiscount, finalPricePaise: Math.max(0, nextBasePrice - nextDiscount) };
  }

  // If durationOptions wasn't sent in this request, re-derive the existing
  // tiers' credits/base/discount against the (possibly just-changed) plan
  // credits/base price instead of leaving them untouched - a tier must
  // never keep displaying stale numbers after the parent plan is edited.
  let resolvedDurationOptions;
  try {
    resolvedDurationOptions = isCustom
      ? []
      : validateDurationOptions(durationOptions, pricing.credits, pricing.basePricePaise) ??
        restampDurationOptions(existing.duration_options_json, pricing.credits, pricing.basePricePaise);
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
      max_credits = ?,
      price_per_credit_paise = ?,
      discount_per_credit_paise = 0,
      duration_options_json = ?,
      custom_duration_options_json = ?,
      features_json = COALESCE(?, features_json),
      is_active = COALESCE(?, is_active),
      is_featured = COALESCE(?, is_featured),
      sort_order = COALESCE(?, sort_order),
      tagline = COALESCE(?, tagline),
      icon = COALESCE(?, icon),
      theme_color = COALESCE(?, theme_color),
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
    isCustom ? pricing.maxCredits : null,
    isCustom ? pricing.pricePerCreditPaise : null,
    JSON.stringify(resolvedDurationOptions),
    JSON.stringify(isCustom ? resolvedCustomDurationOptions : []),
    features ? JSON.stringify(features) : null,
    typeof isActive === 'boolean' ? (isActive ? 1 : 0) : null,
    typeof isFeatured === 'boolean' ? (isFeatured ? 1 : 0) : null,
    Number.isInteger(sortOrder) ? sortOrder : null,
    tagline || null,
    icon || null,
    themeColor || null,
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
