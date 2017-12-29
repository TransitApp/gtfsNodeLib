'use strict';

const Gtfs = require('./gtfs');

/* Fallback to replace Transit's internal notice system */

if (process.notices === undefined) {
  process.notices = {
    addInfo: (title, content) => { console.log(`[Info] ${title}:\n${content}`); },
    addWarning: (title, content) => { console.log(`[Warning] ${title}:\n${content}`); },
  }
}

module.exports = {
  Gtfs,
};
