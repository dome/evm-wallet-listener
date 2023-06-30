const BN = require('bignumber.js');
const axios = require('axios');
const qs = require('qs');

require('./service/mongoService');
const Status = require('./service/mongoService/status');
const { consumeQueue } = require('./service/queueService/rabbitMQ');
const logger = require('./utils/logger');
const { sendNotificationMail } = require('./service/mailService');
const { CONFIG, TOKENS } = require('./config');

const { RETRIES, CHAIN, BLOCK_CONFIRMATIONS } = CONFIG.BLOCKCHAIN;
const { URI, AUTH_TOKEN } = CONFIG.BACKEND;

const getCurrentBlock = async (type) => {
  let status = await Status.findOne({ chain: CHAIN });
  return status.blockConsumedUpdate[type];
};

const isNotEmptyObject = (obj) => {
  if (obj) return Object.entries(obj).length;
  return false;
};

const updateCurrentBlock = async (newBlock, type) => {
  await Status.findOneAndUpdate(
    { chain: CHAIN },
    { $set: { [`blockConsumedUpdate.${type}`]: newBlock } }
  );
  logger.info(`Block ${newBlock} updated on DB`);
};

const updateTransactionDetails = async (walletTransaction) => {
  let payload = {
    type: 'amountadded',
    secret_key: AUTH_TOKEN,
    adminTransactionId: '12345',
    confirmations: BLOCK_CONFIRMATIONS,
    ...walletTransaction,
  };

  logger.info(`Sending payload : \n${JSON.stringify(payload)}`);

  payload = qs.stringify(payload);

  let config = {
    method: 'post',
    url: `${URI}/customer/initiateTransaction.php`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    data: payload,
  };

  try {
    let res = await axios(config);
    logger.info(`API Call Successful: \n${JSON.stringify(res.data)}`);
  } catch (err) {
    logger.error(`API Call Failed: ${JSON.stringify(err.message)}`);
    throw Error(JSON.stringify(err.response.data));
  }
};

const EthWalletTransactionsUpdate = async (address, addressTransactions) => {
  return Promise.all(
    addressTransactions.map(async (transaction) => {
      if (transaction.value > 0) {
        const value = BN(transaction.value).div(BN(10).pow(BN(TOKENS[CHAIN].decimals)));
        return updateTransactionDetails({
          toAddress: address,
          fromAddress: transaction.fromAddress,
          spendCoins: value.gt(BN(0)) ? value.toNumber() : value.toString(),
          transId: transaction.txHash,
          paymentType: TOKENS[CHAIN].paymentType,
        });
      }
      return true;
    })
  );
};

const getTokenCode = (contractAddress) => {
  for (const key in TOKENS) {
    if (TOKENS[key].isToken && TOKENS[key].address === contractAddress) {
      return key;
    }
  }
  return null;
};

const ERC20WalletTransactionsUpdate = async (contractAddress, address, addressTransactions) => {
  return Promise.all(
    addressTransactions.map(async (transaction) => {
      let token = getTokenCode(contractAddress);
      if (transaction.value > 0) {
        const value = BN(transaction.value).div(BN(10).pow(BN(TOKENS[token].decimals)));
        return updateTransactionDetails({
          toAddress: address,
          fromAddress: transaction.fromAddress,
          spendCoins: value.gt(BN(0)) ? value.toNumber() : value.toString(),
          transId: transaction.txHash,
          paymentType: TOKENS[token].paymentType,
        });
      }
      return true;
    })
  );
};

const ERC20ContractTransactionsUpdate = async (contractAddress, contractAddressTransactions) => {
  return Promise.all(
    Object.keys(contractAddressTransactions).map(async (address) => {
      return ERC20WalletTransactionsUpdate(
        contractAddress,
        address,
        contractAddressTransactions[address]
      );
    })
  );
};

const pushEthTransactionDetails = async (transactions) => {
  return Promise.all(
    Object.keys(transactions).map((address) => {
      return EthWalletTransactionsUpdate(address, transactions[address]);
    })
  );
};

const pushERC20TransactionDetails = async (transactions) => {
  return Promise.all(
    Object.keys(transactions).map((address) => {
      return ERC20ContractTransactionsUpdate(address, transactions[address]);
    })
  );
};

const pushTransferDetails = async (blockData) => {
  let pushTransactionDetails = null;

  let LAST_UPDATED_BLOCK = await getCurrentBlock(blockData.type);

  if (blockData.block > LAST_UPDATED_BLOCK) {
    logger.info(`Processing block ${blockData.block}`);
    if (isNotEmptyObject(blockData.transactions)) {
      let retryIter = 0;
      while (true) {
        try {
          switch (blockData.type) {
            case 'coin':
              pushTransactionDetails = pushEthTransactionDetails;
              break;
            case 'erc20':
              pushTransactionDetails = pushERC20TransactionDetails;
              break;
          }
          await pushTransactionDetails(blockData.transactions);
          await updateCurrentBlock(blockData.block, blockData.type);
          break;
        } catch (err) {
          logger.error(err);
          if (retryIter < RETRIES) {
            retryIter++;
            logger.error(`"\n Retry attempt ${retryIter}`);
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
  return;
};

const main = async () => {
  consumeQueue(pushTransferDetails);
};

main();
