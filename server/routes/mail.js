const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const MailComposer = require('nodemailer/lib/mail-composer');
const db = require('../db');
const { getImapClient, getSmtpTransport, MAIL_FOLDERS, isMailConfigured } = require('../lib/mail');
const { syncFolder } = require('../lib/mailSync');
const { buildReplyHeaders, buildReplySubject, buildForwardSubject } = require('../lib/mailThreading');

const router = express.Router();

const OUTGOING_DIR = path.join(__dirname, '..', 'uploads', 'mail', '_outgoing');
fs.mkdirSync(OUTGOING_DIR, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, OUTGOING_DIR),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}-${file.originalname}`),
  }),
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.use((req, res, next) => {
  if (!isMailConfigured()) return res.status(503).json({ error: 'Mail is not configured yet' });
  next();
});

function parseAddressList(raw) {
  if (!raw) return [];
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function rowToListItem(row) {
  return {
    id: row.id,
    folder: row.folder,
    message_id: row.message_id,
    subject: row.subject,
    from_address: row.from_address,
    from_name: row.from_name,
    date_ts: row.date_ts,
    snippet: row.snippet,
    has_attachments: !!row.has_attachments,
    is_read: !!row.is_read,
  };
}

router.get('/folders', (req, res) => {
  const rows = db
    .prepare(
      `SELECT folder,
              COUNT(*) as total,
              SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) as unread
       FROM mail_messages WHERE is_deleted = 0 GROUP BY folder`
    )
    .all();
  const byFolder = Object.fromEntries(rows.map((r) => [r.folder, r]));
  const folders = Object.keys(MAIL_FOLDERS).map((folder) => ({
    folder,
    total: byFolder[folder]?.total || 0,
    unreadCount: byFolder[folder]?.unread || 0,
  }));
  res.json(folders);
});

router.get('/messages', (req, res) => {
  const folder = req.query.folder || 'inbox';
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(100, Number(req.query.pageSize) || 25);
  const search = (req.query.search || '').trim();

  let where = 'folder = ? AND is_deleted = 0';
  const params = [folder];
  if (search) {
    where += ' AND (subject LIKE ? OR from_address LIKE ? OR from_name LIKE ? OR snippet LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }

  const total = db.prepare(`SELECT COUNT(*) as c FROM mail_messages WHERE ${where}`).get(...params).c;
  const rows = db
    .prepare(`SELECT * FROM mail_messages WHERE ${where} ORDER BY date_ts DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, (page - 1) * pageSize);

  res.json({ messages: rows.map(rowToListItem), total, page, pageSize });
});

router.get('/messages/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM mail_messages WHERE id = ? AND is_deleted = 0').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Message not found' });

  if (!row.is_read) {
    db.prepare('UPDATE mail_messages SET is_read = 1 WHERE id = ?').run(row.id);
    row.is_read = 1;
  }

  const attachments = db
    .prepare('SELECT id, filename, content_type, size_bytes FROM mail_attachments WHERE message_id = ?')
    .all(row.id);

  res.json({
    ...rowToListItem(row),
    in_reply_to: row.in_reply_to,
    references_header: row.references_header,
    to_addresses: row.to_addresses ? JSON.parse(row.to_addresses) : [],
    cc_addresses: row.cc_addresses ? JSON.parse(row.cc_addresses) : [],
    body_text: row.body_text,
    body_html: row.body_html,
    attachments,
  });
});

router.post('/messages/:id/read', (req, res) => {
  const row = db.prepare('SELECT id FROM mail_messages WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Message not found' });
  const isRead = req.body?.isRead !== false;
  db.prepare('UPDATE mail_messages SET is_read = ? WHERE id = ?').run(isRead ? 1 : 0, row.id);
  res.json({ isRead });
});

router.post('/messages/:id/trash', async (req, res) => {
  const row = db.prepare('SELECT * FROM mail_messages WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Message not found' });

  const client = getImapClient();
  await client.connect();
  try {
    const lock = await client.getMailboxLock(MAIL_FOLDERS[row.folder]);
    try {
      await client.messageMove(row.uid, MAIL_FOLDERS.trash, { uid: true });
    } finally {
      lock.release();
    }
  } catch (e) {
    console.error('IMAP trash move failed:', e.message);
  } finally {
    await client.logout();
  }

  db.prepare('UPDATE mail_messages SET is_deleted = 1 WHERE id = ?').run(row.id);
  res.json({ ok: true });
});

router.delete('/messages/:id', async (req, res) => {
  const row = db.prepare('SELECT * FROM mail_messages WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Message not found' });
  if (row.folder !== 'trash') {
    return res.status(400).json({ error: 'Only messages already in Trash can be permanently deleted' });
  }

  const client = getImapClient();
  await client.connect();
  try {
    const lock = await client.getMailboxLock(MAIL_FOLDERS.trash);
    try {
      await client.messageDelete(row.uid, { uid: true });
    } finally {
      lock.release();
    }
  } catch (e) {
    console.error('IMAP permanent delete failed:', e.message);
  } finally {
    await client.logout();
  }

  const attachmentDir = path.join(__dirname, '..', 'uploads', 'mail', row.folder, String(row.id));
  fs.rmSync(attachmentDir, { recursive: true, force: true });
  db.prepare('DELETE FROM mail_messages WHERE id = ?').run(row.id);
  res.json({ ok: true });
});

