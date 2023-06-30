const BN = require('bignumber.js');
const keythereum = require('keythereum');
const { Common } = require('@ethereumjs/common');
const { Transaction: Tx } = require('@ethereumjs/tx');

const web3 = require('./web3');
const { CONFIG, CHAINS } = require('../config');
const Wallet = require('../service/mongoService/wallet');
const txnBuilder = require('./txnBuilder');
const logger = require('./logger');

const ethGasTransfer = async (from, to, value, contractAddress) => {
  logger.info('Transferring Gas Fee');
  //Token transfer transaction fee calculation
  const { gasPrice, gasLimit } = await txnBuilder.token(from, to, value, contractAddress);
  const tokenTxCost = BN(gasPrice).times(gasLimit);

  const userEthBalance = await web3.eth.getBalance(from);
  if (tokenTxCost.gt(userEthBalance)) {
    const custodialWalletEthBalance = await web3.eth.getBalance(CONFIG.BLOCKCHAIN.CUSTODIAN_WALLET);
    if (BN(custodialWalletEthBalance).lte(tokenTxCost)) {
      throw Error('Please recharge custodial admin wallet!');
    }
    //ETH transfer transaction fee calculation
    const ethTxnObject = await txnBuilder.coin(
      CONFIG.BLOCKCHAIN.CUSTODIAN_WALLET,
      from,
      value,
      tokenTxCost.toString()
    );
    const txCost = BN(ethTxnObject.gasLimit).times(BN(ethTxnObject.gasPrice));

    const fee = txCost.plus(tokenTxCost).minus(BN(userEthBalance)).toString();

    logger.info(`Calculated gas fee : ${fee.toString()}`);

    await ethTransfer(CONFIG.BLOCKCHAIN.CUSTODIAN_WALLET, from, fee);

    logger.info(`Gas fee transferred successfully.`);
  } else {
    logger.info(`Custodial wallet have balance for gas.`);
  }

  return;
};

const ethTransfer = async (from, to, value) => {
  const balance = await web3.eth.getBalance(from);
  if (BN(balance).lt(BN(5).times(BN(10).pow(BN(15))))) {
    logger.error('ERROR: Amount less than 0.005 ETH!');
    return true;
  }

  const fromWallet = await Wallet.findOne({ address: from });
  const privateKeyG = keythereum.recover(fromWallet.private, fromWallet.keystore);
  const privateKey = new Buffer.from(privateKeyG, 'hex');

  const txObject = await txnBuilder.coin(from, to, value);
  //Sign transaction before sending
  const common = getCommonObject();
  const tx = Tx.fromTxData(txObject, { common });
  const signedTxn = tx.sign(privateKey);
  const serializedTx = signedTxn.serialize();

  const receipt = await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'));
  logger.info(`Transaction Successful : \n${JSON.stringify(receipt)}`);
  return receipt;
};
const getCommonObject = () => {
  const { CHAIN, NETWORK } = CONFIG.BLOCKCHAIN;
  if (CHAIN === 'ETH') {
    return new Common(CHAINS[CHAIN][NETWORK]);
  } else {
    return Common.custom(CHAINS[CHAIN][NETWORK]);
  }
};

module.exports = {
  ethTransfer,
  ethGasTransfer,
};
