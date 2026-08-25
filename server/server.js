require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');
const bcrypt = require('bcryptjs');

require('./db'); // ensures schema is created on boot

const PORT = parseInt(process.env.PORT || '4200', 10);
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!ADMIN_USERNAME || !ADMIN_PASSWORD_HASH || !SESSION_SECRET) {
  console.error('Missing ADMIN_USERNAME / ADMIN_PASSWORD_HASH / SESSION_SECRET in .env');
}

const { isMailConfigured } = require('./lib/mail');
if (!isMailConfigured()) {
  console.error('Missing MAIL_* config in .env — webmail features will fail');
}

const app = express();
app.disable('x-powered-by');
// nginx terminates TLS and proxies over plain HTTP — without this, Express never sees the
// connection as secure, so the `secure: true` session cookie below silently never gets set.
app.set('trust proxy', 1);
// Captures the raw request body alongside the parsed one - the Razorpay
// webhook route needs the exact original bytes to verify its HMAC signature
// (re-serializing req.body would not byte-for-byte match what Razorpay
// signed). Cheap to do on every request, only actually used by that route.
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(
  cookieSession({
    name: 'saypx_billing_session',
    keys: [SESSION_SECRET || 'insecure-fallback-secret-change-me'],
    maxAge: 12 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV !== 'development',
  })
);

// ---- Simple in-memory login rate limiting (mirrors the photography site's admin panel) ----
const loginAttempts = new Map();
function isLockedOut(ip) {
  const rec = loginAttempts.get(ip);
  return rec && rec.lockedUntil && rec.lockedUntil > Date.now();
}
function recordFailedLogin(ip) {
  const rec = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  rec.count++;
  if (rec.count >= 5) {
    rec.lockedUntil = Date.now() + 10 * 60 * 1000;
    rec.count = 0;
  }
  loginAttempts.set(ip, rec);
}
function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

// ---- Customer (Digital Photo Book) session — separate cookie/namespace from the
// admin session above. cookie-session always attaches to `req.session`, so this
// middleware is scoped to only the /api/customer path prefix (never runs on admin
// routes) and immediately aliases it to `req.customerSession` so route code never
// has to think about which `req.session` it's looking at.
app.use(
  '/api/customer',
  cookieSession({
    name: 'saypx_customer_session',
    keys: [SESSION_SECRET || 'insecure-fallback-secret-change-me'],
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV !== 'development',
  }),
  (req, res, next) => {
    req.customerSession = req.session;
    next();
  }
);

const customerLoginAttempts = new Map();
function isCustomerLockedOut(ip) {
  const rec = customerLoginAttempts.get(ip);
  return rec && rec.lockedUntil && rec.lockedUntil > Date.now();
}
function recordFailedCustomerLogin(ip) {
  const rec = customerLoginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
  rec.count++;
  if (rec.count >= 5) {
    rec.lockedUntil = Date.now() + 10 * 60 * 1000;
    rec.count = 0;
  }
  customerLoginAttempts.set(ip, rec);
}
function clearCustomerLoginAttempts(ip) {
  customerLoginAttempts.delete(ip);
}

