'use strict';

const mongoose = require('mongoose');

const { CONFIG } = require('../../config');
const logger = require('../../utils/logger');

mongoose.connect(CONFIG.DB.URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;

db.on('error', (err) => logger.error(`MongoDB connection error - ${err.toString()}`));

db.once('open', () => logger.info('MongoDB connected'));
