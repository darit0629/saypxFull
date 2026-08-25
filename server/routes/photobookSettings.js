const express = require('express');
const db = require('../db');
const { runExpirySweep } = require('../lib/packageStatus');

const router = express.Router();

function serialize(row) {
  return { expiringSoonDays: row.expiring_soon_days, updatedAt: row.updated_at };
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
  const { expiringSoonDays } = req.body || {};
  if (!Number.isInteger(expiringSoonDays) || expiringSoonDays < 1 || expiringSoonDays > 365) {
    return res.status(400).json({ error: 'expiringSoonDays must be a whole number between 1 and 365' });
  }

  db.prepare('SELECT 1 FROM photo_book_settings WHERE id = 1').get() ||
    db.prepare('INSERT INTO photo_book_settings (id) VALUES (1)').run();

  db.prepare('UPDATE photo_book_settings SET expiring_soon_days = ?, updated_at = unixepoch() * 1000 WHERE id = 1').run(expiringSoonDays);

  // Re-derive computed_status for every package immediately under the new
  // threshold, rather than leaving stale statuses to drift until the next
  // scheduled sweep or an unrelated read happens to touch each row.
  runExpirySweep(db);

  const row = db.prepare('SELECT * FROM photo_book_settings WHERE id = 1').get();
  res.json(serialize(row));
});

module.exports = router;
