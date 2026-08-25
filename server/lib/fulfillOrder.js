const db = require('../db');

// Turns a PAID order into an active package + a PACKAGE_PURCHASE ledger entry.
// Called from exactly one place by both the client-verify route and the
// webhook route, so there's only ever one implementation of "what a payment
// actually does" - critical for the duplicate-payment-protection requirement.
// Never touches Saypxmain - album codes/QR links are structurally guaranteed
// to survive any purchase/renewal event since nothing here calls the album
// engine at all.
//
// Idempotent: if this order has already been fulfilled (a package already
// references it), returns the existing package instead of creating a
// duplicate - this is what makes "payment succeeds twice" (client callback
// AND webhook both firing) safe to call this function from both places.
function fulfillOrder(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) throw new Error('Order not found');

  const already = db.prepare('SELECT * FROM packages WHERE order_id = ?').get(orderId);
  if (already) return already;

  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(order.plan_id);
  if (!plan) throw new Error('Plan not found for order');

  const durationMs = plan.duration_days * 24 * 60 * 60 * 1000;
  const now = Date.now();

  // Renewal: reuse the customer's existing package for this exact plan if one
  // exists and has no restrictive admin override - extends credits/expiry on
  // the same row rather than spawning a parallel one. A SUSPENDED/CANCELLED
  // package is deliberately left alone (a payment must never silently
  // override an admin decision) - a fresh package row is created instead.
  const existing = db
    .prepare(
      `SELECT * FROM packages WHERE customer_id = ? AND plan_id = ?
       AND admin_override_status IS NULL
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(order.customer_id, order.plan_id);

  const result = db.transaction(() => {
    let pkg;
    if (existing) {
      const newExpiry = Math.max(existing.expires_at || 0, now) + durationMs;
      db.prepare(
        `UPDATE packages SET credits_total = credits_total + ?, expires_at = ?, order_id = ?, updated_at = unixepoch() * 1000
         WHERE id = ?`
      ).run(plan.credits, newExpiry, order.id, existing.id);
      pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(existing.id);
    } else {
      const insert = db
        .prepare(
          `INSERT INTO packages (customer_id, plan_id, order_id, credits_total, starts_at, expires_at, computed_status)
           VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`
        )
        .run(order.customer_id, order.plan_id, order.id, plan.credits, now, now + durationMs);
      pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(insert.lastInsertRowid);
    }

    db.prepare(
      `INSERT INTO credit_transactions (package_id, customer_id, type, amount, balance_after, actor_type, actor_id, note)
       VALUES (?, ?, ?, ?, ?, 'SYSTEM', 'razorpay', ?)`
    ).run(
      pkg.id,
      order.customer_id,
      existing ? 'PACKAGE_RENEWAL' : 'PACKAGE_PURCHASE',
      plan.credits,
      pkg.credits_total - pkg.credits_used,
      `Order #${order.id}, plan "${plan.name}"`
    );

    db.prepare("UPDATE orders SET status = 'PAID', updated_at = unixepoch() * 1000 WHERE id = ?").run(order.id);

    return pkg;
  })();

  return result;
}

module.exports = { fulfillOrder };
