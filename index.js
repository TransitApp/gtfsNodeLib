'use strict';

const infoLog = require('debug')('gtfsNodeLib:i');
const warningLog = require('debug')('gtfsNodeLib:w');

const Gtfs = require('./gtfs');

/* Fallback to replace Transit's internal notice system */

if (process.notices === undefined) {
  process.notices = {
    addInfo: (title, content) => { infoLog(`[Info] ${title}:\n${content}`); },
    addWarning: (title, content) => { warningLog(`[Warning] ${title}:\n${content}`); },
  }
}

module.exports = {
  Gtfs,
};
