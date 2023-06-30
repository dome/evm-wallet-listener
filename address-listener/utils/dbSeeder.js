const BN = require('bignumber.js');

const Status = require('../service/mongoService/status');
const logger = require('../utils/logger');
const { web3 } = require('../utils/web3');

const { CONFIG } = require('../config');
const { DB, BLOCKCHAIN } = CONFIG;

exports.dbSeeder = async () => {
  const status = await Status.findOne({ chain: BLOCKCHAIN.CHAIN });

  if (DB.CURRENT_BLOCK_OVERRIDE.toString() === 'true') {
    logger.info(`Overriding existing block status...`);
    await updateLastBlockUpdated(DB.CURRENT_BLOCK);
    process.env.CURRENT_BLOCK_OVERRIDE = false;
    DB.CURRENT_BLOCK_OVERRIDE = false;
  } else if (!status) {
    logger.info(`Updating block status to latest...`);
    const block = await getLatestBlock();
    await updateLastBlockUpdated(block);
  } else {
    logger.info(`Block status already exists on DB.`);
  }
  return;
};

const getLatestBlock = async () => {
  const block = await web3.eth.getBlockNumber();
  return BN(block).minus(BN(BLOCKCHAIN.BLOCK_CONFIRMATIONS)).toNumber();
};

const updateLastBlockUpdated = async (block) => {
  const Data = {
    chain: BLOCKCHAIN.CHAIN,
    blockInserted: {
      coin: block,
      erc20: block,
    },
    blockConsumedWalletFilter: {
      coin: block,
      erc20: block,
    },
    blockConsumedTransfer: {
      coin: block,
      erc20: block,
    },
    blockConsumedUpdate: {
      coin: block,
      erc20: block,
    },
  };

  await Status.findOneAndUpdate({ chain: BLOCKCHAIN.CHAIN }, { $set: Data }, { upsert: true });
  logger.info(`Block status updated on DB. Start block set to ${block}.`);
};
