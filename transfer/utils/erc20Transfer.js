const keythereum = require('keythereum');
const { Common } = require('@ethereumjs/common');
const { Transaction: Tx } = require('@ethereumjs/tx');

const web3 = require('./web3');
const { CONFIG, CHAINS, ABI } = require('../config');
const Wallet = require('../service/mongoService/wallet');
const txnBuilder = require('./txnBuilder');
const { ethGasTransfer } = require('./ethTransfer');
const logger = require('./logger');

const erc20Transfer = async (from, to, value, contractAddress) => {
  await ethGasTransfer(from, to, value, contractAddress);
  const fromWallet = await Wallet.findOne({ address: from });
  const privateKeyG = keythereum.recover(fromWallet.private, fromWallet.keystore);

  const privateKey = new Buffer.from(privateKeyG, 'hex');

  const txObject = await txnBuilder.token(from, to, value, contractAddress);
  //Sign transaction before sending
  const common = getCommonObject();
  const tx = Tx.fromTxData(txObject, { common });
  const signedTxn = tx.sign(privateKey);
  const serializedTx = signedTxn.serialize();

  const receipt = await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'));
  logger.info(`Transaction Successful : \n${JSON.stringify(receipt)}`);
  return receipt;
};

const erc20Balance = async (wallet, contractAddress) => {
  const myContract = new web3.eth.Contract(ABI, contractAddress);
  let balance = await myContract.methods.balanceOf(wallet).call();

  return balance;
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
  erc20Transfer,
  erc20Balance,
};
