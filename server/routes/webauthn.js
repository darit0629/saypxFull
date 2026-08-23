const express = require('express');
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require('@simplewebauthn/server');
const db = require('../db');

const router = express.Router();

const RP_NAME = process.env.WEBAUTHN_RP_NAME || 'SAYPX Billing';
const RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost';
const ALLOWED_ORIGINS = (process.env.WEBAUTHN_ORIGINS || 'http://localhost:4210,http://localhost:4200').split(',');

// Single-user app: one fixed WebAuthn user handle tied to the admin account.
const USER_ID = Buffer.from('saypx-billing-admin');

function getCredentials() {
  return db.prepare('SELECT * FROM webauthn_credentials').all();
}

router.get('/status', (req, res) => {
  const creds = getCredentials();
  const business = db.prepare('SELECT lock_enabled, lock_timeout_minutes FROM business_profile WHERE id = 1').get() || {};
  res.json({
    hasCredential: creds.length > 0,
    credentials: creds.map((c) => ({ id: c.id, deviceLabel: c.device_label, createdAt: c.created_at })),
    lockEnabled: !!business.lock_enabled,
    lockTimeoutMinutes: business.lock_timeout_minutes ?? 5,
  });
});

router.post('/register-options', async (req, res) => {
  const existing = getCredentials();
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: USER_ID,
    userName: process.env.ADMIN_USERNAME || 'sayan',
    attestationType: 'none',
    excludeCredentials: existing.map((c) => ({ id: c.credential_id })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });
  req.session.webauthnChallenge = options.challenge;
  res.json(options);
});

router.post('/register-verify', async (req, res) => {
  const expectedChallenge = req.session.webauthnChallenge;
  if (!expectedChallenge) return res.status(400).json({ error: 'No pending registration challenge' });

  try {
    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge,
      expectedOrigin: ALLOWED_ORIGINS,
      expectedRPID: RP_ID,
    });
    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ error: 'Passkey verification failed' });
    }
    const { credential } = verification.registrationInfo;
    db.prepare(
      'INSERT INTO webauthn_credentials (credential_id, public_key, counter, device_label) VALUES (?, ?, ?, ?)'
    ).run(credential.id, Buffer.from(credential.publicKey).toString('base64url'), credential.counter, req.body.deviceLabel || null);
    req.session.webauthnChallenge = null;
    res.json({ ok: true });
  } catch (e) {
    console.error('WebAuthn registration failed:', e);
    res.status(400).json({ error: 'Passkey registration failed' });
  }
});

router.post('/lock-options', async (req, res) => {
  const creds = getCredentials();
  if (creds.length === 0) return res.status(400).json({ error: 'No passkey registered' });

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'preferred',
    allowCredentials: creds.map((c) => ({ id: c.credential_id })),
  });
  req.session.webauthnChallenge = options.challenge;
  res.json(options);
});

router.post('/lock-verify', async (req, res) => {
  const expectedChallenge = req.session.webauthnChallenge;
  if (!expectedChallenge) return res.status(400).json({ error: 'No pending unlock challenge' });

  const cred = db.prepare('SELECT * FROM webauthn_credentials WHERE credential_id = ?').get(req.body.id);
  if (!cred) return res.status(400).json({ error: 'Unknown passkey' });

  try {
    const verification = await verifyAuthenticationResponse({
      response: req.body,
      expectedChallenge,
      expectedOrigin: ALLOWED_ORIGINS,
      expectedRPID: RP_ID,
      credential: {
        id: cred.credential_id,
        publicKey: Buffer.from(cred.public_key, 'base64url'),
        counter: cred.counter,
      },
    });
    if (!verification.verified) return res.status(400).json({ error: 'Passkey verification failed' });

    db.prepare('UPDATE webauthn_credentials SET counter = ? WHERE id = ?').run(
      verification.authenticationInfo.newCounter,
      cred.id
    );
    req.session.webauthnChallenge = null;
    req.session.unlockedAt = Date.now();
    res.json({ ok: true });
  } catch (e) {
    console.error('WebAuthn unlock failed:', e);
    res.status(400).json({ error: 'Passkey verification failed' });
  }
});

router.delete('/credentials/:id', (req, res) => {
  db.prepare('DELETE FROM webauthn_credentials WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.put('/settings', (req, res) => {
  const { lockEnabled, lockTimeoutMinutes } = req.body || {};
  db.prepare('SELECT 1 FROM business_profile WHERE id = 1').get() ||
    db.prepare('INSERT INTO business_profile (id) VALUES (1)').run();
  db.prepare('UPDATE business_profile SET lock_enabled = ?, lock_timeout_minutes = ? WHERE id = 1').run(
    lockEnabled ? 1 : 0,
    lockTimeoutMinutes ?? 5
  );
  res.json({ ok: true });
});

module.exports = router;
