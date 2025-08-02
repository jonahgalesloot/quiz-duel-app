require('dotenv').config();
const nodemailer = require('nodemailer');

console.log('[EMAIL] Initializing transporter...');
const transporter = nodemailer.createTransport({
  host: 'smtp.mailgun.org',
  port: 587,
  auth: {
    user: process.env.MAILGUN_USER,
    pass: process.env.MAILGUN_PASS
  }
});

async function sendMail({ to, subject, html }) {
  console.log('[EMAIL] Preparing to send email...');
  console.log('[EMAIL] From:', process.env.MAILGUN_FROM);
  console.log('[EMAIL] To:', to);
  console.log('[EMAIL] Subject:', subject);
  // Optionally log the HTML or a snippet
  console.log('[EMAIL] HTML snippet:', html && html.slice(0, 100) + (html.length > 100 ? '...' : ''));

  try {
    const info = await transporter.sendMail({
      from: process.env.MAILGUN_FROM,
      to,
      subject,
      html
    });
    console.log('[EMAIL] Email sent:', info);
    return info;
  } catch (err) {
    console.error('[EMAIL] Error sending email:', err);
    throw err;
  }
}

module.exports = sendMail;
