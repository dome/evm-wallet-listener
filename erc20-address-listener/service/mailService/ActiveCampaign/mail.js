const axios = require('axios');
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
      const mailPromises = [];
      for (let mail of CONFIG.MAIL.RECEIVERS) {
        const options = {
          method: 'PUT',
          url: `${CONFIG.MAIL.AC.URI}/contacts/${CONFIG.MAIL.AC.ID}`,
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'Api-Key': CONFIG.MAIL.AC.API_KEY,
          },
          data: {
            contact: {
              email: mail,
              firstName: 'Admin',
              fieldValues: [
                {
                  field: '26',
                  value: CONFIG.NODE_ENV,
                },
                {
                  field: '27',
                  value: CONFIG.BLOCKCHAIN.CHAIN,
                },
                {
                  field: '28',
                  value: 'ERC20 Address Listener',
                },
                {
                  field: '29',
                  value: JSON.stringify(error),
                },
                {
                  field: '30',
                  value: formattedCurrentTime,
                },
              ],
            },
          },
        };

        mailPromises.push(axios.request(options));
      }

      await Promise.all(mailPromises);
      logger.info('Notification mails sent!');
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
