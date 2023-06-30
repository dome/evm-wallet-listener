'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const config = require('../../config');

const walletSchema = new Schema({
  address: {
    type: String,
    unique: true
  },
  private: String,
  role: {
    type: Number,
    enum: Object.values(config.DB_CONSTANTS.WALLET.ROLE)
  },
  status: {
    type: Number,
    enum: Object.values(config.DB_CONSTANTS.WALLET.STATUS)
  },
  keystore: Schema.Types.Mixed
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

const Wallet = mongoose.model('account_collections_eths', walletSchema);
module.exports = Wallet;
