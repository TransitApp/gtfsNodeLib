'use strict';

/* eslint-disable no-underscore-dangle */

const acomb = require('acomb');
const async = require('async');
const fs = require('fs-extra');

const { fromObjectToCsvString } = require('./csv');
const schema = require('./schema');

/**
 * Private functions
 */

function getHHmmss() {
  const date = new Date();
  return `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
}

function resetOutputFolder(outputPath, callback) {
  fs.remove(outputPath, (removeError) => {
    if (removeError) {
      callback(removeError);
      return;
    }

    fs.mkdirp(outputPath, (makeDirectoryError) => {
      if (makeDirectoryError) {
        callback(makeDirectoryError);
        return;
      }

      callback();
    });
  });
}

function copyUntouchedTable(inputPath, outputPath, tableName, callback) {
  const fullPathToInputFile = `${inputPath + tableName}.txt`;
  const fullPathToOutputFile = `${outputPath + tableName}.txt`;

  fs.open(fullPathToInputFile, 'r', (err) => {
    if (err && err.code === 'ENOENT') {
      console.log(`[${getHHmmss()}] Table doesn't exist and won't be added: ${tableName}`);
      callback();
      return;
    }
    if (err) {
      console.log(err);
      callback();
      return;
    }

    fs.copy(fullPathToInputFile, fullPathToOutputFile, (copyError) => {
      if (copyError) {
        console.log(copyError);
      }

      console.log(`[${getHHmmss()}] Table has been copied: ${tableName}`);
      callback();
    });
  });
}

function getActualKeysForTable(gtfs, tableName) {
  const deepness = schema.deepnessByTableName[tableName];
  let sampleItem;

  if (deepness === 0) {
    sampleItem = gtfs.getIndexedTable(tableName);
  } else if (deepness === 1) {
    sampleItem = gtfs.getIndexedTable(tableName).values().next().value;
  } else if (deepness === 2) {
    sampleItem = gtfs.getIndexedTable(tableName).values().next().value.values().next().value;
  }

  const keys = [...schema.keysByTableName[tableName]];

  if (sampleItem) {
    Object.keys(sampleItem).forEach((key) => {
      if (schema.keysByTableName[tableName].includes(key) === false) {
        keys.push(key);
      }
    });
  }

  if (keys.length === 0) {
    throw new Error(`No keys found for table ${tableName}`);
  }

  return keys;
}

function exportTable(tableName, gtfs, outputPath, callback) {
  const keys = getActualKeysForTable(gtfs, tableName);
  const outputFullPath = `${outputPath + tableName}.txt`;
  const firstRow = `${keys.join(',')}\n`;

  fs.writeFile(outputFullPath, firstRow, (err) => {
    if (err) { throw err; }
    /* About acomb.ensureAsync:
      If the function async.eachSeries run without doing anything, just calling the callback (which
      happens when there is a lot of empty object), it crashes. It is a known bug of async.
      The acomb.ensureAsync fonction prevent that. It should be removed when the async module
      will be fixed.
      2015-03-10
    */
    const deepness = schema.deepnessByTableName[tableName];

    if (deepness === 0) {
      const row = fromObjectToCsvString(gtfs.getIndexedTable(tableName), keys);
      fs.appendFile(outputFullPath, row, callback);
      return;
    }

    let rowsBuffer = [];

    async.eachSeries(gtfs.getIndexedTable(tableName), acomb.ensureAsync(([key, object], subDone) => {
      if (deepness === 1) {
        rowsBuffer.push(fromObjectToCsvString(object, keys));
      } else if (deepness === 2) {
        object.forEach((subObject) => {
          rowsBuffer.push(fromObjectToCsvString(subObject, keys));
        });
      }

      if (rowsBuffer.length < 100) {
        subDone();
        return;
      }

      fs.appendFile(outputFullPath, rowsBuffer.join(''), (appendingError) => {
        if (appendingError) { throw appendingError; }

        rowsBuffer = [];
        subDone();
      });
    }), () => {
      if (rowsBuffer.length === 0) {
        console.log(`[${getHHmmss()}] Table has been exported: ${tableName}`);
        callback();
        return;
      }

      fs.appendFile(outputFullPath, rowsBuffer.join(''), (appendingError) => {
        if (appendingError) { throw appendingError; }

        console.log(`[${getHHmmss()}] Table has been exported: ${tableName}`);
        callback();
      });
    });
  });
}

/**
 * Public function
 */

exports.exportGtfs = (gtfs, outputPath, callback) => {
  if (typeof outputPath !== 'string') {
    throw new Error(`Gtfs need a valid output path as string, instead of: "${outputPath}".`);
  }
  if (outputPath.match(/\/$/) === null) {
    outputPath += '/';
  }

  resetOutputFolder(outputPath, (resetOutputFolderError) => {
    if (resetOutputFolderError) {
      callback(resetOutputFolderError);
      return;
    }

    console.log(`Will start exportation of tables: ${Array.from(gtfs.getTableNames()).join(', ')}`);

    async.eachSeries(gtfs.getTableNames(), (tableName, done) => {
      if (gtfs._tables.has(tableName) === true) {
        console.log(`[${getHHmmss()}] Table will be exported: ${tableName}`);
        exportTable(tableName, gtfs, outputPath, done);
      } else {
        console.log(`[${getHHmmss()}] Table will be copied: ${tableName}`);
        copyUntouchedTable(gtfs.getPath(), outputPath, tableName, done);
      }
    }, callback);
  });
};
