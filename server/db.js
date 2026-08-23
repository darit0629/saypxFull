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

module.exports = db;
