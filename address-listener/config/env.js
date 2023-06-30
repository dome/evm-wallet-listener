'use strict';

const env = {
  PROJECT_NAME: process.env.PROJECT_NAME,
  NODE_ENV: process.env.NODE_ENV || 'development',
  BLOCKCHAIN: {
    CHAIN: process.env.CHAIN || 'ETH',
    NETWORK: process.env.NETWORK || 'testnet',
    WSS_PROVIDER_URL: process.env.WSS_PROVIDER_URL,
    HTTP_PROVIDER_URL: process.env.HTTP_PROVIDER_URL,
    ADMIN_WALLET: process.env.ADMIN_WALLET,
    BLOCK_CONFIRMATIONS: Number(process.env.BLOCK_CONFIRMATIONS) || 1,
    BATCH_SIZE: Number(process.env.BATCH_SIZE) || 20,
    RETRIES: Number(process.env.RETRIES) || 3,
    ERC20_TOKENS: JSON.parse(process.env.ERC20_TOKENS) || ['USDT', 'USDC'],
    CUSTODIAN_WALLET: process.env.CUSTODIAN_WALLET,
    ERC20_TRANSFER_TOPIC: '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
  },
  QUEUE: {
    CONN_URL: process.env.RMQ_CONN_URL || `amqp://rabbitmq-${process.env.CHAIN}:5672`,
    TXNS_QUEUE: process.env.RMQ_TXNS_QUEUE || 'txns_queue',
    TRANSFER_QUEUE: process.env.RMQ_TRANSFER_QUEUE || 'transfer_queue',
    UPDATE_QUEUE: process.env.RMQ_UPDATE_QUEUE || 'update_queue',
  },
  DB: {
    URI: process.env.DB_URI || 'mongodb://mongo:27017/tokensale',
    CURRENT_BLOCK: process.env.CURRENT_BLOCK,
    CURRENT_BLOCK_OVERRIDE: process.env.CURRENT_BLOCK_OVERRIDE,
  },
  BACKEND: {
    URI: process.env.BACKEND_URI || 'http://localhost:3000/api',
    AUTH_TOKEN: process.env.BACKEND_AUTH_TOKEN,
  },
  S3: {
    BUCKET: process.env.S3_BUCKET,
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
    API_VERSION: process.env.API_VERSION || '2014-11-01',
    REGION: process.env.S3_REGION,
    FOLDER: process.env.S3_FOLDER,
  },
  MAIL: {
    INTERVAL: process.env.MAIL_INTERVAL,
    RECEIVERS: JSON.parse(process.env.MAIL_RECEIVERS),
    SMTP: {
      USERNAME: process.env.SMTP_USERNAME,
      PASSWORD: process.env.SMTP_PASSWORD,
      HOST: process.env.SMTP_HOST,
      PORT: process.env.SMTP_PORT,
      SENDER: process.env.SMTP_SENDER,
    },
    AC: {
      URI: process.env.AC_URI,
      ID: process.env.AC_ID,
      API_KEY: process.env.AC_API_KEY,
    },
  },
};
module.exports = env;
