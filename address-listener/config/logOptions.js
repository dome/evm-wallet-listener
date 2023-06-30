const path = require('path');

const logOptions = {
  level: 'debug',
  jsonFormat: false,
  textFile: {
    filename: 'log',
    dirname: path.join(__dirname, '../logs'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '30d',
    utc: true,
    extension: '.txt',
  },
  jsonFile: {
    filename: 'log',
    dirname: path.join(__dirname, '../logs'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '30d',
    utc: true,
    extension: '.json',
  },
};

module.exports = logOptions;
