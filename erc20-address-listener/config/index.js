'use strict';

const config = require('./env.js');
const dbConstants = require('./dbConstants.js');
const logOptions = require('./logOptions.js');
const tokens = require('./tokens.js');

module.exports = {
  CONFIG: config,
  DB_CONSTANTS: dbConstants,
  LOG_OPTIONS: logOptions,
  TOKENS: tokens,
};
