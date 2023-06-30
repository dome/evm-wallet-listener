const { NODE_ENV } = require('./env');

const TOKENS = {
  development: {
    ETH: {
      decimals: 18,
      paymentType: 2,
      isToken: false,
    },
    USDC: {
      address: '0x9ad8098c1164e7571114c8b9be03461444b7f2ce',
      decimals: 6,
      paymentType: 8,
      isToken: true,
    },
    BNB: {
      decimals: 18,
      paymentType: 10,
      isToken: false,
    },
    MATIC: {
      decimals: 18,
      paymentType: 18,
      isToken: false,
    },
    USDT: {
      address: '0xcc948daddd98754e38b510d12c1313c15ffc4f48',
      decimals: 6,
      paymentType: 21,
      isToken: true,
    },
    FTM: {
      decimals: 18,
      paymentType: 22,
      isToken: false,
    },
  },
  staging: {
    ETH: {
      decimals: 18,
      paymentType: 2,
      isToken: false,
    },
    USDC: {
      address: '0x9ad8098c1164e7571114c8b9be03461444b7f2ce',
      decimals: 6,
      paymentType: 8,
      isToken: true,
    },
    BNB: {
      decimals: 18,
      paymentType: 10,
      isToken: false,
    },
    MATIC: {
      decimals: 18,
      paymentType: 18,
      isToken: false,
    },
    USDT: {
      address: '0xcc948daddd98754e38b510d12c1313c15ffc4f48',
      decimals: 6,
      paymentType: 21,
      isToken: true,
    },
    FTM: {
      decimals: 18,
      paymentType: 22,
      isToken: false,
    },
  },
  production: {
    ETH: {
      decimals: 18,
      paymentType: 2,
      isToken: false,
    },
    USDC: {
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      decimals: 6,
      paymentType: 8,
      isToken: true,
    },
    BNB: {
      decimals: 18,
      paymentType: 10,
      isToken: false,
    },
    MATIC: {
      decimals: 18,
      paymentType: 18,
      isToken: false,
    },
    USDT: {
      address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
      decimals: 6,
      paymentType: 21,
      isToken: true,
    },
    FTM: {
      decimals: 18,
      paymentType: 22,
      isToken: false,
    },
  },
};

module.exports = TOKENS[NODE_ENV];
