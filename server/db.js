const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'billing.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    business_name TEXT,
    gstin TEXT,
    notes TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
    client_name_snapshot TEXT,
    invoice_number TEXT NOT NULL UNIQUE,
    invoice_date INTEGER NOT NULL,
    due_date INTEGER,
    subtotal REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    tax REAL NOT NULL DEFAULT 0,
    total_amount REAL NOT NULL DEFAULT 0,
    received_amount REAL NOT NULL DEFAULT 0,
    due_amount REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('paid','partial','unpaid','overdue')),
    notes TEXT,
    terms TEXT,
    event_date INTEGER,
    event_location TEXT,
    template_id INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );

  CREATE TABLE IF NOT EXISTS invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    unit TEXT,
    rate REAL NOT NULL DEFAULT 0,
    amount REAL NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    amount REAL NOT NULL,
    category TEXT,
    expense_date INTEGER NOT NULL,
    notes TEXT,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );

  CREATE TABLE IF NOT EXISTS invoice_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    elements_json TEXT NOT NULL DEFAULT '[]',
    background_url TEXT,
    is_default INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );

  CREATE TABLE IF NOT EXISTS business_profile (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    business_name TEXT,
    owner_name TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    address TEXT,
    gstin TEXT,
    pan TEXT,
    bank_details TEXT,
    upi_id TEXT,
    logo_url TEXT,
    currency TEXT NOT NULL DEFAULT 'INR',
    lock_enabled INTEGER NOT NULL DEFAULT 0,
    lock_timeout_minutes INTEGER NOT NULL DEFAULT 5
  );

  CREATE TABLE IF NOT EXISTS webauthn_credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    credential_id TEXT NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    device_label TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );

  CREATE TABLE IF NOT EXISTS mail_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folder TEXT NOT NULL,
    uid INTEGER NOT NULL,
    uid_validity INTEGER NOT NULL,
    message_id TEXT,
    in_reply_to TEXT,
    references_header TEXT,
    subject TEXT,
    from_address TEXT,
    from_name TEXT,
    to_addresses TEXT,
    cc_addresses TEXT,
    date_ts INTEGER NOT NULL,
    snippet TEXT,
    body_text TEXT,
    body_html TEXT,
    has_attachments INTEGER NOT NULL DEFAULT 0,
    is_read INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0,
    synced_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_mail_messages_folder_uid ON mail_messages(folder, uid_validity, uid);
  CREATE INDEX IF NOT EXISTS idx_mail_messages_folder_date ON mail_messages(folder, date_ts DESC);
  CREATE INDEX IF NOT EXISTS idx_mail_messages_message_id ON mail_messages(message_id);

  CREATE TABLE IF NOT EXISTS mail_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL REFERENCES mail_messages(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    content_type TEXT,
    size_bytes INTEGER,
    stored_path TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );

  CREATE INDEX IF NOT EXISTS idx_mail_attachments_message ON mail_attachments(message_id);

  CREATE TABLE IF NOT EXISTS mail_sync_state (
    folder TEXT PRIMARY KEY,
    uid_validity INTEGER,
    last_synced_uid INTEGER NOT NULL DEFAULT 0,
    last_synced_at INTEGER,
    initial_backfill_done INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
  CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
  CREATE INDEX IF NOT EXISTS idx_expenses_invoice ON expenses(invoice_id);

  -- ---- Digital Photo Book customer/package/billing system ----

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT,
    phone TEXT,
    business_name TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DISABLED')),
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    last_login_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    credits INTEGER NOT NULL,
    duration_days INTEGER NOT NULL,
    base_price_paise INTEGER NOT NULL,
    discount_paise INTEGER NOT NULL DEFAULT 0,
    final_price_paise INTEGER NOT NULL,
    features_json TEXT NOT NULL DEFAULT '[]',
    is_active INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    plan_id INTEGER NOT NULL REFERENCES plans(id),
    amount_paise INTEGER NOT NULL,
    razorpay_order_id TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED','PAID','FAILED','CANCELLED')),
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    razorpay_payment_id TEXT NOT NULL UNIQUE,
    razorpay_signature TEXT,
    status TEXT NOT NULL CHECK (status IN ('CAPTURED','FAILED')),
    raw_payload_json TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );

  CREATE TABLE IF NOT EXISTS webhook_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    razorpay_event_id TEXT NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    processed_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );

  -- computed_status (automated, time+credits based) and admin_override_status
  -- (manual admin lever) are deliberately two separate columns - the access
  -- calculation reads both and admin_override_status wins when restrictive.
  -- Never collapse these into one boolean/status field.
  CREATE TABLE IF NOT EXISTS packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    plan_id INTEGER NOT NULL REFERENCES plans(id),
    order_id INTEGER REFERENCES orders(id),
    credits_total INTEGER NOT NULL,
    credits_used INTEGER NOT NULL DEFAULT 0,
    starts_at INTEGER,
    expires_at INTEGER,
    computed_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (computed_status IN ('PENDING','ACTIVE','EXPIRING_SOON','EXPIRED')),
    admin_override_status TEXT CHECK (admin_override_status IN ('SUSPENDED','CANCELLED','FORCE_ACTIVE')),
    admin_override_reason TEXT,
    admin_override_by TEXT,
    admin_override_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );

  CREATE TABLE IF NOT EXISTS credit_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    package_id INTEGER NOT NULL REFERENCES packages(id),
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    type TEXT NOT NULL CHECK (type IN ('PACKAGE_PURCHASE','ALBUM_CREATED','ALBUM_DELETED','CREDIT_REFUND','ADMIN_ADJUSTMENT','PACKAGE_EXPIRY','PACKAGE_RENEWAL')),
    amount INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    album_id INTEGER,
    actor_type TEXT NOT NULL CHECK (actor_type IN ('CUSTOMER','ADMIN','SYSTEM')),
    actor_id TEXT,
    note TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );

  CREATE TABLE IF NOT EXISTS admin_package_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    package_id INTEGER NOT NULL REFERENCES packages(id),
    action TEXT NOT NULL,
    before_json TEXT,
    after_json TEXT,
    reason TEXT,
    performed_by TEXT NOT NULL DEFAULT 'admin',
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );

  -- Singleton, same id=1 pattern as business_profile. Currently just the
  -- EXPIRING_SOON threshold (hardcoded at 7 days before this table existed).
  CREATE TABLE IF NOT EXISTS photo_book_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    expiring_soon_days INTEGER NOT NULL DEFAULT 7,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );

  CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
  CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
  CREATE INDEX IF NOT EXISTS idx_packages_customer ON packages(customer_id);
  CREATE INDEX IF NOT EXISTS idx_credit_transactions_package ON credit_transactions(package_id);
  CREATE INDEX IF NOT EXISTS idx_credit_transactions_customer ON credit_transactions(customer_id);
  CREATE INDEX IF NOT EXISTS idx_admin_package_audit_log_package ON admin_package_audit_log(package_id);
