const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const clients = db
    .prepare(
      `SELECT c.*,
        COALESCE(SUM(i.total_amount), 0) AS total_revenue,
        COALESCE(SUM(i.due_amount), 0) AS total_due,
        COUNT(i.id) AS invoice_count
       FROM clients c
       LEFT JOIN invoices i ON i.client_id = c.id
       GROUP BY c.id
       ORDER BY c.name COLLATE NOCASE ASC`
    )
    .all();
  res.json(clients);
});

router.get('/:id', (req, res) => {
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const invoices = db
    .prepare('SELECT * FROM invoices WHERE client_id = ? ORDER BY invoice_date DESC')
    .all(req.params.id);

  const stats = db
    .prepare(
      `SELECT COALESCE(SUM(total_amount),0) AS total_revenue,
              COALESCE(SUM(due_amount),0) AS total_due,
              COUNT(*) AS invoice_count
       FROM invoices WHERE client_id = ?`
    )
    .get(req.params.id);

  res.json({ ...client, ...stats, invoices });
});

router.post('/', (req, res) => {
  const { name, phone, email, address, businessName, gstin, notes } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Client name is required' });

  const result = db
    .prepare(
      `INSERT INTO clients (name, phone, email, address, business_name, gstin, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(name.trim(), phone || null, email || null, address || null, businessName || null, gstin || null, notes || null);

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(client);
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Client not found' });

  const { name, phone, email, address, businessName, gstin, notes } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Client name is required' });

  db.prepare(
    `UPDATE clients SET name=?, phone=?, email=?, address=?, business_name=?, gstin=?, notes=? WHERE id=?`
  ).run(name.trim(), phone || null, email || null, address || null, businessName || null, gstin || null, notes || null, req.params.id);

  res.json(db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const invoiceCount = db.prepare('SELECT COUNT(*) AS n FROM invoices WHERE client_id = ?').get(req.params.id).n;

  const tx = db.transaction(() => {
    if (invoiceCount > 0) {
      // Preserve invoice history: snapshot the client's name onto their invoices
      // before detaching them, rather than blocking deletion outright.
      db.prepare('UPDATE invoices SET client_name_snapshot = ?, client_id = NULL WHERE client_id = ?').run(
        client.name,
        req.params.id
      );
    }
    db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
  });
  tx();

  res.json({ ok: true, invoicesPreserved: invoiceCount });
});

module.exports = router;
