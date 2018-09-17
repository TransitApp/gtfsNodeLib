'use strict';

/* eslint-disable no-underscore-dangle */

/**
 * Build the list of the keys used in a table of the GTFS. Since the GTFS specification allows any additional field,
 * this function allows to explore those additional values.
 *
 * @param {Gtfs}   gtfs      GTFS containing the table.
 * @param {string} tableName Table of the GTFS of which we want to key.
 * @return {Array.<string>}  Keys used by the items of the table.
 */
function getActualKeysForTable(gtfs, tableName) {
  const getSample = iterable => ((iterable && iterable.values().next()) ? iterable.values().next().value : undefined);
  const keys = [...gtfs._schema.keysByTableName[tableName]];
  const deepness = gtfs._schema.deepnessByTableName[tableName];
  const table = gtfs.getIndexedTable(tableName);
  let sampleItem;

  if (deepness === 0) {
    sampleItem = table;
  } else if (deepness === 1) {
    sampleItem = getSample(table);
  } else if (deepness === 2) {
    sampleItem = getSample(getSample(table));
  }

  if (sampleItem && !(sampleItem instanceof Set)) {
    Object.keys(sampleItem.toSimpleObject()).forEach((key) => {
      if (gtfs._schema.keysByTableName[tableName].includes(key) === false) {
        keys.push(key);
      }
    });
  }

  if (keys.length === 0) {
    throw new Error(`No keys found for table ${tableName}`);
  }

  return keys;
}

/**
 * Get the grand parent item using one of its child.
 *
 * @param {Object} itemWithForeignIndexId The child item.
 * @param {string} parentTableName        The name of the table containing the parent item.
 * @param {string} grandParentTableName   The name of the table containing the grand parent item.
 * @param {Gtfs} gtfs                     The GTFS containing the parent item
 * @return {Object}                       The grand parent item.
 */
function getGrandParentItem(itemWithForeignIndexId, parentTableName, grandParentTableName, gtfs) {
  if (
    itemWithForeignIndexId === undefined ||
    itemWithForeignIndexId === null ||
    typeof itemWithForeignIndexId !== 'object'
  ) {
    throw new Error(`itemWithForeignIndexId must be a plain object, instead of an "${typeof itemWithForeignIndexId}"`);
  }
  if (gtfs._schema.tableNames.includes(parentTableName) === false) {
    throw new Error(`Cannot find table with name "${parentTableName}"`);
  }
  if (gtfs._schema.tableNames.includes(grandParentTableName) === false) {
    throw new Error(`Cannot find table with name "${grandParentTableName}"`);
  }

  /* Reach parent item */
  const parentIndexKey = gtfs._schema.indexKeysByTableName[parentTableName].indexKey;

  if (itemWithForeignIndexId[parentIndexKey] === undefined) {
    throw new Error(`itemWithForeignIndexId should contain the foreign index key "${parentIndexKey}"`);
  }

  const parentItem = gtfs.getItemWithIndexInTable(itemWithForeignIndexId[parentIndexKey], parentTableName);

  if (!parentItem) {
    return null;
  }

  /* Reach grandparent item */
  const grandParentIndexKey = gtfs._schema.indexKeysByTableName[grandParentTableName].indexKey;

  if (!parentItem[grandParentIndexKey]) {
    throw new Error(`parentItem should contain the foreign index key "${grandParentIndexKey}"${parentItem}`);
  }

  return gtfs.getItemWithIndexInTable(parentItem[grandParentIndexKey], grandParentTableName);
}

/**
 * Get the child items of an item.
 *
 * @param {Object} parentItem     The parent item.
 * @param {string} tableName      The name of the table containing the child items.
 * @param {Gtfs} gtfs             The GTFS containing the child items.
 * @return {Map.<string, Object>} Indexed child items.
 */
function getIndexedItemsWithParent(parentItem, tableName, gtfs) {
  if (gtfs._schema.deepnessByTableName[tableName] !== 2) {
    throw new Error(`Table "${tableName}" is not of deepness 2.`);
  }
  if (parentItem === undefined || parentItem === null || typeof parentItem !== 'object') {
    throw new Error(`Parent item should be a plain object, instead of an "${typeof parentItem}"`);
  }

  const firstIndexKey = gtfs._schema.indexKeysByTableName[tableName].firstIndexKey;

  if (parentItem[firstIndexKey] === undefined) {
    throw new Error(`Parent item should contain the foreign index key "${firstIndexKey}"`);
  }

  const indexedTable = gtfs.getIndexedTable(tableName);

  return indexedTable.get(parentItem[firstIndexKey]);
}

/**
 * Get the child items of an item using its index.
 *
 * @param {Object} parentIndex    The parent item's index.
 * @param {string} tableName      The name of the table containing the child items.
 * @param {Gtfs} gtfs             The GTFS containing the child items.
 * @return {Map.<string, Object>} Indexed child items.
 */
function getIndexedItemsWithParentIndex(parentIndex, tableName, gtfs) {
  if (gtfs._schema.deepnessByTableName[tableName] !== 2) {
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
  if (gtfs._schema.deepnessByTableName[tableName] !== 1) {
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
  if (gtfs._schema.deepnessByTableName[tableName] !== 2) {
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

/**
 * Get the parent item using one of its child.
 *
 * @param {Object} itemWithForeignIndexId The child item.
 * @param {string} tableName              The name of the table containing the parent item.
 * @param {Gtfs} gtfs                     The GTFS containing the parent item
 * @return {Object}                       The parent item.
 */
function getParentItem(itemWithForeignIndexId, tableName, gtfs) {
  if (
    itemWithForeignIndexId === undefined ||
    itemWithForeignIndexId === null ||
    typeof itemWithForeignIndexId !== 'object'
  ) {
    throw new Error(`itemWithForeignIndexId must be a plain object, instead of an "${typeof itemWithForeignIndexId}"`);
  }

  const indexKey = gtfs._schema.indexKeysByTableName[tableName].indexKey;

  if (itemWithForeignIndexId[indexKey] === undefined) {
    throw new Error(
      `itemWithForeignIndexId should contain the foreign index key "${indexKey}", ` +
      `but is: ${JSON.stringify(itemWithForeignIndexId)}`
    );
  }

  return gtfs.getItemWithIndexInTable(itemWithForeignIndexId[indexKey], tableName);
}

module.exports = {
  getActualKeysForTable,
  getGrandParentItem,
  getIndexedItemsWithParent,
  getIndexedItemsWithParentIndex,
  getItemWithIndex,
  getItemWithIndexes,
  getParentItem,
};
