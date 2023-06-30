require('./service/mongoService');
const CronJob = require('cron').CronJob;

const { CONFIG, TOKENS } = require('./config');
const Status = require('./service/mongoService/status');
const { publishToQueue, publishBatchToQueue } = require('./service/queueService/rabbitMQ');
const { web3, web3Reset } = require('./utils/web3');
const { sendNotificationMail } = require('./service/mailService');
const logger = require('./utils/logger');

const { CHAIN, ERC20_TOKENS, BLOCK_CONFIRMATIONS, BATCH_SIZE, RETRIES, ERC20_TRANSFER_TOPIC } =
  CONFIG.BLOCKCHAIN;

let isAlive = true;
let MUTEX = false;

const getCurrentBlock = async () => {
  let status = await Status.findOne({ chain: CHAIN });
  return status.blockInserted.erc20;
};

const updateCurrentBlock = async (newBlock) => {
  await Status.findOneAndUpdate({ chain: CHAIN }, { $set: { 'blockInserted.erc20': newBlock } });
  logger.info(`Block ${newBlock} updated on DB`);
};

const sortBlockList = (blockList) => {
  return blockList.sort((firstEl, SecondEl) => firstEl.block - SecondEl.block);
};

const extractInfo = (blockLogs) => {
  if (Array.isArray(blockLogs))
    return blockLogs.reduce((acc, log) => {
      acc.push({
        contract: log.address,
        txHash: log.transactionHash,
        fromAddress: log.topics[1],
        toAddress: log.topics[2],
        value: log.data,
      });
      return acc;
    }, []);

  return {
    contract: blockLogs.address,
    txHash: blockLogs.transactionHash,
    fromAddress: blockLogs.topics[1],
    toAddress: blockLogs.topics[2],
    value: blockLogs.data,
  };
};

const getLogs = async (block = {}) => {
  if (!block.fromBlock) block.fromBlock = block.toBlock;

  const tokens = ERC20_TOKENS.map((token) => {
    if (TOKENS[token] && TOKENS[token].isToken && TOKENS[token].address.length === 42) {
      return TOKENS[token].address;
    } else {
      logger.error(`Please add configuration of ${token}`);
    }
  });

  const filter = {
    fromBlock: block.fromBlock,
    toBlock: block.toBlock,
    address: tokens,
    topics: [ERC20_TRANSFER_TOPIC],
  };

  return await web3.eth.getPastLogs(filter);
};

const getLogsForBlock = async (blockNumber) => {
  blockLogs = await getLogs({ toBlock: blockNumber });
  extracted = extractInfo([...blockLogs]);

  return {
    block: blockNumber,
    type: 'erc20',
    transactions: extracted,
  };
};

const bundleLogs = (batch) => {
  let blockFiltered = batch.reduce((blockFiltered, log) => {
    if (!blockFiltered[log.blockNumber]) blockFiltered[log.blockNumber] = [extractInfo({ ...log })];
    else blockFiltered[log.blockNumber].push(extractInfo({ ...log }));

    return blockFiltered;
  }, {});

  return Object.keys(blockFiltered).map((block) => {
    return {
      block: block,
      type: 'erc20',
      transactions: blockFiltered[block],
    };
  });
};

const blockReader = async (block) => {
  if (!MUTEX) {
    let CURRENT_BLOCK = await getCurrentBlock();

    if (block.number - BLOCK_CONFIRMATIONS - CURRENT_BLOCK > 1) {
      logger.warn(`Detected missing blocks`);
      await catchUp(CURRENT_BLOCK + 1, block.number - BLOCK_CONFIRMATIONS);
    } else {
      let retryIter = 0;
      while (true) {
        try {
          result = await getLogsForBlock(block.number - BLOCK_CONFIRMATIONS);
          await publishToQueue(result);
          await updateCurrentBlock(block.number - BLOCK_CONFIRMATIONS);
          isAlive = true;
          break;
        } catch (err) {
          if (retryIter < RETRIES) {
            logger.error(err);
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
    }
  }
};

const batchExecuter = async (startBlock, endBlock) => {
  if (startBlock <= endBlock) {
    let execList = [];
    try {
      result = await Promise.all(execList);
      batched = await getLogs({
        fromBlock: startBlock,
        toBlock: endBlock,
      });

      result = bundleLogs(batched);
      sortBlockList(result);
      await publishBatchToQueue(result);
      await updateCurrentBlock(endBlock);
    } catch (error) {
      logger.info(error);
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
        logger.error('All attempts failed, Exiting...');
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
      logger.info('Reconnecting...', err);
      web3Reset();
      setTimeout(subscribeBlock, 5000);
    });
};

const main = async () => {
  if (ERC20_TOKENS.length) {
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
  } else {
    logger.warn('Not listening to any ERC20 tokens since it is not configured in .env');
  }
};

main();
