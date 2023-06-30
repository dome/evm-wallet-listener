const Web3 = require('web3');

const { CONFIG } = require('../config');

const web3Provider = () => new Web3.providers.HttpProvider(CONFIG.BLOCKCHAIN.HTTP_PROVIDER_URL);

const web3 = new Web3(web3Provider());

module.exports = web3;
