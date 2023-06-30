'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const { CHAINS } = require('../../config');

const statusSchema = new Schema({
  chain: {
    type: String,
    require: true,
    unique: true,
    validate: {
      validator: (value) => Object.values(CHAINS).includes(value),
      message: 'Unsupported Chain!',
    },
  },
  lastMail: {
    type: NumberLong,
    default: 0,
  },
});

const MailStatus = mongoose.model('mailStatus', statusSchema);
module.exports = MailStatus;
