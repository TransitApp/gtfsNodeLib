'use strict';

/* eslint-disable no-underscore-dangle */

const infoLog = require('debug')('gtfsNodeLib:i');
const fs = require('fs-extra');
const Papa = require('papaparse');
const { StringDecoder } = require('string_decoder');

const eachWithLog = require('./logging_iterator_wrapper');

/**
 * Import a table in the GTFS.
 *
 * @param {Gtfs}   gtfs      The GTFS in which to import the table.
 * @param {string} tableName The table of the name to import.
 */
function importTable(gtfs, tableName) {
  const indexKeys = gtfs._schema.indexKeysByTableName[tableName];
  const fullPath = `${gtfs.getPath() + tableName}.txt`;

  if (fs.existsSync(fullPath)) {
    const fileContent = fs.readFileSync(fullPath);
    const { keys, rowsSlices } = getKeysAndRowsSlices(
      fileContent,
      gtfs._regexPatternObjectsByTableName.get(tableName),
      tableName
    );
    gtfs._tables.set(tableName, processGtfsTable(gtfs, keys, rowsSlices, tableName, indexKeys));
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
}

/**
 * Private functions
 */

function getKeysAndRowsSlices(buffer, regexPatternObjects, tableName) {
  let keys;
  const rowsSlices = [];
  let rowsSlice;
  let position = 0;
  const batchLength = 5000000; // 5mb
  let merge;
  /*
   Use string decoder to properly decode utf8 characters. Characters not in the basic ASCII take more
   than one byte.
   If the end of the batch cuts one of those characters, then we will yield weird characters.
   decoder will accumulate any "lost" utf8 character at the end of the batch and accumulate it for the next
   iteration.
    */
  const decoder = new StringDecoder('utf8');
  const rowsSliceRegex = /(.*[\r\n]+)((.*[\r\n]*)*)/;

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

    const rowsSliceIndex = position / batchLength;

    if (!keys) {
      const [, firstRowSlice, remainingRowsSlice] = rowsSlice.match(rowsSliceRegex);
      keys = firstRowSlice;
      rowsSlice = remainingRowsSlice;
    }

    if (merge) {
      const [, firstRowSlice, remainingRowsSlice] = rowsSlice.match(rowsSliceRegex);
      rowsSlices[rowsSliceIndex - 1] += firstRowSlice;
      rowsSlice = remainingRowsSlice;
    }

    rowsSlices[rowsSliceIndex] = rowsSlice;

    merge = rowsSlices[rowsSlice.length] !== '\n';
    position += batchLength;
  }

  return {
    keys,
    rowsSlices,
  };
}

function processGtfsTable(gtfs, keys, rowsSlices, tableName, indexKeys) {
  let table = (indexKeys.setOfItems) ? new Set() : new Map();

  if (rowsSlices === undefined || rowsSlices === null || rowsSlices.length === 0) {
    return table;
  }

  const parsedKeys = Papa.parse(keys, { delimiter: ',', skipEmptyLines: true });
  const trimmedKeys = parsedKeys.data[0].map(key => key.trim());
  checkThatKeysIncludeIndexKeys(trimmedKeys, indexKeys, tableName);

  const GtfsRow = createGtfsClassForKeys(trimmedKeys);
  let errorMessage;

  eachWithLog(`Importation:${tableName}`, rowsSlices, (rowsSlice) => {
    if (!rowsSlice || !rowsSlice.trim) {
      return;
    }

    rowsSlice = rowsSlice.trim();

    const parsedRow = Papa.parse(`${keys}${rowsSlice}`, { delimiter: ',', skipEmptyLines: true });

    if (parsedRow.errors.length) {
      if (!errorMessage) {
        errorMessage = `Invalid rows in table ${tableName}:\n`;
      }

      parsedRow.errors.forEach((error) => {
        errorMessage += `Line: ${error.row}
Issue: ${error.message}
Row: ${parsedRow.data[error.row].join(',')}`;
      });
    }

    const [, ...rows] = parsedRow.data; // we don't need the header row, it's already stored in parsedKeys/trimmedKeys

    rows.forEach((row) => {
      const trimmedRow = row.map(value => value.trim());
      if (trimmedRow !== null) {
        const item = new GtfsRow(trimmedRow);

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
    });
  });

  if (errorMessage && gtfs._shouldThrow) {
    throw new Error(errorMessage);
  }

  return table;
}

function checkThatKeysIncludeIndexKeys(sortedKeys, indexKeys, tableName) {
  const deepness = (indexKeys.indexKey) ? 1 : 0;

  if (deepness === 1 && sortedKeys.includes(indexKeys.indexKey) === false && indexKeys.indexKey !== 'agency_id') {
    /* Field agency_id is optional in table agency.txt according to the specification. */
    throw new Error(
      `Keys of table ${tableName} do not contain the index key: ${indexKeys.indexKey}.\n`
      + ` The values are: ${sortedKeys}`
    );
  }

  if (
    deepness === 2
    && (sortedKeys.includes(indexKeys.firstIndexKey) === false || sortedKeys.includes(indexKeys.secondIndexKey) === false)
  ) {
    throw new Error(
      `Keys of table ${tableName} do not contain the index keys: `
      + `${indexKeys.firstIndexKey} and ${indexKeys.secondIndexKey}.\n`
      + ` The values are: ${sortedKeys}`
    );
  }
}

function createGtfsClassForKeys(sortedKeys) {
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
  GtfsRow.prototype.clone = function () {
    const newRow = new GtfsRow(JSON.parse(JSON.stringify(this.v)));

    for (const key of Object.keys(this)) {
      newRow[key] = JSON.parse(JSON.stringify(this[key]));
    }

    return newRow;
  };

  // eslint-disable-next-line func-names
  GtfsRow.prototype.toSimpleObject = function () {
    const jsonObj = {};

    // eslint-disable-next-line
    for (const key in Object.getPrototypeOf(this)) {
      // noinspection JSUnfilteredForInLoop
      const value = this[key];
      if (typeof value !== 'function') {
        jsonObj[key] = this[key];
      }
    }

    for (const key of Object.keys(this)) {
      jsonObj[key] = this[key];
    }

    return jsonObj;
  };

  // eslint-disable-next-line func-names
  GtfsRow.prototype.toJSON = function () {
    return JSON.stringify(this.toSimpleObject());
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

  return GtfsRow;
}

function createGtfsObjectFromSimpleObject(obj) {
  const GtfsRow = createGtfsClassForKeys(Object.keys(obj));
  return new GtfsRow(Object.values(obj));
}

module.exports = {
  createGtfsObjectFromSimpleObject,
  importTable,
};
