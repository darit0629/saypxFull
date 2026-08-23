const express = require('express');
const db = require('../db');
const { deriveDisplayStatus } = require('../lib/invoiceCalc');

const router = express.Router();

router.get('/', (req, res) => {
  const revenue = db.prepare('SELECT COALESCE(SUM(total_amount),0) AS v FROM invoices').get().v;
  const expenses = db.prepare('SELECT COALESCE(SUM(amount),0) AS v FROM expenses').get().v;

  const invoices = db
    .prepare(
      `SELECT i.*, COALESCE(c.name, i.client_name_snapshot, 'Unknown Client') AS client_name
       FROM invoices i LEFT JOIN clients c ON c.id = i.client_id`
    )
    .all()
    .map((inv) => ({ ...inv, display_status: deriveDisplayStatus(inv) }));

  const counts = { total: invoices.length, paid: 0, due: 0, overdue: 0 };
  for (const inv of invoices) {
    if (inv.display_status === 'paid') counts.paid++;
    else if (inv.display_status === 'overdue') counts.overdue++;
    else counts.due++;
  }

  const recent = invoices
    .slice()
    .sort((a, b) => b.invoice_date - a.invoice_date)
    .slice(0, 10)
    .map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoice_number,
      clientName: inv.client_name,
      date: inv.invoice_date,
      amount: inv.total_amount,
      status: inv.display_status,
    }));

  res.json({
    totalRevenue: revenue,
    totalExpenses: expenses,
    netProfit: Math.round((revenue - expenses) * 100) / 100,
    invoiceCounts: counts,
    recentTransactions: recent,
  });
});

module.exports = router;
