const express = require('express');
const db = require('../db');
const { computeInvoiceTotals, deriveDisplayStatus } = require('../lib/invoiceCalc');
const { generateInvoicePdf } = require('../lib/pdf');

const router = express.Router();

function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const row = db
    .prepare(
      `SELECT invoice_number FROM invoices WHERE invoice_number LIKE ? ORDER BY id DESC LIMIT 1`
    )
    .get(`${prefix}%`);
  let next = 1;
  if (row) {
    const n = parseInt(row.invoice_number.slice(prefix.length), 10);
    if (!Number.isNaN(n)) next = n + 1;
  }
  return prefix + String(next).padStart(4, '0');
}

function getFullInvoice(id) {
  const invoice = db
    .prepare(
      `SELECT i.*, COALESCE(c.name, i.client_name_snapshot, 'Unknown Client') AS client_name,
              c.phone AS client_phone, c.email AS client_email, c.address AS client_address
       FROM invoices i
       LEFT JOIN clients c ON c.id = i.client_id
       WHERE i.id = ?`
    )
    .get(id);
  if (!invoice) return null;
  const items = db
    .prepare('SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order ASC, id ASC')
    .all(id);
  return { ...invoice, display_status: deriveDisplayStatus(invoice), items };
}

router.get('/', (req, res) => {
  const { status, search } = req.query;
  let rows = db
    .prepare(
      `SELECT i.*, COALESCE(c.name, i.client_name_snapshot, 'Unknown Client') AS client_name
       FROM invoices i
       LEFT JOIN clients c ON c.id = i.client_id
       ORDER BY i.invoice_date DESC`
    )
    .all()
    .map((inv) => ({ ...inv, display_status: deriveDisplayStatus(inv) }));

  if (status && status !== 'all') {
    rows = rows.filter((inv) => inv.display_status === status);
  }
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    rows = rows.filter(
      (inv) =>
        inv.invoice_number.toLowerCase().includes(q) || inv.client_name.toLowerCase().includes(q)
    );
  }

  res.json(rows);
});

