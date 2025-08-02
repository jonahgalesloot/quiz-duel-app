require('dotenv').config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.mailgun.org',
  port: 587,
  auth: {
    user: process.env.MAILGUN_USER,
    pass: process.env.MAILGUN_PASS
  }
});

async function sendMail({ to, subject, html }) {
  return transporter.sendMail({
    from: process.env.MAILGUN_FROM,
    to,
    subject,
    html
  });
}

module.exports = sendMail;
