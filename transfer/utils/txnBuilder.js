const BN = require('bignumber.js');

const web3 = require('./web3');
const { ABI, CONFIG } = require('../config');
const { getNonce } = require('./nonceManager');
const logger = require('./logger');

module.exports.token = async (from, to, value, contractAddress) => {
  const myContract = new web3.eth.Contract(ABI, contractAddress);
  const nonce = await getNonce(from);
  let gasPrice = await web3.eth.getGasPrice();
  gasPrice = BN(gasPrice).plus(BN(8000000000));

  let txObject = {};
  txObject.nonce = web3.utils.toHex(nonce);
  txObject.gasPrice = '0x' + gasPrice.toString(16);
  txObject.to = contractAddress;
  txObject.from = from;
  txObject.value = '0x00';
  txObject.data = await myContract.methods.transfer(to, value).encodeABI();
  txObject.gasLimit = await myContract.methods.transfer(to, value).estimateGas({ from });

  logger.info(`ERC20 Transaction Build : \n${JSON.stringify(txObject)}`);
  return txObject;
};

module.exports.coin = async (from, to, value) => {
  const nonce = await getNonce(from);

  let gasPrice = await web3.eth.getGasPrice();
  gasPrice = BN(gasPrice).plus(BN(8000000000));

  let gasLimit = await web3.eth.estimateGas({ from, to, value });
  gasLimit = BN(gasLimit);

  const txCost = BN(gasPrice).times(gasLimit);
  const amount = BN(value).minus(txCost).toString(16);
  const txObject = {};
  txObject.nonce = web3.utils.toHex(nonce);
  txObject.gasLimit = '0x' + gasLimit.toString(16);
  txObject.gasPrice = '0x' + gasPrice.toString(16);
  txObject.to = to;
  txObject.from = from;
  txObject.value = '0x' + amount;

  logger.info(`Transaction Build : \n${JSON.stringify(txObject)}`);
  return txObject;
};
