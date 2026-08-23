// Server-side invoice math — never trust frontend-computed totals for money.
function computeItemAmount(item) {
  const qty = Number(item.quantity) || 0;
  const rate = Number(item.rate) || 0;
  return Math.round(qty * rate * 100) / 100;
}

function computeInvoiceTotals({ items, discount = 0, tax = 0, receivedAmount = 0 }) {
  const subtotal = items.reduce((sum, item) => sum + computeItemAmount(item), 0);
  const discountAmt = Number(discount) || 0;
  const taxAmt = Number(tax) || 0;
  const totalAmount = Math.max(0, Math.round((subtotal - discountAmt + taxAmt) * 100) / 100);
  const received = Math.max(0, Number(receivedAmount) || 0);
  const dueAmount = Math.max(0, Math.round((totalAmount - received) * 100) / 100);

  let status;
  if (dueAmount <= 0 && totalAmount > 0) status = 'paid';
  else if (received > 0) status = 'partial';
  else status = 'unpaid';

  return { subtotal, totalAmount, dueAmount, status, received };
}

// Derived, not stored: an unpaid/partial invoice past its due date displays as overdue.
function deriveDisplayStatus(invoice, now = Date.now()) {
  if (invoice.status === 'paid') return 'paid';
  if (invoice.due_date && invoice.due_date < now) return 'overdue';
  return invoice.status;
}

module.exports = { computeItemAmount, computeInvoiceTotals, deriveDisplayStatus };
