const fs = require('fs');
const path = require('path');
const { simpleParser } = require('mailparser');
const db = require('../db');
const { getImapClient, MAIL_FOLDERS } = require('./mail');

function addressListToJson(list) {
  if (!list || !list.value) return null;
  return JSON.stringify(list.value.map((a) => ({ address: a.address, name: a.name || null })));
}

function sanitizeFilename(name) {
  return String(name || 'attachment').replace(/[/\\?%*:|"<>]/g, '_').slice(0, 200);
}

async function saveAttachments(logicalFolder, messageRowId, attachments) {
  if (!attachments || attachments.length === 0) return;
  const dir = path.join(__dirname, '..', 'uploads', 'mail', logicalFolder, String(messageRowId));
  fs.mkdirSync(dir, { recursive: true });

  const insert = db.prepare(
    `INSERT INTO mail_attachments (message_id, filename, content_type, size_bytes, stored_path) VALUES (?, ?, ?, ?, ?)`
  );
  for (const att of attachments) {
    const filename = sanitizeFilename(att.filename);
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, att.content);
    const storedPath = path.relative(path.join(__dirname, '..', 'uploads'), filePath);
    insert.run(messageRowId, filename, att.contentType || null, att.size || att.content.length, storedPath);
  }
}

async function parseAndStore(logicalFolder, uid, uidValidity, source) {
  const parsed = await simpleParser(source);
  const snippet = (parsed.text || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  const referencesHeader = Array.isArray(parsed.references) ? parsed.references.join(' ') : parsed.references || null;

  const insert = db.prepare(`
    INSERT OR IGNORE INTO mail_messages
      (folder, uid, uid_validity, message_id, in_reply_to, references_header, subject,
       from_address, from_name, to_addresses, cc_addresses, date_ts, snippet, body_text, body_html,
       has_attachments, is_read)
    VALUES (@folder, @uid, @uid_validity, @message_id, @in_reply_to, @references_header, @subject,
            @from_address, @from_name, @to_addresses, @cc_addresses, @date_ts, @snippet, @body_text, @body_html,
            @has_attachments, @is_read)
  `);

  const result = insert.run({
    folder: logicalFolder,
    uid,
    uid_validity: uidValidity,
    message_id: parsed.messageId || null,
    in_reply_to: parsed.inReplyTo || null,
    references_header: referencesHeader,
    subject: parsed.subject || '(no subject)',
    from_address: parsed.from?.value?.[0]?.address || null,
    from_name: parsed.from?.value?.[0]?.name || null,
    to_addresses: addressListToJson(parsed.to),
    cc_addresses: addressListToJson(parsed.cc),
    date_ts: parsed.date ? parsed.date.getTime() : Date.now(),
    snippet,
    body_text: parsed.text || null,
    body_html: parsed.html || null,
    has_attachments: parsed.attachments && parsed.attachments.length > 0 ? 1 : 0,
    is_read: logicalFolder === 'sent' ? 1 : 0,
  });

  if (result.changes > 0 && parsed.attachments?.length) {
    await saveAttachments(logicalFolder, result.lastInsertRowid, parsed.attachments);
  }
}

async function syncFolder(logicalFolder, { backfillLimit = 200 } = {}) {
  const remoteFolder = MAIL_FOLDERS[logicalFolder];
  if (!remoteFolder) throw new Error(`Unknown mail folder: ${logicalFolder}`);

  const client = getImapClient();
  await client.connect();
  let newCount = 0;
  try {
    const lock = await client.getMailboxLock(remoteFolder);
    try {
      const uidValidity = Number(client.mailbox.uidValidity);
      let state = db.prepare('SELECT * FROM mail_sync_state WHERE folder = ?').get(logicalFolder);

      if (!state) {
        db.prepare(
          'INSERT INTO mail_sync_state (folder, uid_validity, last_synced_uid, initial_backfill_done) VALUES (?, ?, 0, 0)'
        ).run(logicalFolder, uidValidity);
        state = { folder: logicalFolder, uid_validity: uidValidity, last_synced_uid: 0, initial_backfill_done: 0 };
      } else if (state.uid_validity !== uidValidity) {
        // Server renumbered UIDs for this folder — our cached rows are no longer trustworthy.
        db.prepare('DELETE FROM mail_messages WHERE folder = ?').run(logicalFolder);
        db.prepare(
          'UPDATE mail_sync_state SET uid_validity = ?, last_synced_uid = 0, initial_backfill_done = 0 WHERE folder = ?'
        ).run(uidValidity, logicalFolder);
        state.uid_validity = uidValidity;
        state.last_synced_uid = 0;
        state.initial_backfill_done = 0;
      }

      const exists = client.mailbox.exists;
      let maxUidSeen = state.last_synced_uid;

      if (!state.initial_backfill_done) {
        if (exists > 0) {
          const startSeq = Math.max(1, exists - backfillLimit + 1);
          for await (const msg of client.fetch(`${startSeq}:*`, { uid: true, source: true })) {
            await parseAndStore(logicalFolder, msg.uid, uidValidity, msg.source);
            if (msg.uid > maxUidSeen) maxUidSeen = msg.uid;
            newCount++;
          }
        }
        db.prepare(
          'UPDATE mail_sync_state SET last_synced_uid = ?, initial_backfill_done = 1, last_synced_at = ? WHERE folder = ?'
        ).run(maxUidSeen, Date.now(), logicalFolder);
      } else if (exists > 0) {
        const startUid = state.last_synced_uid + 1;
        for await (const msg of client.fetch(`${startUid}:*`, { uid: true, source: true }, { uid: true })) {
          if (msg.uid < startUid) continue; // imapflow can return the nearest existing UID when the exact one is gone
          await parseAndStore(logicalFolder, msg.uid, uidValidity, msg.source);
          if (msg.uid > maxUidSeen) maxUidSeen = msg.uid;
          newCount++;
        }
        db.prepare('UPDATE mail_sync_state SET last_synced_uid = ?, last_synced_at = ? WHERE folder = ?').run(
          maxUidSeen,
          Date.now(),
          logicalFolder
        );
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
  return { newCount };
}

module.exports = { syncFolder };
