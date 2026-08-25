const express = require('express');
const db = require('../db');
const { runExpirySweep } = require('../lib/packageStatus');

const router = express.Router();

function serialize(row) {
  return {
    expiringSoonDays: row.expiring_soon_days,
    topupPricePerCreditPaise: row.topup_price_per_credit_paise,
    updatedAt: row.updated_at,
  };
}

router.get('/', (req, res) => {
  let row = db.prepare('SELECT * FROM photo_book_settings WHERE id = 1').get();
  if (!row) {
    db.prepare('INSERT INTO photo_book_settings (id) VALUES (1)').run();
    row = db.prepare('SELECT * FROM photo_book_settings WHERE id = 1').get();
  }
  res.json(serialize(row));
});

router.put('/', (req, res) => {
  const existing = db.prepare('SELECT * FROM photo_book_settings WHERE id = 1').get() || {
    expiring_soon_days: 7,
    topup_price_per_credit_paise: null,
  };

  const { expiringSoonDays, topupPricePerCreditPaise } = req.body || {};
  const nextExpiringSoonDays = expiringSoonDays === undefined ? existing.expiring_soon_days : expiringSoonDays;
  if (!Number.isInteger(nextExpiringSoonDays) || nextExpiringSoonDays < 1 || nextExpiringSoonDays > 365) {
    return res.status(400).json({ error: 'expiringSoonDays must be a whole number between 1 and 365' });
  }

  // null/0 disables top-ups (hides the option in the portal) rather than
  // erroring - an admin who hasn't decided on a top-up price yet shouldn't
  // be forced to set one just to change the expiring-soon threshold.
  let nextTopupPrice = topupPricePerCreditPaise === undefined ? existing.topup_price_per_credit_paise : topupPricePerCreditPaise;
  if (nextTopupPrice !== null && nextTopupPrice !== 0 && (!Number.isInteger(nextTopupPrice) || nextTopupPrice < 0)) {
    return res.status(400).json({ error: 'topupPricePerCreditPaise must be a non-negative whole number, or null to disable top-ups' });
  }
  if (nextTopupPrice === 0) nextTopupPrice = null;

  db.prepare('SELECT 1 FROM photo_book_settings WHERE id = 1').get() ||
    db.prepare('INSERT INTO photo_book_settings (id) VALUES (1)').run();

  db.prepare(
    'UPDATE photo_book_settings SET expiring_soon_days = ?, topup_price_per_credit_paise = ?, updated_at = unixepoch() * 1000 WHERE id = 1'
  ).run(nextExpiringSoonDays, nextTopupPrice);

  // Re-derive computed_status for every package immediately under the new
  // threshold, rather than leaving stale statuses to drift until the next
  // scheduled sweep or an unrelated read happens to touch each row.
  runExpirySweep(db);

  const row = db.prepare('SELECT * FROM photo_book_settings WHERE id = 1').get();
  res.json(serialize(row));
});

module.exports = router;
