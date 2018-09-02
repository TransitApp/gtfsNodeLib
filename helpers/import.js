'use strict';

/* eslint-disable no-underscore-dangle */

const infoLog = require('debug')('gtfsNodeLib:i');
const fs = require('fs-extra');
const { StringDecoder } = require('string_decoder');

const eachWithLog = require('./logging_iterator_wrapper');
const { fromCsvStringToArray } = require('./csv');

/**
 * Import a table in the GTFS.
 *
 * @param {Gtfs}   gtfs      The GTFS in which to import the table.
 * @param {string} tableName The table of the name to import.
 */

exports.importTable = (gtfs, tableName) => {
  const indexKeys = gtfs._schema.indexKeysByTableName[tableName];
  const fullPath = `${gtfs.getPath() + tableName}.txt`;

  if (fs.existsSync(fullPath)) {
    const fileContent = fs.readFileSync(fullPath);
    const rows = getRows(fileContent, gtfs._regexPatternObjectsByTableName.get(tableName), tableName);

    gtfs._tables.set(tableName, processRows(gtfs, tableName, indexKeys, rows, gtfs._shouldThrow));
  } else {
    infoLog(`Empty table will be set for table ${tableName} (no input file at path ${gtfs._path}).`);

    gtfs._tables.set(tableName, (indexKeys.setOfItems) ? new Set() : new Map());
  }

  if (gtfs._postImportItemFunction) {
    if (indexKeys.singleton) {
      gtfs._postImportItemFunction(gtfs.getIndexedTable(tableName));
    } else {
      gtfs.forEachItemInTable(tableName, gtfs._postImportItemFunction);
    }
  }
};

/**
 * Private functions
 */

function getRows(buffer, regexPatternObjects, tableName) {
  const rows = [];
  let rowsSlice;
  let position = 0;
  const batchLength = 50000;
  let merge;
  /*
   Use string decoder to properly decode utf8 characters. Characters not in the basic ASCII take more
   than one byte.

   If the end of the batch cuts one of those characters, then we will yield weird characters.

   decoder will accumulate any "lost" utf8 character at the end of the batch and accumulate it for the next
   iteration.
    */
  const decoder = new StringDecoder('utf8');

  while (position < buffer.length) {
    rowsSlice = decoder.write(buffer.slice(position, Math.min(buffer.length, position + batchLength)));

    if (regexPatternObjects) {
      regexPatternObjects.forEach(({ regex, pattern }) => {
        const modifiedRowsSlice = rowsSlice.replace(regex, pattern || '');

        if (modifiedRowsSlice !== rowsSlice) {
          process.notices.addInfo(__filename, `Applying regex replace to table: "${tableName}". regex: "${regex}".`);
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

function processRows(gtfs, tableName, indexKeys, rows, shouldThrow) {
  let table = (indexKeys.setOfItems) ? new Set() : new Map();

  if (rows === undefined || rows === null || rows.length === 0) {
    return table;
  }

  const sortedKeys = fromCsvStringToArray(rows[0], tableName).map(key => key.trim());

  // eslint-disable-next-line func-names
  const GtfsRow = function GtfsRowConstructor(arrayOfValues) {
    // Use one letter far to use less memory
    // Since this object will be repeated millions of time
    Object.defineProperty(this, 'v', {
      value: arrayOfValues,
      enumerable: false, // Enumerable false allow us to now show 'v' in enum of item
    });
  };

  // eslint-disable-next-line func-names
  GtfsRow.prototype.clone = function clone() {
    return new GtfsRow(JSON.parse(JSON.stringify(this.v)));
  };

  // eslint-disable-next-line func-names
  GtfsRow.prototype.toJSON = function clone() {
    const jsonObj = {};

    for (const key of Object.keys(this)) {
      jsonObj[key] = this[key];
    }

    for (const key in Object.getPrototypeOf(this)) {
      const value = this[key];
      if (typeof value !== 'function') {
        jsonObj[key] = this[key];
      }
    }

    return JSON.stringify(jsonObj);
  };

  for (const [index, key] of sortedKeys.entries()) {
    Object.defineProperty(GtfsRow.prototype, key, {
      get() {
        return this.v[index];
      },
      set(newValue) {
        this.v[index] = newValue;
      },
      configurable: true,
      enumerable: true,
    });
  }

  checkThatKeysIncludeIndexKeys(sortedKeys, indexKeys, tableName);

  eachWithLog(`Importation:${tableName}`, rows, (row, index) => {
    if (index === 0 || !row || !row.trim) {
      return;
    }

    row = row.trim();

    if (row.length === 0) {
      return;
    }

    const arrayOfValues = fromCsvStringToArray(row, tableName, gtfs).map(key => key.trim());

    if (arrayOfValues !== null) {
      const item = new GtfsRow(arrayOfValues);

      if (sortedKeys.length !== arrayOfValues.length) {
        if (shouldThrow === true) {
          throw new Error(`Invalid raw in table ${tableName}: ${JSON.stringify(item)}`);
        }

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
      } else if (indexKeys.setOfItems) {
        table.add(item);
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
