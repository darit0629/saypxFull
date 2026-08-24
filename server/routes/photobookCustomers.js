const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');

const router = express.Router();

function serializeCustomer(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    businessName: row.business_name,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastLoginAt: row.last_login_at,
  };
}

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM customers ORDER BY created_at DESC').all();
  res.json(rows.map(serializeCustomer));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Customer not found' });
  res.json(serializeCustomer(row));
});

router.post('/', (req, res) => {
  const { email, password, name, phone, businessName } = req.body || {};
  if (!email || !email.trim()) return res.status(400).json({ error: 'Email is required' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const existing = db.prepare('SELECT id FROM customers WHERE email = ?').get(email.trim().toLowerCase());
  if (existing) return res.status(409).json({ error: 'A customer with this email already exists' });

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare(
      'INSERT INTO customers (email, password_hash, name, phone, business_name) VALUES (?, ?, ?, ?, ?)'
    )
    .run(email.trim().toLowerCase(), passwordHash, name || null, phone || null, businessName || null);

  const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(serializeCustomer(row));
});

router.patch('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Customer not found' });

  const { name, phone, businessName, status } = req.body || {};
  if (status && !['ACTIVE', 'DISABLED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  db.prepare(
    `UPDATE customers SET
      name = COALESCE(?, name),
      phone = COALESCE(?, phone),
      business_name = COALESCE(?, business_name),
      status = COALESCE(?, status),
      updated_at = unixepoch() * 1000
    WHERE id = ?`
  ).run(name ?? null, phone ?? null, businessName ?? null, status ?? null, req.params.id);

  const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  res.json(serializeCustomer(updated));
});

router.delete('/:id', (req, res) => {
  const row = db.prepare('SELECT id FROM customers WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Customer not found' });
  db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
