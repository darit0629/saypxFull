const { ImapFlow } = require('imapflow');
const nodemailer = require('nodemailer');

// Real folder names on the Hostinger/Dovecot mailbox (confirmed via a live
// `client.list()` call — this account uses dot-hierarchy naming, not the
// flat Gmail-style names).
const MAIL_FOLDERS = {
  inbox: 'INBOX',
  sent: 'INBOX.Sent',
  drafts: 'INBOX.Drafts',
  trash: 'INBOX.Trash',
};

function isMailConfigured() {
  return Boolean(
    process.env.MAIL_ADDRESS &&
      process.env.MAIL_PASSWORD &&
      process.env.MAIL_IMAP_HOST &&
      process.env.MAIL_SMTP_HOST
  );
}

function getImapClient() {
  const client = new ImapFlow({
    host: process.env.MAIL_IMAP_HOST,
    port: Number(process.env.MAIL_IMAP_PORT || 993),
    secure: true,
    auth: { user: process.env.MAIL_ADDRESS, pass: process.env.MAIL_PASSWORD },
    logger: false,
  });
  // ImapFlow emits socket/protocol errors as EventEmitter 'error' events in
  // addition to rejecting in-flight promises. Without a listener here, Node
  // treats an unhandled 'error' event as fatal and kills the whole process
  // — which must never happen just because a mail operation had a hiccup.
  client.on('error', (err) => console.error('IMAP client error:', err.message));
  return client;
}

let transportSingleton = null;
function getSmtpTransport() {
  if (!transportSingleton) {
    transportSingleton = nodemailer.createTransport({
      host: process.env.MAIL_SMTP_HOST,
      port: Number(process.env.MAIL_SMTP_PORT || 465),
      secure: true,
      auth: { user: process.env.MAIL_ADDRESS, pass: process.env.MAIL_PASSWORD },
    });
  }
  return transportSingleton;
}

module.exports = { MAIL_FOLDERS, isMailConfigured, getImapClient, getSmtpTransport };
