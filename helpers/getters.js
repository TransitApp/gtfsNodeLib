'use strict';

const schema = require('./schema');

function getGrandParentItem(itemWithForeignIndexId, parentTableName, grandParentTableName, gtfs) {
  if (
    itemWithForeignIndexId === undefined ||
    itemWithForeignIndexId === null ||
    typeof itemWithForeignIndexId !== 'object'
  ) {
    throw new Error(`itemWithForeignIndexId must be a plain object, instead of an "${typeof itemWithForeignIndexId}"`);
  }
  if (schema.tableNames.includes(parentTableName) === false) {
    throw new Error(`Cannot find table with name "${parentTableName}"`);
  }
  if (schema.tableNames.includes(grandParentTableName) === false) {
    throw new Error(`Cannot find table with name "${grandParentTableName}"`);
  }

  /* Reach parent item */
  const parentIndexKey = schema.indexKeysByTableName[parentTableName].indexKey;

  if (itemWithForeignIndexId[parentIndexKey] === undefined) {
    throw new Error(`itemWithForeignIndexId should contain the foreign index key "${parentIndexKey}"`);
  }

  const parentItem = gtfs.getItemWithIndexInTable(itemWithForeignIndexId[parentIndexKey], parentTableName);

  if (!parentItem) {
    return null;
  }

  /* Reach grandparent item */
  const grandParentIndexKey = schema.indexKeysByTableName[grandParentTableName].indexKey;

  if (!parentItem[grandParentIndexKey]) {
    throw new Error(`parentItem should contain the foreign index key "${grandParentIndexKey}"${parentItem}`);
  }

  return gtfs.getItemWithIndexInTable(parentItem[grandParentIndexKey], grandParentTableName);
}

function getIndexedItemsWithParent(parentItem, tableName, gtfs) {
  if (schema.deepnessByTableName[tableName] !== 2) {
    throw new Error(`Table "${tableName}" is not of deepness 2.`);
  }
  if (parentItem === undefined || parentItem === null || typeof parentItem !== 'object') {
    throw new Error(`Parent item should be a plain object, instead of an "${typeof parentItem}"`);
  }

  const firstIndexKey = schema.indexKeysByTableName[tableName].firstIndexKey;

  if (parentItem[firstIndexKey] === undefined) {
    throw new Error(`Parent item should contain the foreign index key "${firstIndexKey}"`);
  }

  const indexedTable = gtfs.getIndexedTable(tableName);

  return indexedTable.get(parentItem[firstIndexKey]);
}

function getIndexedItemsWithParentIndex(parentIndex, tableName, gtfs) {
  if (schema.deepnessByTableName[tableName] !== 2) {
    throw new Error(`Table "${tableName}" is not of deepness 2.`);
  }
  if (typeof parentIndex !== 'string') {
    throw new Error(`Parent item index should be a string, instead of an "${typeof parentIndex}"`);
  }

  const indexedTable = gtfs.getIndexedTable(tableName);

  return indexedTable.get(parentIndex);
}

/**
 * Get the item of a table using its index.
 *
 * WARNING: Will work only for the tables in which such unique indexing value exists (see schema.js for an
 * exhaustive list)
 *
 * @param {string} index     Index of the item
 * @param {string} tableName Name of the table
 * @param {Gtfs}   gtfs      Gtfs object
 */
function getItemWithIndex(index, tableName, gtfs) {
  if (schema.deepnessByTableName[tableName] !== 1) {
    throw new Error(`Cannot access item with only one index in "${tableName}", since the deepness is not 1.`);
  }
  if (typeof index !== 'string') {
    throw new Error(`Index should be a string, instead of an "${typeof index}": ${JSON.stringify(index)}`);
  }

  const indexedTable = gtfs.getIndexedTable(tableName);

  return indexedTable.get(index);
}

/**
 * Get the item of a table using its indexes.
 *
 * WARNING: Will work only for the tables which have a double level of indexing, which is required when there is no
 * value uniquely identifying each item (see schema.js for an exhaustive list)
 *
 * @param {string} firstIndex  First index of the item
 * @param {string} secondIndex Second index of the item
 * @param {string} tableName   Name of the table
 * @param {Gtfs}   gtfs        Gtfs object
 */
function getItemWithIndexes(firstIndex, secondIndex, tableName, gtfs) {
  if (schema.deepnessByTableName[tableName] !== 2) {
    throw new Error(`Cannot access item with two indexes in "${tableName}", since the deep is not 2.`);
  }
  if (firstIndex === undefined || firstIndex === null || typeof firstIndex !== 'string') {
    throw new Error(`First index should be a string, instead of an "${typeof firstIndex}"`);
  }
  if (secondIndex === undefined || secondIndex === null || typeof secondIndex !== 'string') {
    throw new Error(`Second index should be a string, instead of an "${typeof secondIndex}"`);
  }

  const indexedTable = gtfs.getIndexedTable(tableName);

  return (indexedTable.has(firstIndex)) ? indexedTable.get(firstIndex).get(secondIndex) : null;
}

function getParentItem(itemWithForeignIndexId, tableName, gtfs) {
  if (
    itemWithForeignIndexId === undefined ||
    itemWithForeignIndexId === null ||
    typeof itemWithForeignIndexId !== 'object'
  ) {
    throw new Error(`itemWithForeignIndexId must be a plain object, instead of an "${typeof itemWithForeignIndexId}"`);
  }

  const indexKey = schema.indexKeysByTableName[tableName].indexKey;

  if (itemWithForeignIndexId[indexKey] === undefined) {
    throw new Error(
      `itemWithForeignIndexId should contain the foreign index key "${indexKey}", ` +
      `but is: ${JSON.stringify(itemWithForeignIndexId)}`
    );
  }

  return gtfs.getItemWithIndexInTable(itemWithForeignIndexId[indexKey], tableName);
}

module.exports = {
  getGrandParentItem,
  getIndexedItemsWithParent,
  getIndexedItemsWithParentIndex,
  getItemWithIndex,
  getItemWithIndexes,
  getParentItem,
};
