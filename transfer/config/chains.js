module.exports = {
  ETH: {
    mainnet: { chain: 'mainnet' },
    testnet: { chain: 'sepolia' },
  },
  BNB: {
    mainnet: {
      name: 'Binance Smart Chain',
      chainId: 56,
    },
    testnet: {
      name: 'Binance Smart Chain Testnet',
      chainId: 97,
    },
  },
  MATIC: {
    mainnet: {
      name: 'polygon-mainnet',
      chainId: 137,
    },
    testnet: {
      name: 'polygon-mumbai',
      chainId: 80001,
    },
  },
  FTM: {
    mainnet: {
      name: 'fantom_mainnet',
      chainId: 250,
    },
    testnet: {
      name: 'fantom_testnet',
      chainId: 4002,
    },
  },
};
