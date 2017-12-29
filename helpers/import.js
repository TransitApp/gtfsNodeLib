'use strict';

/* eslint-disable no-underscore-dangle */

const fs = require('fs-extra');

const eachWithLog = require('./logging_iterator_wrapper');
const { fromCsvStringToArray } = require('./csv');
const schema = require('./schema');

exports.importTable = (gtfs, tableName, options) => {
  options = options || {};
  const indexKeys = options.indexKeys || schema.indexKeysByTableName[tableName];
  const fullPath = `${gtfs.getPath() + tableName}.txt`;

  if (fs.existsSync(fullPath)) {
    const fileContent = fs.readFileSync(fullPath);
    const rows = getRows(fileContent, gtfs._regexPatternObjectsByTableName, tableName);

    gtfs._tables.set(tableName, processRows(gtfs, tableName, indexKeys, rows));
    return;
  }

  console.log(`Empty table will be set for table ${tableName} (no input file at path ${gtfs._path}).`);

  gtfs._tables.set(tableName, new Map());
};

/**
 * Private functions
 */

function getRows(buffer, regexPatternObjectsByTableName, tableName) {
  const rows = [];
  let rowsSlice;
  let position = 0;
  const length = 50000;
  let merge;
  const regexPatternObjects = regexPatternObjectsByTableName[tableName];

  while (position < buffer.length) {
    rowsSlice = buffer.toString('utf8', position, Math.min(buffer.length, position + length));

    if (regexPatternObjects) {
      regexPatternObjects.forEach((regexPatternObject) => {
        const modifiedRowsSlice = rowsSlice.replace(regexPatternObject.regex, regexPatternObject.pattern || '');
        if (modifiedRowsSlice !== rowsSlice) {
          if (process.notices && process.notices.addInfo) {
            process.notices.addInfo(
              __filename, `Applying regex replace to table: "${tableName}". regex: "${regexPatternObject.regex}".`
            );
          }
          rowsSlice = modifiedRowsSlice;
        }
      });
    }

    rowsSlice.split('\n').forEach((row, i) => {
      if (i === 0 && merge) {
        rows[rows.length - 1] += row;
      } else {
        rows.push(row);
      }
    });

    merge = rowsSlice[rowsSlice.length] !== '\n';
    position += length;
  }

  return rows;
}

function processRows(gtfs, tableName, indexKeys, rows) {
  let table = new Map();

  if (rows === undefined || rows === null || rows.length === 0) {
    return table;
  }

  const sortedKeys = fromCsvStringToArray(rows[0], tableName).map(key => key.trim());

  checkThatKeysIncludeIndexKeys(sortedKeys, indexKeys, tableName);

  eachWithLog(`Importation:${tableName}`, rows, (row, index) => {
    if (index !== 0 && row && row.length > 0) {
      const arrayOfValues = fromCsvStringToArray(row, tableName, gtfs).map(key => key.trim());

      if (arrayOfValues !== null) {
        const item = sortedKeys.reduce((accumulator, key, i) => {
          accumulator[key] = arrayOfValues[i];
          return accumulator;
        }, {});

        if (sortedKeys.length !== arrayOfValues.length) {
          if (process.notices && process.notices.addWarning) {
            process.notices.addWarning(`Row not valid in table: ${JSON.stringify(item)}`);
          }
          return;
        }

        if (indexKeys.indexKey) {
          table.set(item[indexKeys.indexKey], item);
        } else if (indexKeys.firstIndexKey && indexKeys.secondIndexKey) {
          if (table.has(item[indexKeys.firstIndexKey]) === false) {
            table.set(item[indexKeys.firstIndexKey], new Map());
          }

          table.get(item[indexKeys.firstIndexKey]).set(item[indexKeys.secondIndexKey], item);
        } else if (indexKeys.singleton) {
          table = item;
        }
      }
    }

    rows[index] = undefined;
  });

  return table;
}

function checkThatKeysIncludeIndexKeys(sortedKeys, indexKeys, tableName) {
  const deepness = (indexKeys.indexKey) ? 1 : 0;

  if (deepness === 1 && sortedKeys.includes(indexKeys.indexKey) === false && indexKeys.indexKey !== 'agency_id') {
    /* Field agency_id is optional in table agency.txt according to the specification. */
    throw new Error(
      `Keys of table ${tableName} do not contain the index key: ${indexKeys.indexKey}.\n` +
      ` The values are: ${JSON.stringify(indexKeys.indexKey)}`
    );
  }

  if (
    deepness === 2 &&
    (sortedKeys.includes(indexKeys.firstIndexKey) === false || sortedKeys.includes(indexKeys.secondIndexKey) === false)
  ) {
    throw new Error(
      `Keys of table ${tableName} do not contain the index keys: ` +
      `${indexKeys.firstIndexKey} and ${indexKeys.secondIndexKey}.\n` +
      ` The values are: ${JSON.stringify(indexKeys.indexKey)}`
    );
  }
}
