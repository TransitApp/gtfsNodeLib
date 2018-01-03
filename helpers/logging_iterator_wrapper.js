'use strict';

const infoLog = require('debug')('gtfsNodeLib:i');

module.exports = (prefix, valueByKey, iteratee) => {
  if (
    valueByKey instanceof Array === false &&
    valueByKey instanceof Map === false &&
    valueByKey instanceof Set === false
  ) {
    throw new Error('valueByKey should be an Array, a Map or a Set.');
  }

  let lastLogAt = Date.now();
  let numberOfKeysDone = 0;
  let interval = 2000;
  let oneProgressionLogHasBeenPrinted = false;

  valueByKey.forEach((value, key) => {
    iteratee(value, key);

    numberOfKeysDone += 1;

    if (Date.now() - lastLogAt > interval && process.env.TEST === undefined) {
      const percentageDone = (numberOfKeysDone / valueByKey.size) * 100;
      infoLog(`[${prefix}] ${percentageDone.toPrecision(2)}% done`);

      lastLogAt = Date.now();
      oneProgressionLogHasBeenPrinted = true;
      interval = (interval < 10000) ? interval + 2000 : 10000;
    }
  });

  if (oneProgressionLogHasBeenPrinted && process.env.TEST === undefined) {
    infoLog(`[${prefix}] Done`);
  }
};
