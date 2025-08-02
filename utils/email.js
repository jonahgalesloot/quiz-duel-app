// utils/email.js
require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('[EMAIL] Initializing transporter...');

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,        // e.g. "smtp-relay.sendinblue.com"
  port: Number(process.env.MAIL_PORT),// e.g. 587
  secure: false,                      // true if you use port 465
  auth: {
    user: process.env.MAIL_USER,      // your Brevo SMTP login
    pass: process.env.MAIL_PASS       // your Brevo SMTP key
  }
});

async function sendMail({ to, subject, html }) {
  console.log('[EMAIL] Preparing to send email…');
  console.log('[EMAIL] From:', process.env.MAIL_FROM);
  console.log('[EMAIL] To:', to);
  console.log('[EMAIL] Subject:', subject);
  console.log('[EMAIL] HTML snippet:', html && html.slice(0, 100) + (html.length > 100 ? '...' : ''));

  try {
    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to,
      subject,
      html
    });
    console.log('[EMAIL] Email sent:', info.messageId);
    return info;
  } catch (err) {
    console.error('[EMAIL] Error sending email:', err);
    throw err;
  }
}

module.exports = sendMail;
