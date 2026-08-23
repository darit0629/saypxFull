const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  let profile = db.prepare('SELECT * FROM business_profile WHERE id = 1').get();
  if (!profile) {
    db.prepare('INSERT INTO business_profile (id, currency) VALUES (1, ?)').run('INR');
    profile = db.prepare('SELECT * FROM business_profile WHERE id = 1').get();
  }
  res.json(profile);
});

router.put('/', (req, res) => {
  const {
    businessName,
    ownerName,
    phone,
    email,
    website,
    address,
    gstin,
    pan,
    bankDetails,
    upiId,
    currency,
  } = req.body || {};

  db.prepare('SELECT 1 FROM business_profile WHERE id = 1').get() ||
    db.prepare('INSERT INTO business_profile (id) VALUES (1)').run();

  db.prepare(
    `UPDATE business_profile SET business_name=?, owner_name=?, phone=?, email=?, website=?,
      address=?, gstin=?, pan=?, bank_details=?, upi_id=?, currency=? WHERE id=1`
  ).run(
    businessName || null,
    ownerName || null,
    phone || null,
    email || null,
    website || null,
    address || null,
    gstin || null,
    pan || null,
    bankDetails || null,
    upiId || null,
    currency || 'INR'
  );

  res.json(db.prepare('SELECT * FROM business_profile WHERE id = 1').get());
});

module.exports = router;
