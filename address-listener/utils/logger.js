'use strict';

const { createLogger, format, transports } = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const os = require('os');
const { S3StreamLogger } = require('s3-streamlogger');
const { fromEnv } = require('@aws-sdk/credential-providers');

const { CONFIG, LOG_OPTIONS } = require('../config');
const { NODE_ENV, S3 } = CONFIG;

let transportOptions = null;
const file = LOG_OPTIONS.jsonFormat ? LOG_OPTIONS.jsonFile : LOG_OPTIONS.textFile;
const hostname = os.hostname();

const alignFormat = format.printf(({ timestamp, level, message, stack }) => {
  if (stack) {
    return `${timestamp} : [ ${level} ] : ${message}\n${stack}`;
  }
  return `${timestamp} : [ ${level} ] : ${message}`;
});

if (NODE_ENV !== 'development') {
  const s3Stream = new S3StreamLogger({
    bucket: S3.BUCKET,
    config: {
      credentials: fromEnv(),
      region: S3.REGION,
    },
    folder: `${S3.FOLDER}/Address-Listener`,
    max_file_size: '20000000',
    name_format: `%Y-%m-%d-%H-%M-Address-Listener-Logs-${hostname}.log`,
    rotate_every: '2592000000', // in milliseconds (30 days)
  });
  transportOptions = [
    new transports.Stream({
      stream: s3Stream,
    }),
  ];
} else {
  transportOptions = [
    new DailyRotateFile(file),
    new transports.Console({
      format: format.combine(format.errors({ stack: true }), format.colorize(), alignFormat),
    }),
  ];
}

const logger = createLogger({
  level: LOG_OPTIONS.level,
  format: LOG_OPTIONS.jsonFormat
    ? format.combine(
        format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        format.json()
      )
    : format.combine(
        format.errors({ stack: true }),
        format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        alignFormat
      ),
  transports: transportOptions,
  exitOnError: false,
});

module.exports = logger;
