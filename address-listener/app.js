require('./service/mongoService');
const CronJob = require('cron').CronJob;
const Status = require('./service/mongoService/status');
const { publishToQueue, publishBatchToQueue } = require('./service/queueService/rabbitMQ');
const { web3, web3Reset } = require('./utils/web3');
const { sendNotificationMail } = require('./service/mailService');
const { dbSeeder } = require('./utils/dbSeeder');
const logger = require('./utils/logger');
const { CONFIG } = require('./config');

const { CHAIN, CUSTODIAN_WALLET, BLOCK_CONFIRMATIONS, BATCH_SIZE, RETRIES } = CONFIG.BLOCKCHAIN;

let isAlive = true;
let MUTEX = false;

const getCurrentBlock = async () => {
  let status = await Status.findOne({ chain: CHAIN });
  return status.blockInserted.coin;
};

const updateCurrentBlock = async (newBlock) => {
  await Status.findOneAndUpdate({ chain: CHAIN }, { $set: { 'blockInserted.coin': newBlock } });
  logger.info(`Block ${newBlock} updated on DB`);
};

const sortBlockList = (blockList) => {
  return blockList.sort((firstEl, SecondEl) => firstEl.block - SecondEl.block);
};

const listReceived = (block) => {
  if (!block) return;

  let received = {};

  received.transactions = {};
  received.block = block.number;
  received.type = 'coin';

  let transactions = block.transactions;
  for (let transaction of transactions) {
    if (
      transaction.value !== '0' &&
      transaction.to &&
      transaction.from.toLowerCase() != CUSTODIAN_WALLET.toLowerCase() &&
      transaction.to.toLowerCase() != CUSTODIAN_WALLET.toLowerCase()
    ) {
      if (received.transactions[transaction.to])
        received.transactions[transaction.to].push({
          fromAddress: transaction.from,
          txHash: transaction.hash,
          value: transaction.value,
        });
      else
        received.transactions[transaction.to] = [
          {
            fromAddress: transaction.from,
            txHash: transaction.hash,
            value: transaction.value,
          },
        ];
    }
  }
  return received;
};

const getBlock = async (blockNumber) => {
  let block = await web3.eth.getBlock(blockNumber, true);
  let received = listReceived(block);
  return received;
};

const blockReader = async (block) => {
  logger.info(`Received new block ${block.number}`);
  logger.info(`Processing block ${block.number - BLOCK_CONFIRMATIONS}`);
  if (!MUTEX) {
    let CURRENT_BLOCK = await getCurrentBlock();

    if (block.number - BLOCK_CONFIRMATIONS - CURRENT_BLOCK > 1) {
      logger.warn(`Detected missing blocks`);
      await catchUp(CURRENT_BLOCK + 1, block.number - BLOCK_CONFIRMATIONS);
    } else {
      let retryIter = 0;
      while (true) {
        try {
          result = await getBlock(block.number - BLOCK_CONFIRMATIONS);
          await publishToQueue(result);
          await updateCurrentBlock(block.number - BLOCK_CONFIRMATIONS);
          isAlive = true;
          break;
        } catch (err) {
          if (retryIter < RETRIES) {
            retryIter++;
            logger.error(err);
            logger.error(`Error: ${err},"\n Retry attempt ${retryIter}`);
            web3Reset();
          } else {
            logger.error('All attempts failed, exiting...');
            await sendNotificationMail(err);
            setTimeout(() => {
              process.exit(1);
            }, 300000);
          }
        }
      }
    }
  }
};

const batchExecuter = async (startBlock, endBlock) => {
  if (startBlock <= endBlock) {
    let execList = [];
    for (block = startBlock; block <= endBlock; block++) {
      execList.push(getBlock(block));
    }
    try {
      result = await Promise.all(execList);
      sortBlockList(result);
      await publishBatchToQueue(result);
      await updateCurrentBlock(endBlock);
    } catch (error) {
      logger.error(error);
      throw Error('Error calling api...');
    }
  }
};

const catchUp = async (startBlock, endBlock) => {
  MUTEX = true;
  logger.info(`Catching up ${endBlock - startBlock} blocks..`);
  let blockInit = startBlock;
  let retryIter = 0;

  while (blockInit + (BATCH_SIZE - 1) <= endBlock) {
    try {
      logger.info(`Processing ${blockInit} to ${blockInit + (BATCH_SIZE - 1)}`);
      await batchExecuter(blockInit, blockInit + (BATCH_SIZE - 1));
      if (retryIter) retryIter = 0;
      blockInit += BATCH_SIZE;
      isAlive = true;
    } catch (err) {
      MUTEX = false;
      if (retryIter < RETRIES) {
        retryIter++;
        logger.error(`Error: ${err},"\n Retry attempt ${retryIter}`);
        web3Reset();
      } else {
        logger.error('All attempts failed, exiting...');
        await sendNotificationMail(err);
        setTimeout(() => {
          process.exit(1);
        }, 300000);
      }
    }
  }

  while (true) {
    try {
      logger.info(`Processing ${blockInit} to ${endBlock}`);
      await batchExecuter(blockInit, endBlock);
      isAlive = true;
      break;
    } catch (err) {
      MUTEX = false;
      if (retryIter < RETRIES) {
        retryIter++;
        logger.error(`Error: ${err},"\n Retry attempt ${retryIter}`);
        web3Reset();
      } else {
        logger.error('All attempts failed, exiting...');
        await sendNotificationMail(err);
        setTimeout(() => {
          process.exit(1);
        }, 300000);
      }
    }
  }

  MUTEX = false;
};

const subscribeBlock = () => {
  logger.info(`Subscribing to ${CHAIN} blocks`);
  subscription = web3.eth
    .subscribe('newBlockHeaders')
    .on('data', blockReader)
    .on('error', (err) => {
      logger.error('Reconnecting...', err);
      web3Reset();
      setTimeout(subscribeBlock, 5000);
    });
};

const main = async () => {
  await dbSeeder();
  new CronJob({
    cronTime: '0 */10 * * * *',
    onTick: async () => {
      if (!isAlive) {
        logger.error('Exiting because no block data received for some time!');
        await sendNotificationMail('APP_IDLE!');
        setTimeout(() => {
          process.exit(1);
        }, 300000);
      }
      isAlive = false;
    },
    start: true,
    runOnInit: true,
  });
  subscribeBlock();
};

main();
