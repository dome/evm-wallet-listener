const { hexToNumberString } = require('web3-utils');

require('./service/mongoService');
const Status = require('./service/mongoService/status');
const Wallet = require('./service/mongoService/wallet');
const { publishToQueue, consumeQueue } = require('./service/queueService/rabbitMQ');
const logger = require('./utils/logger');
const { sendNotificationMail } = require('./service/mailService');
const { CONFIG } = require('./config');

const { TRANSFER_QUEUE, UPDATE_QUEUE } = CONFIG.QUEUE;
const { CHAIN, RETRIES } = CONFIG.BLOCKCHAIN;

const getCurrentBlock = async (type) => {
  let status = await Status.findOne({ chain: CHAIN });
  return status.blockConsumedWalletFilter[type];
};

const isNotEmptyObject = (obj) => {
  if (obj) return Object.entries(obj).length;
  return false;
};

const updateCurrentBlock = async (newBlock, type) => {
  await Status.findOneAndUpdate(
    { chain: CHAIN },
    {
      $set: {
        [`blockConsumedWalletFilter.${type}`]: newBlock,
      },
    }
  );
  logger.info(`Block ${newBlock} updated on DB`);
};

const normalizeErc20Address = (address) => {
  let START = 2;
  let END = 26;

  return (address.substring(0, START) + address.substring(END)).toLowerCase();
};

const normalizeErc20Transactions = (transactions) => {
  return transactions.map((transaction) => {
    return {
      contract: transaction.contract.toLowerCase(),
      txHash: transaction.txHash,
      fromAddress: normalizeErc20Address(transaction.fromAddress),
      toAddress: normalizeErc20Address(transaction.toAddress),
      value: hexToNumberString(transaction.value),
    };
  });
};

const filterEthUserWallets = (blockData, userWallets) => {
  let transactions = blockData.transactions;
  let transactionsFiltered = {};

  for (let wallet of Object.keys(userWallets)) {
    if (transactions[userWallets[wallet]])
      transactionsFiltered[wallet] = transactions[userWallets[wallet]];
  }

  blockData.transactions = transactionsFiltered;
  return;
};

const filterErc20UserWallets = (blockData, userWallets) => {
  let transactions = blockData.transactions;
  let transactionsFiltered = {};

  for (let transaction of transactions) {
    let toAddress = transaction.toAddress;
    let contract = transaction.contract;

    if (userWallets[toAddress]) {
      if (!transactionsFiltered[contract]) transactionsFiltered[contract] = {};

      if (!transactionsFiltered[contract][toAddress])
        transactionsFiltered[contract][toAddress] = [];

      transactionsFiltered[contract][toAddress].push({
        fromAddress: transaction.fromAddress,
        txHash: transaction.txHash,
        value: transaction.value,
      });
    }
  }

  blockData.transactions = transactionsFiltered;
  return;
};

const ethGetWallets = async (blockData) => {
  let blockAddresses = Object.keys(blockData.transactions).reduce((list, address) => {
    list[address.toLowerCase()] = address;
    return list;
  }, {});
  let userWallets = await Wallet.find({
    address: { $in: Object.keys(blockAddresses) },
  });
  let userWalletList = {};
  for (let wallet of userWallets) {
    if (blockAddresses[wallet.address])
      userWalletList[wallet.address] = blockAddresses[wallet.address];
  }

  return userWalletList;
};

const erc20GetWallets = async (blockData) => {
  blockData.transactions = normalizeErc20Transactions(blockData.transactions);

  let blockAddresses = blockData.transactions.reduce((list, transaction) => {
    list[transaction.toAddress] = true;
    return list;
  }, {});

  let userWallets = await Wallet.find({
    address: { $in: Object.keys(blockAddresses) },
  });

  return userWallets.reduce((wallets, wallet) => {
    wallets[wallet.address] = true;
    return wallets;
  }, {});
};

const matchWallets = async (blockData) => {
  let LAST_UPDATED_BLOCK = await getCurrentBlock(blockData.type);
  let getWallets = null;
  let filterUserWallets = null;

  if (blockData.block > LAST_UPDATED_BLOCK) {
    logger.info(`Processing block ${blockData.block}`);
    try {
      switch (blockData.type) {
        case 'coin':
          getWallets = ethGetWallets;
          filterUserWallets = filterEthUserWallets;
          break;

        case 'erc20':
          getWallets = erc20GetWallets;
          filterUserWallets = filterErc20UserWallets;
          break;
      }
      userWallets = await getWallets(blockData);
      filterUserWallets(blockData, userWallets);

      const txnCount = isNotEmptyObject(blockData.transactions);
      logger.info(`Detected transactions : ${txnCount}`);

      if (txnCount) {
        await publishToQueue(TRANSFER_QUEUE, blockData);
        await publishToQueue(UPDATE_QUEUE, blockData);
      }
    } catch (err) {
      if (retryIter < RETRIES) {
        logger.error(err);
        retryIter++;
        logger.error(`Error: ${err},"\n Retry attempt ${retryIter}`);
      } else {
        logger.error('All attempts failed, exiting...');
        await sendNotificationMail(err);
        setTimeout(() => {
          process.exit(1);
        }, 300000);
      }
    }
    await updateCurrentBlock(blockData.block, blockData.type);
  }
  return;
};

const main = async () => {
  consumeQueue(matchWallets);
};

main();
