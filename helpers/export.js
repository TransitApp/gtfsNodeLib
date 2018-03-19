'use strict';

/* eslint-disable no-underscore-dangle */

const acomb = require('acomb');
const async = require('async');
const infoLog = require('debug')('gtfsNodeLib:i');
const warningLog = require('debug')('gtfsNodeLib:w');
const errorLog = require('debug')('gtfsNodeLib:e');
const fs = require('fs-extra');

const { fromObjectToCsvString } = require('./csv');

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
      warningLog(`[${getHHmmss()}] Table doesn't exist and won't be added: ${tableName}`);
      callback();
      return;
    }
    if (err) {
      errorLog(err);
      callback();
      return;
    }

    fs.copy(fullPathToInputFile, fullPathToOutputFile, (copyError) => {
      if (copyError) {
        errorLog(copyError);
      }

      infoLog(`[${getHHmmss()}] Table has been copied: ${tableName}`);
      callback();
    });
  });
}

function exportTable(tableName, gtfs, outputPath, callback) {
  const keys = gtfs.getActualKeysForTable(tableName);
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
    const deepness = gtfs._schema.deepnessByTableName[tableName];

    if (deepness === 0) {
      let item = gtfs.getIndexedTable(tableName);
      if (item) {
        if (gtfs._preExportItemFunction) {
          item = gtfs._preExportItemFunction(item, tableName);
        }
        const row = fromObjectToCsvString(item, keys);
        fs.appendFile(outputFullPath, row, callback);
      }
      callback();
      return;
    }

    let rowsBuffer = [];

    async.eachSeries(gtfs.getIndexedTable(tableName), acomb.ensureAsync(([key, object], subDone) => {
      if (deepness === 1) {
        if (gtfs._preExportItemFunction) {
          object = gtfs._preExportItemFunction(object, tableName, key);
        }
        rowsBuffer.push(fromObjectToCsvString(object, keys));
      } else if (deepness === 2) {
        object.forEach((subObject, subKey) => {
          if (gtfs._preExportItemFunction) {
            subObject = gtfs._preExportItemFunction(subObject, tableName, key, subKey);
          }
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
        infoLog(`[${getHHmmss()}] Table has been exported: ${tableName}`);
        callback();
        return;
      }

      fs.appendFile(outputFullPath, rowsBuffer.join(''), (appendingError) => {
        if (appendingError) { throw appendingError; }

        infoLog(`[${getHHmmss()}] Table has been exported: ${tableName}`);
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

    infoLog(`Will start exportation of tables: ${Array.from(gtfs.getTableNames()).join(', ')}`);

    async.eachSeries(gtfs.getTableNames(), (tableName, done) => {
      if (gtfs._tables.has(tableName) === true) {
        infoLog(`[${getHHmmss()}] Table will be exported: ${tableName}`);
        exportTable(tableName, gtfs, outputPath, done);
      } else {
        infoLog(`[${getHHmmss()}] Table will be copied: ${tableName}`);
        copyUntouchedTable(gtfs.getPath(), outputPath, tableName, done);
      }
    }, callback);
  });
};
