const amqp = require('amqplib');

const logger = require('../../utils/logger');
const { CONFIG } = require('../../config');
const { CONN_URL, TRANSFER_QUEUE: QUEUE } = CONFIG.QUEUE;
const { init } = require('../../utils/nonceManager');

let ch = null;

const createConn = async () => {
  conn = await amqp.connect(CONN_URL);
  ch = await conn.createChannel();
};

createConn();

exports.consumeQueue = async (method) => {
  if (!ch) await createConn();

  await ch.assertQueue(QUEUE);
  await ch.prefetch(1);
  await ch.consume(
    QUEUE,
    async (msg) => {
      let out = msg.content.toString();
      out = JSON.parse(out);
      try {
        await method(out);
        ch.ack(msg);
      } catch (err) {
        if (CONFIG.BLOCKCHAIN.CUSTODIAN_WALLET) {
          await init(CONFIG.BLOCKCHAIN.CUSTODIAN_WALLET);
        }
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
