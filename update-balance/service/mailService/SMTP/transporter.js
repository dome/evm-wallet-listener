const nodemailer = require('nodemailer');

const { CONFIG } = require('../../../config');

// Create a transporter object using SMTP transport
exports.transporter = nodemailer.createTransport({
  host: CONFIG.MAIL.SMTP.HOST, // replace with your email provider's SMTP server
  port: CONFIG.MAIL.SMTP.HOST,
  secure: false, // true for 465, false for other ports
  auth: {
    user: CONFIG.MAIL.SMTP.USERNAME, // replace with your email address
    pass: CONFIG.MAIL.SMTP.PASSWORD, // replace with your email password
  },
});
