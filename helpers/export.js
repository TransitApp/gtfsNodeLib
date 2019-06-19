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

  const readStream = fs.createReadStream(fullPathToInputFile);
  const writeStream = fs.createWriteStream(fullPathToOutputFile);

  readStream.on('error', (readError) => {
    if (readError && readError.code === 'ENOENT') {
      warningLog(`[${getHHmmss()}] Table doesn't exist and won't be added: ${tableName}`);
      callback();
      return;
    }

    if (readError) {
      errorLog(readError);
      callback();
    }
  })
    .pipe(writeStream, (writeError) => {
      if (writeError) {
        errorLog(writeError);
        callback();
        return;
      }

      infoLog(`[${getHHmmss()}] Table has been copied: ${tableName}`);
    })
    .on('close', () => {
      callback();
    });
}

function exportTable(tableName, gtfs, outputPath, callback) {
  const csv = processGtfsTable(tableName, gtfs);

  const outputFullPath = `${outputPath + tableName}.txt`;
  const writeStream = fs.createWriteStream(outputFullPath);

  try {
    writeStream.write(csv, () => {
      infoLog(`[${getHHmmss()}] Table has been exported: ${tableName}`);
      callback();
    });
  } catch (error) {
    console.log(error);
    callback();
  }
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

function processGtfsTable(tableName, gtfs) {
  let itemMap = gtfs.getIndexedTable(tableName);
  if (!itemMap) {
    return undefined;
  }

  const actualKeys = gtfs.getActualKeysForTable(tableName);
  const indexKeys = gtfs._schema.indexKeysByTableName[tableName];
  const deepness = gtfs._schema.deepnessByTableName[tableName];
  const itemValues = [];

  if (indexKeys.singleton) {
    if (gtfs._preExportItemFunction) {
      itemMap = gtfs._preExportItemFunction(itemMap, tableName);
    }

    const formattedGtfsRowValues = getObjectValuesUsingKeyOrdering(itemMap, actualKeys);
    itemValues.push(formattedGtfsRowValues);

    return Papa.unparse({
      fields: actualKeys,
      data: itemValues,
    });
  }

  itemMap.forEach((gtfsRowObjectOrMap, key) => {
    if (deepness === 0 || deepness === 1) {
      if (gtfs._preExportItemFunction) {
        gtfsRowObjectOrMap = gtfs._preExportItemFunction(gtfsRowObjectOrMap, tableName, key);
      }

      const formattedGtfsRowValues = getObjectValuesUsingKeyOrdering(gtfsRowObjectOrMap, actualKeys);
      itemValues.push(formattedGtfsRowValues);
    }

    if (deepness === 2) {
      gtfsRowObjectOrMap.forEach((gtfsRowObject, subKey) => {
        if (gtfs._preExportItemFunction) {
          gtfsRowObject = gtfs._preExportItemFunction(gtfsRowObject, tableName, key, subKey);
        }

        const formattedGtfsRowValues = getObjectValuesUsingKeyOrdering(gtfsRowObject, actualKeys);
        itemValues.push(formattedGtfsRowValues);
      });
    }
  });

  return Papa.unparse({
    fields: actualKeys,
    data: itemValues,
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
