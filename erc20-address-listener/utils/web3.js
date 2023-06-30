const Web3 = require('web3');

const { CONFIG } = require('../config');

const web3Provider = () =>
  new Web3.providers.WebsocketProvider(CONFIG.BLOCKCHAIN.WSS_PROVIDER_URL, {
    timeout: 30000, // ms

    clientConfig: {
      // Useful if requests are large
      maxReceivedFrameSize: 100000000, // bytes - default: 1MiB
      maxReceivedMessageSize: 100000000, // bytes - default: 8MiB

      // Useful to keep a connection alive
      keepalive: true,
      keepaliveInterval: 60000, // ms
    },

    // Enable auto reconnection
    reconnect: {
      auto: true,
      delay: 60000, // ms
      // maxAttempts: 5,
      onTimeout: true,
    },
  });

const web3 = new Web3(web3Provider());

const web3Reset = () => {
  web3.eth.clearSubscriptions();
  web3.setProvider(web3Provider());
};

module.exports = { web3, web3Reset };
