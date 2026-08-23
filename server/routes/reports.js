const express = require('express');
const db = require('../db');
const { deriveDisplayStatus } = require('../lib/invoiceCalc');

const router = express.Router();

const PERIOD_MS = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
  yearly: 365 * 24 * 60 * 60 * 1000,
};

router.get('/', (req, res) => {
  const period = req.query.period || 'monthly';
  const cutoff = Date.now() - (PERIOD_MS[period] || PERIOD_MS.monthly);

  const invoices = db
    .prepare(
      `SELECT i.*, COALESCE(c.name, i.client_name_snapshot, 'Unknown Client') AS client_name
       FROM invoices i LEFT JOIN clients c ON c.id = i.client_id`
    )
    .all()
    .map((inv) => ({ ...inv, display_status: deriveDisplayStatus(inv) }));

  const expenses = db.prepare('SELECT * FROM expenses').all();

  const inPeriod = invoices.filter((inv) => inv.invoice_date >= cutoff);
  const expensesInPeriod = expenses.filter((e) => e.expense_date >= cutoff);

  const totalRevenue = inPeriod.reduce((sum, i) => sum + i.total_amount, 0);
  const totalReceived = inPeriod.reduce((sum, i) => sum + i.received_amount, 0);
  const totalDue = inPeriod.reduce((sum, i) => sum + i.due_amount, 0);
  const totalExpenses = expensesInPeriod.reduce((sum, e) => sum + e.amount, 0);
  const clientIds = new Set(inPeriod.map((i) => i.client_id).filter(Boolean));

  // Monthly revenue/expense trend for the last 6 months, for the chart.
  const now = new Date();
  const trend = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = d.getTime();
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1).getTime();
    const monthLabel = d.toLocaleDateString('en-IN', { month: 'short' });
    const rev = invoices
      .filter((inv) => inv.invoice_date >= start && inv.invoice_date < end)
      .reduce((sum, inv) => sum + inv.total_amount, 0);
    const exp = expenses
      .filter((e) => e.expense_date >= start && e.expense_date < end)
      .reduce((sum, e) => sum + e.amount, 0);
    trend.push({ month: monthLabel, revenue: rev, expenses: exp });
  }

  const statusBreakdown = [
    { name: 'Paid', value: inPeriod.filter((i) => i.display_status === 'paid').length },
    { name: 'Partial', value: inPeriod.filter((i) => i.display_status === 'partial').length },
    { name: 'Unpaid', value: inPeriod.filter((i) => i.display_status === 'unpaid').length },
    { name: 'Overdue', value: inPeriod.filter((i) => i.display_status === 'overdue').length },
  ].filter((s) => s.value > 0);

  const clientRevenue = {};
  for (const inv of inPeriod) {
    clientRevenue[inv.client_name] = (clientRevenue[inv.client_name] || 0) + inv.total_amount;
  }
  const topClients = Object.entries(clientRevenue)
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  res.json({
    period,
    totalRevenue,
    netProfit: Math.round((totalRevenue - totalExpenses) * 100) / 100,
    totalDue,
    totalReceived,
    totalClients: clientIds.size,
    totalBills: inPeriod.length,
    trend,
    statusBreakdown,
    topClients,
  });
});

module.exports = router;
