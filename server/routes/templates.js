const express = require('express');
const db = require('../db');
const { generateInvoicePdf } = require('../lib/pdf');

const router = express.Router();

const SAMPLE_INVOICE = {
  invoice_number: 'INV-2026-0001',
  invoice_date: Date.now(),
  due_date: Date.now() + 7 * 24 * 60 * 60 * 1000,
  subtotal: 50000,
  discount: 2000,
  tax: 0,
  total_amount: 48000,
  received_amount: 20000,
  due_amount: 28000,
  status: 'partial',
  display_status: 'partial',
  notes: 'Thank you for your business.',
  terms: 'Payment due within 7 days.',
  event_date: new Date(new Date().getFullYear(), new Date().getMonth() + 2, 29).getTime(),
  event_location: 'Payradanga',
  client_name: 'Sample Client',
  client_address: '123 Sample Street, Kolkata',
  client_phone: '+91 98765 43210',
  client_email: 'client@example.com',
  items: [
    { description: 'Wedding Photography Package', quantity: 1, unit: null, rate: 35000, amount: 35000 },
    { description: 'Pre-Wedding Shoot', quantity: 1, unit: null, rate: 15000, amount: 15000 },
  ],
};

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM invoice_templates ORDER BY id DESC').all();
  res.json(rows.map((r) => ({ ...r, elements: JSON.parse(r.elements_json) })));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM invoice_templates WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Template not found' });
  res.json({ ...row, elements: JSON.parse(row.elements_json) });
});

router.post('/', (req, res) => {
  const { name, elements, backgroundUrl } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Template name is required' });

  const result = db
    .prepare('INSERT INTO invoice_templates (name, elements_json, background_url) VALUES (?, ?, ?)')
    .run(name.trim(), JSON.stringify(elements || []), backgroundUrl || null);

  const row = db.prepare('SELECT * FROM invoice_templates WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...row, elements: JSON.parse(row.elements_json) });
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM invoice_templates WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Template not found' });

  const { name, elements, backgroundUrl } = req.body || {};
  db.prepare('UPDATE invoice_templates SET name=?, elements_json=?, background_url=? WHERE id=?').run(
    name?.trim() || existing.name,
    JSON.stringify(elements ?? JSON.parse(existing.elements_json)),
    backgroundUrl !== undefined ? backgroundUrl : existing.background_url,
    req.params.id
  );

  const row = db.prepare('SELECT * FROM invoice_templates WHERE id = ?').get(req.params.id);
  res.json({ ...row, elements: JSON.parse(row.elements_json) });
});

router.post('/:id/set-default', (req, res) => {
  const existing = db.prepare('SELECT * FROM invoice_templates WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Template not found' });

  const tx = db.transaction(() => {
    db.prepare('UPDATE invoice_templates SET is_default = 0').run();
    db.prepare('UPDATE invoice_templates SET is_default = 1 WHERE id = ?').run(req.params.id);
  });
  tx();

  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM invoice_templates WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Template not found' });
  db.prepare('DELETE FROM invoice_templates WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/:id/duplicate', (req, res) => {
  const existing = db.prepare('SELECT * FROM invoice_templates WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Template not found' });

  const result = db
    .prepare('INSERT INTO invoice_templates (name, elements_json, background_url) VALUES (?, ?, ?)')
    .run(existing.name + ' Copy', existing.elements_json, existing.background_url);

  const row = db.prepare('SELECT * FROM invoice_templates WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...row, elements: JSON.parse(row.elements_json) });
});

router.get('/:id/preview', async (req, res) => {
  const row = db.prepare('SELECT * FROM invoice_templates WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Template not found' });
  const template = { ...row, elements: JSON.parse(row.elements_json) };
  const business = db.prepare('SELECT * FROM business_profile WHERE id = 1').get() || {};

  try {
    const buffer = await generateInvoicePdf(SAMPLE_INVOICE, business, template);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="template-preview.pdf"');
    res.send(buffer);
  } catch (e) {
    console.error('Template preview failed:', e);
    res.status(500).json({ error: 'Preview generation failed' });
  }
});

module.exports = router;
