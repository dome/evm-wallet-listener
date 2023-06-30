const BN = require('bignumber.js');

require('./service/mongoService');
const Status = require('./service/mongoService/status');
const { consumeQueue } = require('./service/queueService/rabbitMQ');
const { ethTransfer } = require('./utils/ethTransfer');
const { erc20Transfer, erc20Balance } = require('./utils/erc20Transfer');
const logger = require('./utils/logger');
const { sendNotificationMail } = require('./service/mailService');
const { CONFIG } = require('./config');
const { CHAIN, CUSTODIAN_WALLET, ADMIN_WALLET, RETRIES } = CONFIG.BLOCKCHAIN;

const getCurrentBlock = async (type) => {
  let status = await Status.findOne({ chain: CHAIN });
  return status.blockConsumedTransfer[type];
};

const isNotEmptyObject = (obj) => {
  if (obj) return Object.entries(obj).length;
  return false;
};

const updateCurrentBlock = async (newBlock, type) => {
  await Status.findOneAndUpdate(
    { chain: CHAIN },
    { $set: { [`blockConsumedTransfer.${type}`]: newBlock } }
  );
  logger.info(`Block ${newBlock} updated on DB`);
};

const calculateTotalEth = (valueList, toAddress) => {
  let sum = new BN(0);
  valueList.forEach((valueObj) => {
    let fromAddress = valueObj.fromAddress.toLowerCase();
    if (valueObj.value && fromAddress != CUSTODIAN_WALLET && toAddress != CUSTODIAN_WALLET)
      sum = sum.plus(new BN(valueObj.value));
    return;
  });
  return sum;
};

const getWallets = async (blockData) => {
  let userWallets = Object.keys(blockData.transactions).map((address) => {
    return {
      address: address,
      value: calculateTotalEth(blockData.transactions[address], address),
    };
  });

  return userWallets;
};

const sendERC20Tokens = async (contractAddress, tokenTransactions) => {
  let userWallets = Object.keys(tokenTransactions);
  const tokenTxns = [];
  for (let i = 0; i < userWallets.length; i++) {
    let address = userWallets[i];
    let erc20Value = await erc20Balance(address, contractAddress);
    if (erc20Value > 0) {
      tokenTxns.push(erc20Transfer(address, ADMIN_WALLET, erc20Value, contractAddress));
    }
  }
  await Promise.all(tokenTxns);
  return;
};

const tokenTransfer = async (blockData) => {
  const promises = Object.keys(blockData.transactions).map(async (contractAddress) => {
    return sendERC20Tokens(contractAddress, blockData.transactions[contractAddress]);
  });
  await Promise.all(promises);
  return;
};

const transferFromWallet = async (blockData) => {
  let LAST_UPDATED_BLOCK = await getCurrentBlock(blockData.type);

  if (blockData.block > LAST_UPDATED_BLOCK) {
    logger.info(`Processing block ${blockData.block}`);
    let retryIter = 0;
    while (true) {
      try {
        switch (blockData.type) {
          case 'coin':
            userWallets = await getWallets(blockData);
            for (let i = 0; i < userWallets.length; i++) {
              let wallet = userWallets[i];
              if (isNotEmptyObject(wallet)) {
                if (wallet.value > 0) await ethTransfer(wallet.address, ADMIN_WALLET, wallet.value);
              }
            }
            break;
          case 'erc20':
            await tokenTransfer(blockData);
            break;
        }
        await updateCurrentBlock(blockData.block);
        break;
      } catch (err) {
        if (retryIter < RETRIES) {
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
    }
  }
};

const main = async () => {
  consumeQueue(transferFromWallet);
};

main();