function requireCustomerAuth(req, res, next) {
  const customerId = req.customerSession && req.customerSession.customerId;
  if (!customerId) return res.status(401).json({ error: 'Not authenticated' });
  const db = require('./db');
  const customer = db.prepare('SELECT id, status FROM customers WHERE id = ?').get(customerId);
  if (!customer || customer.status !== 'ACTIVE') {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

// ---- Auth routes ----
app.get('/api/auth/me', (req, res) => {
  if (req.session && req.session.authenticated) return res.json({ ok: true });
  res.status(401).json({ error: 'Not authenticated' });
});

app.post('/api/auth/login', (req, res) => {
  const ip = req.ip;
  if (isLockedOut(ip)) {
    return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  }
  const { username, password } = req.body || {};
  const validUser = ADMIN_USERNAME && username === ADMIN_USERNAME;
  const validPass = ADMIN_PASSWORD_HASH && password && bcrypt.compareSync(password, ADMIN_PASSWORD_HASH);
  if (validUser && validPass) {
    clearLoginAttempts(ip);
    req.session.authenticated = true;
    return res.json({ ok: true });
  }
  recordFailedLogin(ip);
  res.status(401).json({ error: 'Incorrect username or password' });
});

app.post('/api/auth/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

// ---- Customer auth routes (Digital Photo Book portal) ----
function serializeCustomerSession(row) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    businessName: row.business_name,
  };
}

app.get('/api/customer/auth/me', (req, res) => {
  const customerId = req.customerSession && req.customerSession.customerId;
  if (!customerId) return res.status(401).json({ error: 'Not authenticated' });
  const db = require('./db');
  const row = db.prepare('SELECT * FROM customers WHERE id = ? AND status = ?').get(customerId, 'ACTIVE');
  if (!row) return res.status(401).json({ error: 'Not authenticated' });
  res.json(serializeCustomerSession(row));
});

app.post('/api/customer/auth/signup', (req, res) => {
  const { email, password, name, phone, businessName } = req.body || {};
  if (!email || !email.trim()) return res.status(400).json({ error: 'Email is required' });
  if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const db = require('./db');
  const normalizedEmail = email.trim().toLowerCase();
  const existing = db.prepare('SELECT id FROM customers WHERE email = ?').get(normalizedEmail);
  if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare('INSERT INTO customers (email, password_hash, name, phone, business_name) VALUES (?, ?, ?, ?, ?)')
    .run(normalizedEmail, passwordHash, name || null, phone || null, businessName || null);

  req.customerSession.customerId = result.lastInsertRowid;
  const row = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(serializeCustomerSession(row));
});

app.post('/api/customer/auth/login', (req, res) => {
  const ip = req.ip;
  if (isCustomerLockedOut(ip)) {
    return res.status(429).json({ error: 'Too many attempts. Try again in a few minutes.' });
  }
  const { email, password } = req.body || {};
  const db = require('./db');
  const row = db.prepare('SELECT * FROM customers WHERE email = ?').get((email || '').trim().toLowerCase());
  const validPass = row && password && bcrypt.compareSync(password, row.password_hash);

  if (row && validPass && row.status === 'ACTIVE') {
    clearCustomerLoginAttempts(ip);
    req.customerSession.customerId = row.id;
    db.prepare('UPDATE customers SET last_login_at = unixepoch() * 1000 WHERE id = ?').run(row.id);
    return res.json(serializeCustomerSession(row));
  }
  if (row && validPass && row.status !== 'ACTIVE') {
    return res.status(403).json({ error: 'This account has been disabled. Contact SAYPX support.' });
  }
  recordFailedCustomerLogin(ip);
  res.status(401).json({ error: 'Incorrect email or password' });
});

app.post('/api/customer/auth/logout', (req, res) => {
  // Must reassign req.session (the real cookie-session getter/setter) - req.customerSession
  // is a plain aliased property, so setting *it* to null discards our own reference without
  // ever clearing the actual session cookie.
  req.session = null;
  res.json({ ok: true });
});

// Public pricing page data - deliberately no auth at all, since a logged-out
// visitor needs to see plans before signing up. Active plans only.
app.get('/api/customer/plans', (req, res) => {
  const db = require('./db');
  const { serializePlan } = require('./routes/photobookPlans');
  const rows = db.prepare('SELECT * FROM plans WHERE is_active = 1 ORDER BY sort_order ASC, created_at DESC').all();
  res.json(rows.map(serializePlan));
});

// ---- API routes ----
app.use('/api/clients', requireAuth, require('./routes/clients'));
app.use('/api/invoices', requireAuth, require('./routes/invoices'));
app.use('/api/expenses', requireAuth, require('./routes/expenses'));
app.use('/api/dashboard', requireAuth, require('./routes/dashboard'));
app.use('/api/business', requireAuth, require('./routes/business'));
app.use('/api/reports', requireAuth, require('./routes/reports'));
app.use('/api/templates', requireAuth, require('./routes/templates'));
app.use('/api/uploads', requireAuth, require('./routes/uploads'));
app.use('/api/webauthn', requireAuth, require('./routes/webauthn'));
app.use('/api/mail', requireAuth, require('./routes/mail'));
app.use('/api/website', requireAuth, require('./routes/website'));
app.use('/api/photobook/customers', requireAuth, require('./routes/photobookCustomers'));
app.use('/api/photobook/plans', requireAuth, require('./routes/photobookPlans'));
app.use('/api/photobook/packages', requireAuth, require('./routes/photobookPackages'));
app.use('/api/photobook/orders', requireAuth, require('./routes/photobookOrders'));
app.use('/api/photobook/payments', requireAuth, require('./routes/photobookPayments'));
app.use('/api/photobook/credits', requireAuth, require('./routes/photobookCredits'));
app.use('/api/photobook/settings', requireAuth, require('./routes/photobookSettings'));
app.use('/api/customer/packages', requireCustomerAuth, require('./routes/customerPackages'));
app.use('/api/customer/albums', requireCustomerAuth, require('./routes/customerAlbums'));
app.use('/api/customer/orders', requireCustomerAuth, require('./routes/customerOrders'));
// No auth middleware - Razorpay calls this directly with no session/cookie.
// Protected entirely by HMAC signature verification inside the route itself.
app.use('/api/webhooks/razorpay', require('./routes/razorpayWebhook'));
// Uploaded files (template backgrounds, etc.) are served without auth: their filenames are
// unguessable, and Puppeteer's server-side PDF rendering needs to fetch them without a session cookie.
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---- Serve built frontend in production ----
const clientDist = path.join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientDist));
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`SAYPX Billing API running on port ${PORT}`);
});

// Poll the inbox periodically so new mail shows up without the user needing
// to manually hit "Sync now" every time. Sent/Drafts/Trash sync lazily,
// only when the user opens that folder tab (see routes/mail.js).
if (isMailConfigured()) {
  const { syncFolder } = require('./lib/mailSync');
  const INBOX_POLL_MS = 2 * 60 * 1000;
  setInterval(() => {
    syncFolder('inbox').catch((e) => console.error('Inbox sync failed:', e.message));
  }, INBOX_POLL_MS);
}

// Proactively recompute package status (ACTIVE/EXPIRING_SOON -> EXPIRED etc)
// instead of relying only on the lazy recompute-on-read in packageStatus.js -
// a package nobody happens to view stays stale otherwise. Runs once at boot
// (catches anything that expired while the server was down) then every 6h.
{
  const dbModule = require('./db');
  const { runExpirySweep } = require('./lib/packageStatus');
  const EXPIRY_SWEEP_MS = 6 * 60 * 60 * 1000;
  const sweep = () => {
    try {
      const { checked, transitioned } = runExpirySweep(dbModule);
      if (transitioned > 0) console.log(`Package expiry sweep: ${transitioned}/${checked} package(s) transitioned to EXPIRED`);
    } catch (e) {
      console.error('Package expiry sweep failed:', e.message);
    }
  };
  sweep();
  setInterval(sweep, EXPIRY_SWEEP_MS);
}
