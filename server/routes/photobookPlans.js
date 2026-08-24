const express = require('express');
const db = require('../db');

const router = express.Router();

function serializePlan(row) {
  return {
    id: row.id,
    name: row.name,
    credits: row.credits,
    durationDays: row.duration_days,
    basePricePaise: row.base_price_paise,
    discountPaise: row.discount_paise,
    finalPricePaise: row.final_price_paise,
    features: JSON.parse(row.features_json || '[]'),
    isActive: !!row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
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
  const { name, credits, durationDays, basePricePaise, discountPaise, features, sortOrder } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!Number.isInteger(credits) || credits <= 0) return res.status(400).json({ error: 'Credits must be a positive whole number' });
  if (!Number.isInteger(durationDays) || durationDays <= 0) return res.status(400).json({ error: 'Duration (days) must be a positive whole number' });
  if (!Number.isInteger(basePricePaise) || basePricePaise < 0) return res.status(400).json({ error: 'Base price is required' });

  const discount = Number.isInteger(discountPaise) && discountPaise > 0 ? discountPaise : 0;
  const finalPrice = Math.max(0, basePricePaise - discount);

  const result = db
    .prepare(
      `INSERT INTO plans (name, credits, duration_days, base_price_paise, discount_paise, final_price_paise, features_json, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(name.trim(), credits, durationDays, basePricePaise, discount, finalPrice, JSON.stringify(features || []), sortOrder || 0);

  const row = db.prepare('SELECT * FROM plans WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(serializePlan(row));
});

router.patch('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM plans WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Plan not found' });

  const { name, credits, durationDays, basePricePaise, discountPaise, features, isActive, sortOrder } = req.body || {};

  const nextBasePrice = Number.isInteger(basePricePaise) ? basePricePaise : existing.base_price_paise;
  const nextDiscount = Number.isInteger(discountPaise) ? discountPaise : existing.discount_paise;
  const finalPrice = Math.max(0, nextBasePrice - nextDiscount);

  db.prepare(
    `UPDATE plans SET
      name = COALESCE(?, name),
      credits = COALESCE(?, credits),
      duration_days = COALESCE(?, duration_days),
      base_price_paise = ?,
      discount_paise = ?,
      final_price_paise = ?,
      features_json = COALESCE(?, features_json),
      is_active = COALESCE(?, is_active),
      sort_order = COALESCE(?, sort_order),
      updated_at = unixepoch() * 1000
    WHERE id = ?`
  ).run(
    name || null,
    Number.isInteger(credits) ? credits : null,
    Number.isInteger(durationDays) ? durationDays : null,
    nextBasePrice,
    nextDiscount,
    finalPrice,
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
