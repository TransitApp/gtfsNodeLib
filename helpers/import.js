'use strict';

/* eslint-disable no-underscore-dangle */

const infoLog = require('debug')('gtfsNodeLib:i');
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
    const fileContent = fs.readFileSync(fullPath, 'utf8');
    gtfs._tables.set(tableName, processGtfsTable(gtfs, fileContent, tableName, indexKeys));
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

function processGtfsTable(gtfs, fileContent, tableName, indexKeys) {
  let table = (indexKeys.setOfItems) ? new Set() : new Map();

  Papa.parse(fileContent, {
    delimiter: ',',
    header: true,
    skipEmptyLines: true,
    step: (row) => { // streams the CSV by row
      const item = processGtfsTableRow(gtfs, tableName, row, indexKeys);
      if (!item) {
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
    },
  });

  return table;
}

function processGtfsTableRow(gtfs, tableName, row, indexKeys) {
  let processedRow = JSON.parse(JSON.stringify(row));
  const rowAsCsv = Papa.unparse(processedRow);

  const errorsInRow = processedRow.errors;
  if (errorsInRow.length) {
    let errorMessage = `Invalid row in table ${tableName}:
  
Line: ${errorsInRow[0].row}
${rowAsCsv}\n\n`;
    errorsInRow.forEach((error) => {
      errorMessage += `Issue: ${error.message}`;
    });

    const errorTypes = new Set(errorsInRow.map(error => error.type));
    if (gtfs._shouldThrow === true && !errorTypes.has('FieldMismatch')) {
      throw new Error(errorMessage);
    }

    errorMessage += '\nError in CSV was fixed by parser.';
    process.notices.addWarning('Invalid CSV', errorMessage);
    processedRow = Papa.parse(rowAsCsv, { // fix FieldMismatch errors (TooFewFields / TooManyFields)
      delimiter: ',',
      header: true,
    });
  }

  const regexPatternObjects = gtfs._regexPatternObjectsByTableName.get(tableName);
  if (regexPatternObjects) {
    processedRow = applyRegexPatternObjectsByTableName(regexPatternObjects, rowAsCsv, processedRow, tableName);
  }

  const rowObject = {};
  for (const [field, value] of Object.entries(processedRow.data[0])) {
    rowObject[field.trim()] = value.trim();
  }

  checkThatKeysIncludeIndexKeys(Object.keys(rowObject), indexKeys, tableName);

  return createGtfsObjectFromSimpleObject(rowObject);
}

function applyRegexPatternObjectsByTableName(regexPatternObjects, rowAsCsv, row, tableName) {
  let modifiedRowAsCsv;
  let modifiedRow = JSON.parse(JSON.stringify(row));

  regexPatternObjects.forEach(({ regex, pattern }) => {
    modifiedRowAsCsv = rowAsCsv.replace(regex, pattern || '');

    if (modifiedRowAsCsv !== rowAsCsv) {
      process.notices.addInfo(
        'Applying Changes on Raw GTFS',
        `Applying regex replace to table: "${tableName}". regex: "${regex}".`
      );
      modifiedRow = Papa.parse(modifiedRowAsCsv, {
        delimiter: ',',
        header: true,
      });
    }
  });

  return modifiedRow;
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
