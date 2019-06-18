'use strict';

/* eslint-disable no-underscore-dangle */

const infoLog = require('debug')('gtfsNodeLib:i');
const deasync = require('deasync');
const fs = require('fs-extra');
const Papa = require('papaparse');

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
    gtfs._tables.set(tableName, processGtfsTable(gtfs, fullPath, tableName, indexKeys));
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

function processGtfsTable(gtfs, fullPath, tableName, indexKeys) {
  let parsedFileContent;
  let finishedParsingFileContent = false;

  const promisifedPapaParse = () => {
    new Promise((resolve, reject) => {
      Papa.parse(fs.createReadStream(fullPath, { encoding: 'utf8' }), {
        complete: (results) => {
          parsedFileContent = results;
          finishedParsingFileContent = true;
          resolve();
        },
        delimiter: ',',
        error: reject,
        skipEmptyLines: true,
      });
    });
  };

  promisifedPapaParse();
  deasync.loopWhile(() => !finishedParsingFileContent);

  if (parsedFileContent.errors.length) {
    let errorMessage = `Invalid rows in table ${tableName}:\n`;

    parsedFileContent.errors.forEach((error) => {
      errorMessage += `Line: ${error.row}
Issue: ${error.message}
Row: ${parsedFileContent.data[error.row].join(',')}\n`;
    });

    if (gtfs._shouldThrow === true) {
      throw new Error(errorMessage);
    }
  }

  const [keys, ...rows] = parsedFileContent.data;

  const trimmedKeys = keys.map(key => key.trim());
  checkThatKeysIncludeIndexKeys(trimmedKeys, indexKeys, tableName);

  const GtfsRow = createGtfsClassForKeys(trimmedKeys);

  return processGtfsTableRows(gtfs, tableName, trimmedKeys, rows, indexKeys, GtfsRow);
}

function processGtfsTableRows(gtfs, tableName, keys, rows, indexKeys, GtfsRow) {
  let table = (indexKeys.setOfItems) ? new Set() : new Map();

  const regexPatternObjects = gtfs._regexPatternObjectsByTableName.get(tableName);

  rows.forEach((row) => {
    if (regexPatternObjects) {
      row = applyRegexPatternObjectsByTableName(regexPatternObjects, keys, row, tableName);
    }

    const trimmedRow = row.map(value => value.trim());
    const gtfsRow = new GtfsRow(trimmedRow);

    if (indexKeys.indexKey) {
      table.set(gtfsRow[indexKeys.indexKey], gtfsRow);
    } else if (indexKeys.firstIndexKey && indexKeys.secondIndexKey) {
      if (table.has(gtfsRow[indexKeys.firstIndexKey]) === false) {
        table.set(gtfsRow[indexKeys.firstIndexKey], new Map());
      }

      table.get(gtfsRow[indexKeys.firstIndexKey]).set(gtfsRow[indexKeys.secondIndexKey], gtfsRow);
    } else if (indexKeys.singleton) {
      table = gtfsRow;
    } else if (indexKeys.setOfItems) {
      table.add(gtfsRow);
    }
  });

  return table;
}

function applyRegexPatternObjectsByTableName(regexPatternObjects, keys, row, tableName) {
  const rowStringified = String(row);
  let modifiedRowStringified = rowStringified;

  regexPatternObjects.forEach(({ regex, pattern }) => {
    modifiedRowStringified = rowStringified.replace(regex, pattern || '');

    if (modifiedRowStringified !== rowStringified) {
      process.notices.addInfo(
        'Applying Changes on Raw GTFS',
        `Applying regex replace to table: "${tableName}". regex: "${regex}".`
      );
    }
  });

  const parsedModifiedRow = Papa.parse(`${keys}\n${modifiedRowStringified}`, {
    delimiter: ',',
  });

  return parsedModifiedRow.data[1];
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
