const { transporter } = require('./transporter');
const MailStatus = require('../../mongoService/mailStatus');
const { CONFIG } = require('../../../config');
const logger = require('../../../utils/logger');

const sendNotificationMail = async (error) => {
  const currentMailStatus = await getMailStatus();
  const currentTime = new Date().getTime() / 1000;
  const isMailBlocked = currentTime - currentMailStatus < CONFIG.MAIL.INTERVAL * 60 * 60;
  if (!isMailBlocked && CONFIG.NODE_ENV !== 'development') {
    try {
      const formattedCurrentTime = getCurrentTime();
      const message = {
        from: CONFIG.MAIL.SMTP.SENDER, // replace with your email address
        to: CONFIG.MAIL.RECEIVERS, // replace with recipient's email address
        subject: `ICO - Wallet Listener Issue on ${CONFIG.PROJECT_NAME.toUpperCase()}-${CONFIG.NODE_ENV.toUpperCase()}-${CONFIG.BLOCKCHAIN.CHAIN.toUpperCase()} instance - Wallet Identifier - ${formattedCurrentTime}`,
        text: `Hi, \n\nWallet Listener is facing issues. Application might have stopped syncing. Please resolve it as soon as possible.\n\n ${error}`,
      };
      await transporter.sendMail(message);
      logger.info('Notification mail sent!');
      await updateMailStatus();
    } catch (error) {
      logger.error(`Error in sending Notification mail : ${error}`);
    }
  }
  return;
};

const getCurrentTime = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // getMonth() returns zero-based month, so we add 1
  const day = now.getDate();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const timezoneOffset = now.getTimezoneOffset();

  const timezoneOffsetHours = Math.floor(Math.abs(timezoneOffset) / 60);
  const timezoneOffsetMinutes = Math.abs(timezoneOffset) % 60;
  const timezoneOffsetSign = timezoneOffset < 0 ? '-' : '+';
  const formattedTimezoneOffset = `${timezoneOffsetSign}${timezoneOffsetHours
    .toString()
    .padStart(2, '0')}:${timezoneOffsetMinutes.toString().padStart(2, '0')}`;

  const formattedDate = `${year}-${month.toString().padStart(2, '0')}-${day
    .toString()
    .padStart(2, '0')}`;
  const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${seconds.toString().padStart(2, '0')} ${formattedTimezoneOffset}`;

  return `${formattedDate} ${formattedTime}`;
};

const getMailStatus = async () => {
  let status = await MailStatus.findOne({ chain: CONFIG.BLOCKCHAIN.CHAIN });
  return status.lastMail;
};

const updateMailStatus = async () => {
  const currentTimestamp = new Date().getTime() / 1000;
  await MailStatus.findOneAndUpdate(
    { chain: CONFIG.BLOCKCHAIN.CHAIN },
    { $set: { lastMail: currentTimestamp } }
  );
  logger.info(`Mail Status updated on DB: ${currentTimestamp}`);
};

module.exports = { sendNotificationMail };
