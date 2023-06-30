const web3 = require('./web3');

let NONCE = {};

const walletValidator = (wallet) => {
  if (!wallet) throw Error('Wallet not received');
  if (!web3.utils.isAddress(wallet)) throw Error('Invalid address');
};

const init = async (wallet) => {
  walletValidator(wallet);
  NONCE[wallet] = await web3.eth.getTransactionCount(wallet, 'pending');
};

const updateNonce = (wallet) => {
  walletValidator(wallet);
  NONCE[wallet]++;
};

const getNonce = async (wallet) => {
  // walletValidator(wallet);
  // if (!NONCE[wallet]) await init(wallet);
  // return NONCE[wallet]++;
  return await web3.eth.getTransactionCount(wallet, 'pending');
};

module.exports = {
  init,
  updateNonce,
  getNonce,
};
