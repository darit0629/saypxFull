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
// Top-ups only ever add credits to an already-existing package - no new
// package, no expiry change ("the top-up rides the main plan's time
// period"). Kept separate from the purchase/renewal path below since the
// two have almost nothing in common once you strip out "insert a ledger row
// and mark the order PAID."
function fulfillTopup(order) {
  const pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(order.package_id);
  if (!pkg) throw new Error('Package not found for top-up order');
  const creditsGranted = order.credits_purchased;

  return db.transaction(() => {
    db.prepare('UPDATE packages SET credits_total = credits_total + ?, updated_at = unixepoch() * 1000 WHERE id = ?').run(creditsGranted, pkg.id);
    const updated = db.prepare('SELECT * FROM packages WHERE id = ?').get(pkg.id);

    db.prepare(
      `INSERT INTO credit_transactions (package_id, customer_id, type, amount, balance_after, actor_type, actor_id, note)
       VALUES (?, ?, 'CREDIT_TOPUP', ?, ?, 'SYSTEM', 'razorpay', ?)`
    ).run(pkg.id, order.customer_id, creditsGranted, updated.credits_total - updated.credits_used, `Order #${order.id}, credit top-up`);

    db.prepare("UPDATE orders SET status = 'PAID', updated_at = unixepoch() * 1000 WHERE id = ?").run(order.id);

    return updated;
  })();
}

function fulfillOrder(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) throw new Error('Order not found');

  const already = db.prepare('SELECT * FROM packages WHERE order_id = ?').get(orderId);
  if (already) return already;

  if (order.order_kind === 'TOPUP') {
    // A top-up never becomes packages.order_id (that column tracks the
    // purchase/renewal that created/last-renewed the package, not every
    // top-up against it), so the idempotency check above can't catch a
    // double-fulfill here - guard on the order's own status instead.
    if (order.status === 'PAID') return db.prepare('SELECT * FROM packages WHERE id = ?').get(order.package_id);
    return fulfillTopup(order);
  }

  const plan = db.prepare('SELECT * FROM plans WHERE id = ?').get(order.plan_id);
  if (!plan) throw new Error('Plan not found for order');

  // Custom plans vary in quantity per order, and a FIXED plan's duration can
  // vary per order too (duration tiers) - the order itself, not the plan, is
  // the source of truth for both. For a FIXED plan, credits_purchased was
  // set by customerOrders.js to plan.credits regardless of the tier chosen
  // (see resolveFixedTier there) - a longer duration tier only ever changes
  // durationDaysGranted/the price paid, never creditsGranted.
  const durationDaysGranted = Number.isInteger(order.duration_days_purchased) ? order.duration_days_purchased : plan.duration_days;
  const durationMs = durationDaysGranted * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const creditsGranted = Number.isInteger(order.credits_purchased) ? order.credits_purchased : plan.credits;

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
      ).run(creditsGranted, newExpiry, order.id, existing.id);
      pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(existing.id);
    } else {
      const insert = db
        .prepare(
          `INSERT INTO packages (customer_id, plan_id, order_id, credits_total, starts_at, expires_at, computed_status)
           VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')`
        )
        .run(order.customer_id, order.plan_id, order.id, creditsGranted, now, now + durationMs);
      pkg = db.prepare('SELECT * FROM packages WHERE id = ?').get(insert.lastInsertRowid);
    }

    db.prepare(
      `INSERT INTO credit_transactions (package_id, customer_id, type, amount, balance_after, actor_type, actor_id, note)
       VALUES (?, ?, ?, ?, ?, 'SYSTEM', 'razorpay', ?)`
    ).run(
      pkg.id,
      order.customer_id,
      existing ? 'PACKAGE_RENEWAL' : 'PACKAGE_PURCHASE',
      creditsGranted,
      pkg.credits_total - pkg.credits_used,
      `Order #${order.id}, plan "${plan.name}"`
    );

    db.prepare("UPDATE orders SET status = 'PAID', updated_at = unixepoch() * 1000 WHERE id = ?").run(order.id);

    return pkg;
  })();

  return result;
}

module.exports = { fulfillOrder };
