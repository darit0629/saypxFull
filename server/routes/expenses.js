const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM expenses ORDER BY expense_date DESC').all();
  res.json(rows);
});

router.post('/', (req, res) => {
  const { title, amount, category, expenseDate, notes, invoiceId } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: 'Title is required' });
  const amt = Number(amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: 'Amount must be greater than 0' });

  const result = db
    .prepare(
      `INSERT INTO expenses (title, amount, category, expense_date, notes, invoice_id)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      title.trim(),
      amt,
      category || null,
      expenseDate ? new Date(expenseDate).getTime() : Date.now(),
      notes || null,
      invoiceId || null
    );

  res.status(201).json(db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Expense not found' });

  const { title, amount, category, expenseDate, notes } = req.body || {};
  db.prepare(
    `UPDATE expenses SET title=?, amount=?, category=?, expense_date=?, notes=? WHERE id=?`
  ).run(
    title?.trim() || existing.title,
    amount !== undefined ? Number(amount) : existing.amount,
    category ?? existing.category,
    expenseDate ? new Date(expenseDate).getTime() : existing.expense_date,
    notes ?? existing.notes,
    req.params.id
  );

  res.json(db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM expenses WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Expense not found' });
  db.prepare('DELETE FROM expenses WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
