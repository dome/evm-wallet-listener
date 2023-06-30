const amqp = require('amqplib');

const logger = require('../../utils/logger');
const { CONFIG } = require('../../config');
const { CONN_URL, TXNS_QUEUE: QUEUE } = CONFIG.QUEUE;

let ch = null;

const createConn = async () => {
  conn = await amqp.connect(CONN_URL);
  ch = await conn.createChannel();
};

createConn();

exports.publishToQueue = async (data) => {
  if (!data) return;
  if (!ch) await createConn();
  await ch.assertQueue(QUEUE);
  if (data) {
    await ch.sendToQueue(QUEUE, Buffer.from(JSON.stringify(data)), { persistent: true });
    logger.info('Published to queue');
  }
};

exports.publishBatchToQueue = async (data) => {
  if (!ch) await createConn();
  await ch.assertQueue(QUEUE);
  for (item of data) {
    if (item) {
      await ch.sendToQueue(QUEUE, Buffer.from(JSON.stringify(item)), { persistent: true });
    }
  }
  logger.info('Batch publish successful');
};

process.on('exit', (code) => {
  ch.close();
  logger.warn(`Closing rabbitmq channel`);
});
