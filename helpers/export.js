'use strict';

/* eslint-disable no-underscore-dangle */

const async = require('async');
const infoLog = require('debug')('gtfsNodeLib:i');
const warningLog = require('debug')('gtfsNodeLib:w');
const errorLog = require('debug')('gtfsNodeLib:e');
const fs = require('fs-extra');
const Papa = require('papaparse');

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
  const actualKeys = gtfs.getActualKeysForTable(tableName);
  const firstRow = `${actualKeys.join(',')}`;
  const outputFullPath = `${outputPath + tableName}.txt`;

  fs.writeFile(outputFullPath, firstRow, (writeError) => {
    if (writeError) {
      throw writeError;
    }

    const indexKeys = gtfs._schema.indexKeysByTableName[tableName];

    if (indexKeys.singleton) {
      let item = gtfs.getIndexedTable(tableName);
      if (!item) {
        callback();
        return;
      }

      if (gtfs._preExportItemFunction) {
        item = gtfs._preExportItemFunction(item, tableName);
      }

      const formattedGtfsRowValues = getObjectValuesUsingKeyOrdering(item, actualKeys);
      const row = Papa.unparse({
        fields: actualKeys,
        data: formattedGtfsRowValues,
      },
      {
        header: false,
      });

      fs.appendFile(outputFullPath, `\r\n${row}`, callback);
      return;
    }

    const deepness = gtfs._schema.deepnessByTableName[tableName];

    let rows = [];

    /*
      About why the async wrapper is used inside the async.eachSeries:
      If the function async.eachSeries runs without doing anything, just calling the callback (which
      happens when there are a lot of empty objects), it crashes. It is a known bug of async.
      They don't fix it due to performance reasons (see Common Pitfalls - https://caolan.github.io/async/v3/)
      To deal with this, we simply wrap the possible asynchronous function with the keyword async.
      The ES2017 async functions are returned as-is.
      This is useful for preventing stack overflows (RangeError: Maximum call stack size exceeded),
      and generally keeping Zalgo contained. Hence, Async Functions are immune to Zalgo's corrupting influences,
      as they always resolve on a later tick.
      More info on Zalgo (https://blog.izs.me/2013/08/designing-apis-for-asynchrony)
    */
    async.eachSeries(gtfs.getIndexedTable(tableName), async ([key, object]) => {
      if (deepness === 0 || deepness === 1) {
        if (gtfs._preExportItemFunction) {
          object = gtfs._preExportItemFunction(object, tableName, key);
        }

        const formattedGtfsRowValues = getObjectValuesUsingKeyOrdering(object, actualKeys);
        const row = Papa.unparse({
          fields: actualKeys,
          data: formattedGtfsRowValues,
        },
        {
          header: false,
        });

        rows.push(`\r\n${row}`);
      } else if (deepness === 2) {
        object.forEach((subObject, subKey) => {
          if (gtfs._preExportItemFunction) {
            subObject = gtfs._preExportItemFunction(subObject, tableName, key, subKey);
          }

          const formattedGtfsRowValues = getObjectValuesUsingKeyOrdering(subObject, actualKeys);
          const row = Papa.unparse({
            fields: actualKeys,
            data: formattedGtfsRowValues,
          },
          {
            header: false,
          });

          rows.push(`\r\n${row}`);
        });
      }

      if (rows.length < 100) {
        return;
      }

      await fs.appendFile(outputFullPath, rows.join(''));
      rows = [];
    }, (asyncEachSeriesError) => {
      if (asyncEachSeriesError) {
        throw asyncEachSeriesError;
      }

      if (rows.length === 0) {
        infoLog(`[${getHHmmss()}] Table has been exported: ${tableName}`);
        callback();
        return;
      }

      fs.appendFile(outputFullPath, rows.join(''), (appendingError) => {
        if (appendingError) { throw appendingError; }

        infoLog(`[${getHHmmss()}] Table has been exported: ${tableName}`);
        callback();
      });
    });
  });
}

function getObjectValuesUsingKeyOrdering(object, keys) {
  return keys.map((key) => {
    let value = object[key];

    if (value === undefined || value === null) {
      return '';
    }

    const type = typeof value;
    if (type === 'object') {
      value = JSON.stringify(value);
    } else if (type !== 'string') {
      value = String(value);
    }

    return value;
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
