'use strict';

/* eslint-disable no-underscore-dangle */

const infoLog = require('debug')('gtfsNodeLib:i');
const fs = require('fs-extra');

const eachWithLog = require('./logging_iterator_wrapper');
const { fromCsvStringToArray } = require('./csv');
const schema = require('./schema');

/**
 *
 * @param {Gtfs}   gtfs      The GTFS in which to import the table.
 * @param {string} tableName The table of the name to import.
 * @param {
 *   Map.<
 *     string,
 *     Array.<{regex: RegExp, pattern: string}>
 *   >
 * } [regexPatternObjectsByTableName] Optional ad-hoc regex to fix the tables. The keys are the tableName like defined
 *                                    in schema.js, the value are arrays containing pairs of regex and pattern to be
 *                                    applied on the raw table, before parsing. The goal is to fix some bad CSV to make
 *                                    them readable.
 *
 *                                    Example:
 *                                    The following raw is invalid according to the CSV specification:
 *
 *                                    > something,something else,a field "not" properly escaped,one last thing
 *
 *                                    It could be fixed with:
 *                                      { regex: /,a field "not" properly escaped,/g,
 *                                        pattern: ',a field ""not"" properly escaped,' }
 *
 *                                    The regexPatternObjectsByTableName would be:
 *
 *                                    regexPatternObjectsByTableName = {
 *                                      nameOfTheTable: [{
 *                                        regex: /,a field "not" properly escaped,/g,
 *                                        pattern: ',a field ""not"" properly escaped,',
 *                                      }]
 *                                    };
 */

exports.importTable = (gtfs, tableName, regexPatternObjectsByTableName) => {
  regexPatternObjectsByTableName = regexPatternObjectsByTableName || new Map();
  const indexKeys = schema.indexKeysByTableName[tableName];
  const fullPath = `${gtfs.getPath() + tableName}.txt`;

  if (fs.existsSync(fullPath)) {
    const fileContent = fs.readFileSync(fullPath);
    const rows = getRows(fileContent, regexPatternObjectsByTableName, tableName);

    gtfs._tables.set(tableName, processRows(gtfs, tableName, indexKeys, rows));
    return;
  }

  infoLog(`Empty table will be set for table ${tableName} (no input file at path ${gtfs._path}).`);

  gtfs._tables.set(tableName, new Map());
};

/**
 * Private functions
 */

function getRows(buffer, regexPatternObjectsByTableName, tableName) {
  const rows = [];
  let rowsSlice;
  let position = 0;
  const batchLength = 50000;
  let merge;
  const regexPatternObjects = regexPatternObjectsByTableName.get(tableName);

  while (position < buffer.length) {
    rowsSlice = buffer.toString('utf8', position, Math.min(buffer.length, position + batchLength));

    if (regexPatternObjects) {
      regexPatternObjects.forEach(({regex, pattern}) => {
        const modifiedRowsSlice = rowsSlice.replace(regex, pattern || '');
        if (modifiedRowsSlice !== rowsSlice) {
          process.notices.addInfo(
            __filename, `Applying regex replace to table: "${tableName}". regex: "${regexPatternObject.regex}".`
          );
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
    position += batchLength;
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
          process.notices.addWarning(__filename, `Row not valid in table: ${JSON.stringify(item)}`);
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
