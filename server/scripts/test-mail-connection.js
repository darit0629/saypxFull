require('dotenv').config();
const { ImapFlow } = require('imapflow');
const nodemailer = require('nodemailer');

async function testImap() {
  console.log('--- IMAP ---');
  console.log('host:', process.env.MAIL_IMAP_HOST, 'port:', process.env.MAIL_IMAP_PORT);
  const client = new ImapFlow({
    host: process.env.MAIL_IMAP_HOST,
    port: Number(process.env.MAIL_IMAP_PORT),
    secure: true,
    auth: { user: process.env.MAIL_ADDRESS, pass: process.env.MAIL_PASSWORD },
    logger: false,
  });
  try {
    await client.connect();
    console.log('IMAP LOGIN: OK');
    const list = await client.list();
    console.log('Folders:', list.map((f) => `${f.path} (delimiter=${f.delimiter})`));
    await client.logout();
    return true;
  } catch (e) {
    console.error('IMAP FAILED:', e.message);
    return false;
  }
}

async function testSmtp() {
  console.log('--- SMTP ---');
  console.log('host:', process.env.MAIL_SMTP_HOST, 'port:', process.env.MAIL_SMTP_PORT);
  const transport = nodemailer.createTransport({
    host: process.env.MAIL_SMTP_HOST,
    port: Number(process.env.MAIL_SMTP_PORT),
    secure: true,
    auth: { user: process.env.MAIL_ADDRESS, pass: process.env.MAIL_PASSWORD },
  });
  try {
    await transport.verify();
    console.log('SMTP VERIFY: OK');
    return true;
  } catch (e) {
    console.error('SMTP FAILED:', e.message);
    return false;
  }
}

(async () => {
  const imapOk = await testImap();
  const smtpOk = await testSmtp();
  console.log('\nSummary: IMAP', imapOk ? 'OK' : 'FAILED', '| SMTP', smtpOk ? 'OK' : 'FAILED');
  process.exit(imapOk && smtpOk ? 0 : 1);
})();
