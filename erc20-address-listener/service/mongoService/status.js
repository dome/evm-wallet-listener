'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const { CHAINS } = require('../../config');

const statusSchema = new Schema(
  {
    chain: {
      type: String,
      require: true,
      unique: true,
      validate: {
        validator: (value) => Object.values(CHAINS).includes(value),
        message: 'Unsupported Chain!',
      },
    },
    blockInserted: {
      coin: { type: Number, default: 0 },
      erc20: { type: Number, default: 0 },
    },
    blockConsumedWalletFilter: {
      coin: { type: Number, default: 0 },
      erc20: { type: Number, default: 0 },
    },
    blockConsumedTransfer: {
      coin: { type: Number, default: 0 },
      erc20: { type: Number, default: 0 },
    },
    blockConsumedUpdate: {
      coin: { type: Number, default: 0 },
      erc20: { type: Number, default: 0 },
    },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: 'updated_at',
    },
  }
);

const Status = mongoose.model('blockStatus', statusSchema);
module.exports = Status;