router.get('/messages/:id/attachments/:attachmentId', (req, res) => {
  const att = db
    .prepare('SELECT * FROM mail_attachments WHERE id = ? AND message_id = ?')
    .get(req.params.attachmentId, req.params.id);
  if (!att) return res.status(404).json({ error: 'Attachment not found' });
  const filePath = path.join(__dirname, '..', 'uploads', att.stored_path);
  res.download(filePath, att.filename);
});

async function sendAndAppend({ to, cc, subject, bodyHtml, files, extraHeaders }) {
  const transport = getSmtpTransport();
  const attachments = (files || []).map((f) => ({ filename: f.originalname, path: f.path }));

  const mailOptions = {
    from: `"${process.env.MAIL_DISPLAY_NAME || 'SAYPX'}" <${process.env.MAIL_ADDRESS}>`,
    to: parseAddressList(to),
    cc: parseAddressList(cc),
    subject,
    html: bodyHtml,
    attachments,
    ...extraHeaders,
  };

  // Build the exact raw MIME source once, so the message we IMAP-append to
  // Sent is byte-for-byte what was actually sent (nodemailer's sendMail()
  // result does not include the raw source by default — info.message /
  // info.envelope are NOT raw MIME and cannot be passed to client.append()).
  // MimeNode.build() is callback-style, not promise-based.
  const compiled = await new Promise((resolve, reject) => {
    new MailComposer(mailOptions).compile().build((err, message) => (err ? reject(err) : resolve(message)));
  });

  // When sending pre-built `raw` MIME, nodemailer does not parse the To/Cc
  // headers back out to build the SMTP envelope — it must be given explicitly.
  const info = await transport.sendMail({
    raw: compiled,
    envelope: { from: process.env.MAIL_ADDRESS, to: [...mailOptions.to, ...mailOptions.cc] },
  });

  // SMTP relay doesn't populate Sent for us — append the raw message ourselves.
  try {
    const client = getImapClient();
    await client.connect();
    try {
      await client.append(MAIL_FOLDERS.sent, compiled, ['\\Seen']);
    } finally {
      await client.logout();
    }
  } catch (e) {
    console.error('IMAP append-to-Sent failed:', e.message);
  }

  for (const f of files || []) {
    fs.unlink(f.path, () => {});
  }

  return info;
}

router.post('/send', upload.array('files'), async (req, res) => {
  try {
    const { to, cc, subject, bodyHtml } = req.body;
    if (!to || !subject) return res.status(400).json({ error: 'to and subject are required' });
    await sendAndAppend({ to, cc, subject, bodyHtml, files: req.files });
    syncFolder('sent').catch((e) => console.error('Sent sync failed:', e.message));
    res.json({ ok: true });
  } catch (e) {
    console.error('Send failed:', e.message);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

router.post('/messages/:id/reply', upload.array('files'), async (req, res) => {
  const original = db.prepare('SELECT * FROM mail_messages WHERE id = ?').get(req.params.id);
  if (!original) return res.status(404).json({ error: 'Message not found' });
  try {
    const { to, cc, bodyHtml } = req.body;
    const headers = buildReplyHeaders(original);
    await sendAndAppend({
      to: to || original.from_address,
      cc,
      subject: buildReplySubject(original.subject),
      bodyHtml,
      files: req.files,
      extraHeaders: { inReplyTo: headers.inReplyTo, references: headers.references },
    });
    syncFolder('sent').catch((e) => console.error('Sent sync failed:', e.message));
    res.json({ ok: true });
  } catch (e) {
    console.error('Reply failed:', e.message);
    res.status(500).json({ error: 'Failed to send reply' });
  }
});

router.post('/messages/:id/forward', upload.array('files'), async (req, res) => {
  const original = db.prepare('SELECT * FROM mail_messages WHERE id = ?').get(req.params.id);
  if (!original) return res.status(404).json({ error: 'Message not found' });
  try {
    const { to, cc, bodyHtml } = req.body;
    if (!to) return res.status(400).json({ error: 'to is required' });
    const quoted = `${bodyHtml || ''}<hr><p>${(original.body_html || original.body_text || '').toString()}</p>`;
    await sendAndAppend({ to, cc, subject: buildForwardSubject(original.subject), bodyHtml: quoted, files: req.files });
    syncFolder('sent').catch((e) => console.error('Sent sync failed:', e.message));
    res.json({ ok: true });
  } catch (e) {
    console.error('Forward failed:', e.message);
    res.status(500).json({ error: 'Failed to forward email' });
  }
});

router.post('/sync', async (req, res) => {
  try {
    const result = await syncFolder('inbox');
    res.json(result);
  } catch (e) {
    console.error('Manual sync failed:', e.message);
    res.status(500).json({ error: 'Sync failed' });
  }
});

router.post('/sync/:folder', async (req, res) => {
  if (!MAIL_FOLDERS[req.params.folder]) return res.status(400).json({ error: 'Unknown folder' });
  try {
    const result = await syncFolder(req.params.folder);
    res.json(result);
  } catch (e) {
    console.error('Folder sync failed:', e.message);
    res.status(500).json({ error: 'Sync failed' });
  }
});

module.exports = router;