router.get('/:id', (req, res) => {
  const invoice = getFullInvoice(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  res.json(invoice);
});

function saveItems(invoiceId, items) {
  db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(invoiceId);
  const insert = db.prepare(
    `INSERT INTO invoice_items (invoice_id, description, quantity, unit, rate, amount, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  items.forEach((item, idx) => {
    const qty = Number(item.quantity) || 0;
    const rate = Number(item.rate) || 0;
    const amount = Math.round(qty * rate * 100) / 100;
    insert.run(invoiceId, item.description || '', qty, item.unit || null, rate, amount, idx);
  });
}

router.post('/', (req, res) => {
  const { clientId, invoiceDate, dueDate, items, discount, tax, notes, terms, receivedAmount, eventDate, eventLocation } =
    req.body || {};

  if (!clientId) return res.status(400).json({ error: 'Client is required' });
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'At least one line item is required' });

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
  if (!client) return res.status(400).json({ error: 'Selected client does not exist' });

  const totals = computeInvoiceTotals({ items, discount, tax, receivedAmount });
  const invoiceNumber = generateInvoiceNumber();
  const now = Date.now();

  const tx = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO invoices
          (client_id, invoice_number, invoice_date, due_date, subtotal, discount, tax,
           total_amount, received_amount, due_amount, status, notes, terms, event_date, event_location, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        clientId,
        invoiceNumber,
        invoiceDate ? new Date(invoiceDate).getTime() : now,
        dueDate ? new Date(dueDate).getTime() : null,
        totals.subtotal,
        Number(discount) || 0,
        Number(tax) || 0,
        totals.totalAmount,
        totals.received,
        totals.dueAmount,
        totals.status,
        notes || null,
        terms || null,
        eventDate ? new Date(eventDate).getTime() : null,
        eventLocation || null,
        now,
        now
      );
    saveItems(result.lastInsertRowid, items);
    return result.lastInsertRowid;
  });

  const id = tx();
  res.status(201).json(getFullInvoice(id));
});

router.put('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Invoice not found' });

  const { clientId, invoiceDate, dueDate, items, discount, tax, notes, terms, receivedAmount, eventDate, eventLocation } =
    req.body || {};
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'At least one line item is required' });

  const totals = computeInvoiceTotals({
    items,
    discount,
    tax,
    receivedAmount: receivedAmount ?? existing.received_amount,
  });

  const tx = db.transaction(() => {
    db.prepare(
      `UPDATE invoices SET client_id=?, invoice_date=?, due_date=?, subtotal=?, discount=?, tax=?,
        total_amount=?, received_amount=?, due_amount=?, status=?, notes=?, terms=?, event_date=?, event_location=?, updated_at=?
       WHERE id=?`
    ).run(
      clientId || existing.client_id,
      invoiceDate ? new Date(invoiceDate).getTime() : existing.invoice_date,
      dueDate !== undefined ? (dueDate ? new Date(dueDate).getTime() : null) : existing.due_date,
      totals.subtotal,
      Number(discount) || 0,
      Number(tax) || 0,
      totals.totalAmount,
      totals.received,
      totals.dueAmount,
      totals.status,
      notes ?? existing.notes,
      terms ?? existing.terms,
      eventDate !== undefined ? (eventDate ? new Date(eventDate).getTime() : null) : existing.event_date,
      eventLocation !== undefined ? eventLocation : existing.event_location,
      Date.now(),
      req.params.id
    );
    saveItems(req.params.id, items);
  });
  tx();

  res.json(getFullInvoice(req.params.id));
});

router.delete('/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Invoice not found' });
  db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id); // items cascade
  res.json({ ok: true });
});

router.post('/:id/mark-paid', (req, res) => {
  const existing = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Invoice not found' });
  db.prepare(
    `UPDATE invoices SET status='paid', received_amount=total_amount, due_amount=0, updated_at=? WHERE id=?`
  ).run(Date.now(), req.params.id);
  res.json(getFullInvoice(req.params.id));
});

router.post('/:id/duplicate', (req, res) => {
  const source = getFullInvoice(req.params.id);
  if (!source) return res.status(404).json({ error: 'Invoice not found' });

  const invoiceNumber = generateInvoiceNumber();
  const now = Date.now();

  const tx = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO invoices
          (client_id, invoice_number, invoice_date, due_date, subtotal, discount, tax,
           total_amount, received_amount, due_amount, status, notes, terms, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'unpaid', ?, ?, ?, ?)`
      )
      .run(
        source.client_id,
        invoiceNumber,
        now,
        source.due_date,
        source.subtotal,
        source.discount,
        source.tax,
        source.total_amount,
        source.total_amount,
        source.notes,
        source.terms,
        now,
        now
      );
    saveItems(
      result.lastInsertRowid,
      source.items.map((i) => ({ description: i.description, quantity: i.quantity, unit: i.unit, rate: i.rate }))
    );
    return result.lastInsertRowid;
  });

  const id = tx();
  res.status(201).json(getFullInvoice(id));
});

router.get('/:id/pdf', async (req, res) => {
  const invoice = getFullInvoice(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  const business = db.prepare('SELECT * FROM business_profile WHERE id = 1').get() || {};

  let template = null;
  const templateRow = invoice.template_id
    ? db.prepare('SELECT * FROM invoice_templates WHERE id = ?').get(invoice.template_id)
    : db.prepare('SELECT * FROM invoice_templates WHERE is_default = 1 LIMIT 1').get();
  if (templateRow) template = { ...templateRow, elements: JSON.parse(templateRow.elements_json) };

  try {
    const buffer = await generateInvoicePdf(invoice, business, template);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.invoice_number}.pdf"`);
    res.send(buffer);
  } catch (e) {
    console.error('PDF generation failed:', e);
    res.status(500).json({ error: 'PDF generation failed' });
  }
});

module.exports = router;
module.exports.getFullInvoice = getFullInvoice;
