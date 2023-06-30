const amqp = require('amqplib');

const logger = require('../../utils/logger');
const { CONFIG } = require('../../config');
const { CONN_URL, TXNS_QUEUE } = CONFIG.QUEUE;

let ch = null;

const createConn = async () => {
  conn = await amqp.connect(CONN_URL);
  ch = await conn.createChannel();
};

createConn();

exports.publishToQueue = async (QUEUE, data) => {
  if (!data) return;
  if (!ch) await createConn();
  await ch.assertQueue(QUEUE);
  if (data) {
    await ch.sendToQueue(QUEUE, Buffer.from(JSON.stringify(data)), { persistent: true });
    logger.info(`Published to queue ${QUEUE}`);
  }
};

exports.consumeQueue = async (method) => {
  if (!ch) await createConn();

  await ch.assertQueue(TXNS_QUEUE);
  await ch.prefetch(1);
  await ch.consume(
    TXNS_QUEUE,
    async (msg) => {
      let out = msg.content.toString();
      out = JSON.parse(out);
      try {
        await method(out);
        ch.ack(msg);
      } catch (err) {
        logger.error('Error while consuming queue,\n', err);
      }
    },
    { noAck: false }
  );
};

process.on('exit', (code) => {
  ch.close();
  logger.warn(`Closing rabbitmq channel`);
});
