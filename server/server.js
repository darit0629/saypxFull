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
app.use(express.json());
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