`);

// Additive migration: existing dev databases created before the lock-screen feature
// won't have these columns yet (SQLite has no "ADD COLUMN IF NOT EXISTS").
const bpColumns = db.prepare("PRAGMA table_info(business_profile)").all().map((c) => c.name);
if (!bpColumns.includes('lock_enabled')) {
  db.exec('ALTER TABLE business_profile ADD COLUMN lock_enabled INTEGER NOT NULL DEFAULT 0');
}
if (!bpColumns.includes('lock_timeout_minutes')) {
  db.exec('ALTER TABLE business_profile ADD COLUMN lock_timeout_minutes INTEGER NOT NULL DEFAULT 5');
}

const invoiceColumns = db.prepare("PRAGMA table_info(invoices)").all().map((c) => c.name);
if (!invoiceColumns.includes('event_date')) {
  db.exec('ALTER TABLE invoices ADD COLUMN event_date INTEGER');
}
if (!invoiceColumns.includes('event_location')) {
  db.exec('ALTER TABLE invoices ADD COLUMN event_location TEXT');
}

// Custom plans: instead of a fixed credits/price, the customer picks a
// quantity (at least min_credits) and pays quantity * (price_per_credit_paise
// - discount_per_credit_paise). The original credits/base_price_paise/
// final_price_paise columns stay NOT NULL, so a custom plan keeps them
// populated with the "at minimum quantity" figures - existing admin views
// (Orders/Payments/Credits, card display fallbacks) stay meaningful without
// needing to special-case plan_type; price_per_credit_paise etc. are the
// actual source of truth for order calculation.
const planColumns = db.prepare('PRAGMA table_info(plans)').all().map((c) => c.name);
if (!planColumns.includes('plan_type')) {
  db.exec("ALTER TABLE plans ADD COLUMN plan_type TEXT NOT NULL DEFAULT 'FIXED' CHECK (plan_type IN ('FIXED','CUSTOM'))");
}
if (!planColumns.includes('min_credits')) {
  db.exec('ALTER TABLE plans ADD COLUMN min_credits INTEGER');
}
if (!planColumns.includes('price_per_credit_paise')) {
  db.exec('ALTER TABLE plans ADD COLUMN price_per_credit_paise INTEGER');
}
if (!planColumns.includes('discount_per_credit_paise')) {
  db.exec('ALTER TABLE plans ADD COLUMN discount_per_credit_paise INTEGER NOT NULL DEFAULT 0');
}

// Records exactly how many credits a given order actually paid for - needed
// once quantity can vary per-order (custom plans); fixed-plan orders just
// mirror plan.credits here too, so fulfillOrder never has to special-case.
const orderColumns = db.prepare('PRAGMA table_info(orders)').all().map((c) => c.name);
if (!orderColumns.includes('credits_purchased')) {
  db.exec('ALTER TABLE orders ADD COLUMN credits_purchased INTEGER');
}
// Which duration tier a FIXED-plan order actually bought (see
// plans.duration_options_json below) - drives how long the resulting
// package runs for. NULL falls back to the plan's own duration_days.
if (!orderColumns.includes('duration_days_purchased')) {
  db.exec('ALTER TABLE orders ADD COLUMN duration_days_purchased INTEGER');
}

// FIXED plans can offer extra selectable duration tiers beyond their primary
// duration_days/base_price_paise/discount_paise (e.g. 3/6/12 months, with a
// bigger discount the longer the customer commits). Stored as a JSON array
// of {durationDays, basePricePaise, discountPaise, finalPricePaise} - same
// column-array convention already used for features_json. Credits stay the
// plan's fixed credits regardless of which tier is chosen; only price and
// duration vary. Not used by CUSTOM plans.
if (!planColumns.includes('duration_options_json')) {
  db.exec("ALTER TABLE plans ADD COLUMN duration_options_json TEXT NOT NULL DEFAULT '[]'");
}

// Credit top-ups: a customer with an active package can buy extra credits
// at an admin-set flat rate without buying a whole new plan cycle - the
// top-up rides the existing package's current expiry, it never extends it.
const settingsColumns = db.prepare('PRAGMA table_info(photo_book_settings)').all().map((c) => c.name);
if (!settingsColumns.includes('topup_price_per_credit_paise')) {
  db.exec('ALTER TABLE photo_book_settings ADD COLUMN topup_price_per_credit_paise INTEGER');
}

// order_kind distinguishes a top-up order (adds credits to an existing
// package, no expiry change) from a normal plan purchase/renewal.
// package_id records which package a TOPUP order is crediting; NULL for
// PURCHASE orders (those resolve their package via plan_id + customer_id,
// same as before).
if (!orderColumns.includes('order_kind')) {
  db.exec("ALTER TABLE orders ADD COLUMN order_kind TEXT NOT NULL DEFAULT 'PURCHASE' CHECK (order_kind IN ('PURCHASE','TOPUP'))");
}
if (!orderColumns.includes('package_id')) {
  db.exec('ALTER TABLE orders ADD COLUMN package_id INTEGER REFERENCES packages(id)');
}

// credit_transactions.type's CHECK constraint was fixed at table-creation
// time; SQLite can't widen a CHECK via ALTER TABLE, so this recreates the
// table (rename -> create -> copy -> drop) the one time CREDIT_TOPUP isn't
// yet an allowed value. Idempotent: checks the live schema text first.
const creditTxSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'credit_transactions'").get();
if (creditTxSchema && !creditTxSchema.sql.includes('CREDIT_TOPUP')) {
  db.transaction(() => {
    db.exec('ALTER TABLE credit_transactions RENAME TO credit_transactions_old');
    db.exec(`
      CREATE TABLE credit_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        package_id INTEGER NOT NULL REFERENCES packages(id),
        customer_id INTEGER NOT NULL REFERENCES customers(id),
        type TEXT NOT NULL CHECK (type IN ('PACKAGE_PURCHASE','ALBUM_CREATED','ALBUM_DELETED','CREDIT_REFUND','ADMIN_ADJUSTMENT','PACKAGE_EXPIRY','PACKAGE_RENEWAL','CREDIT_TOPUP')),
        amount INTEGER NOT NULL,
        balance_after INTEGER NOT NULL,
        album_id INTEGER,
        actor_type TEXT NOT NULL CHECK (actor_type IN ('CUSTOMER','ADMIN','SYSTEM')),
        actor_id TEXT,
        note TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
      )
    `);
    db.exec('INSERT INTO credit_transactions SELECT * FROM credit_transactions_old');
    db.exec('DROP TABLE credit_transactions_old');
    db.exec('CREATE INDEX IF NOT EXISTS idx_credit_transactions_package ON credit_transactions(package_id)');
    db.exec('CREATE INDEX IF NOT EXISTS idx_credit_transactions_customer ON credit_transactions(customer_id)');
  })();
}

// Safety net for the core business rule "longer duration never means more
// credits": duration_options_json tiers now always carry an explicit
// `credits` field (see photobookPlans.js), forced equal to the parent
// plan's own credits at write time. This re-stamps every existing plan's
// stored tiers to match on every boot, in case any tier was ever written
// before that field existed or somehow drifted - cheap (plan count is
// small) and a no-op once everything already matches, so it's safe to just
// always run rather than track whether it's needed.
{
  const plans = db.prepare("SELECT id, credits, duration_options_json FROM plans WHERE plan_type = 'FIXED' OR plan_type IS NULL").all();
  const restamp = db.prepare('UPDATE plans SET duration_options_json = ? WHERE id = ?');
  for (const p of plans) {
    let tiers;
    try {
      tiers = JSON.parse(p.duration_options_json || '[]');
    } catch {
      tiers = [];
    }
    if (!Array.isArray(tiers) || tiers.length === 0) continue;
    const needsFix = tiers.some((t) => t.credits !== p.credits);
    if (needsFix) {
      restamp.run(JSON.stringify(tiers.map((t) => ({ ...t, credits: p.credits }))), p.id);
    }
  }
}

module.exports = db;
