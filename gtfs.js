'use strict';

/* eslint-disable no-underscore-dangle */

const infoLog = require('debug')('gtfsNodeLib:i');
const fs = require('fs-extra');

const forEachWithLog = require('./helpers/logging_iterator_wrapper');
const { exportGtfs } = require('./helpers/export');
const getters = require('./helpers/getters');
const { importTable, createGtfsObjectFromSimpleObject } = require('./helpers/import');
const defaultSchema = require('./helpers/schema');

/**
 * Table-generic function to add items in a table of a GTFS.
 *
 * @param {Gtfs}           gtfs      GTFS object in which to add the items.
 * @param {string}         tableName Name of the table of the GTFS in which the objects should be added.
 * @param {Array.<Object>} items     Array of items to add to the GTFS.
 */
function addItems(gtfs, tableName, items) {
  if (items instanceof Array === false) {
    throw new Error(`items must be an array instead of: ${items}`);
  }

  items = items.map((item) => {
    // GtfsRow object should have a clone method
    if (item.clone === undefined) {
      return gtfs.createGtfsObjectFromSimpleObject(item);
    }
    return item;
  });

  const indexedTable = gtfs.getIndexedTable(tableName);
  const indexKeys = gtfs._schema.indexKeysByTableName[tableName];

  if (indexKeys.setOfItems) {
    items.forEach(item => indexedTable.add(item));
    return;
  }

  if (indexKeys.indexKey) {
    items.forEach(item => indexedTable.set(item[indexKeys.indexKey], item));
    return;
  }

  if (indexKeys.firstIndexKey && indexKeys.secondIndexKey) {
    items.forEach((item) => {
      if (indexedTable.has(item[indexKeys.firstIndexKey]) === false) {
        indexedTable.set(item[indexKeys.firstIndexKey], new Map());
      }

      indexedTable.get(item[indexKeys.firstIndexKey]).set(item[indexKeys.secondIndexKey], item);
    });
  }
}
/**
 * Table-generic function to get an indexed table of a GTFS. The indexation depends of the table, and is defined in
 * the schema (see schema.js).
 *
 * @param  {Gtfs}   gtfs      GTFS object containing the table to get.
 * @param  {string} tableName Name of the table of the GTFS to get.
 * @return {
 *   Object|
 *   Map.<string, Object>|
 *   Map.<string, Map.<string, Object>>
 * }                          Indexed table returned
 */
function getIndexedTable(gtfs, tableName) {
  if (gtfs._tables.has(tableName) === false) {
    importTable(gtfs, tableName);
    infoLog(`[Importation] Table ${tableName} has been imported.`);
  }

  return gtfs._tables.get(tableName);
}

/**
 * Check if an object is already in a table. Can only be used for not indexed table.
 *
 * @param {Gtfs} gtfs - GTFS object containing the table to check
 * @param {Object} item - Item which will be searched in the table
 * @param {string} tableName - Name of the table of the GTFS in which to search the object.
 * @returns {Boolean} Whether or not the item is in the table.
 */

function hasItemInTable(gtfs, item, tableName) {
  const items = gtfs.getIndexedTable(tableName);
  const indexKeys = gtfs._schema.indexKeysByTableName[tableName];

  if (indexKeys.setOfItems) {
    return items.has(item);
  }

  throw new Error('hasItemInTable can only be used on table stored as Set. Use the key in other cases.');
}

/**
 * Table-generic function to get an iterate in a table of a GTFS.
 *
 * @param  {Gtfs}     gtfs      GTFS object containing the table to iterate on.
 * @param  {string}   tableName Name of the table of the GTFS to enumerate.
 * @param  {function} iterator  Function which will be applied on every item of the table.
 */
function forEachItem(gtfs, tableName, iterator) {
  if (typeof iterator !== 'function') {
    throw new Error(`iterator must be a function, instead of a ${typeof iterator}.`);
  }

  const indexedTable = gtfs.getIndexedTable(tableName);
  const indexKeys = gtfs._schema.indexKeysByTableName[tableName];
  const deepness = gtfs._schema.deepnessByTableName[tableName];

  if (indexKeys.singleton) {
    iterator(indexedTable);
    return;
  }

  if (deepness === 0 || deepness === 1) {
    forEachWithLog(`Iterating:${tableName}`, indexedTable, (item) => {
      iterator(item);
    });
    return;
  }

  if (deepness === 2) {
    forEachWithLog(`Iterating:${tableName}`, indexedTable, (indexedSubTable) => {
      indexedSubTable.forEach(iterator);
    });
  }
}

/**
 * Table-generic function to remove items in a table of a GTFS.
 *
 * @param  {Gtfs}           gtfs      GTFS object containing the table in which the object should be removed.
 * @param  {string}         tableName Name of the table of the GTFS in which to add the items.
 * @param  {Array.<Object>} items     Array of items to remove of the GTFS.
 */
function removeItems(gtfs, tableName, items) {
  if (items instanceof Array === false) {
    throw new Error(`items must be an array instead of: ${items}`);
  }

  const indexedTable = gtfs.getIndexedTable(tableName);
  const indexKeys = gtfs._schema.indexKeysByTableName[tableName];

  if (indexKeys.setOfItems) {
    items.forEach(item => indexedTable.delete(item));
    return;
  }

  if (indexKeys.indexKey) {
    items.forEach(item => indexedTable.delete(item[indexKeys.indexKey]));
    return;
  }

  if (indexKeys.firstIndexKey && indexKeys.secondIndexKey) {
    items.forEach((item) => {
      if (indexedTable.has(item[indexKeys.firstIndexKey]) === true) {
        indexedTable.get(item[indexKeys.firstIndexKey]).delete(item[indexKeys.secondIndexKey]);
      }

      if (indexedTable.get(item[indexKeys.firstIndexKey]).size === 0) {
        indexedTable.delete(item[indexKeys.firstIndexKey]);
      }
    });
  }
}

/**
 * Table-generic function to set an indexed table in the GTFS.
 *
 * @param  {Gtfs}   gtfs         GTFS object in which the table will be set.
 * @param  {string} tableName    Name of the table of the GTFS to set.
 * @param  {Object|Map|Set} table Object properly indexed as the schema requires the table to be (see schema.js).
 */
function setTable(gtfs, tableName, table) {
  const indexKeys = gtfs._schema.indexKeysByTableName[tableName];

  if (indexKeys.setOfItems && table instanceof Set === true) {
    gtfs._tables.set(tableName, table);
  } else if (indexKeys.singleton && table instanceof Set === false && table instanceof Map === false) {
    gtfs._tables.set(tableName, table);
  } else if (indexKeys.setOfItems !== true && indexKeys.singleton !== true && table instanceof Map === true) {
    gtfs._tables.set(tableName, table);
  } else {
    throw new Error(`setTable cannot be used with the table: ${table}`);
  }
}

/**
 * Return the size of the Map if define, otherwise 0
 *
 * @param {Map} map
 * @returns {number}
 */
function getSizeOfMap(map) {
  return (map instanceof Map) ? map.size : 0;
}

/**
 * Return the size of the Set if define, otherwise 0
 *
 * @param {Set} set
 * @returns {number}
 */
function getSizeOfSet(set) {
  return (set instanceof Set) ? set.size : 0;
}

/**
 * Table-generic function to reset a table of a GTFS (ie, create a new Map)
 *
 * @param {Gtfs}           gtfs      GTFS object containing the table to be reset.
 * @param {string}         tableName Name of the table to be reset.
 */
function resetTable(gtfs, tableName) {
  const indexKeys = gtfs._schema.indexKeysByTableName[tableName];

  if (indexKeys.setOfItems) {
    gtfs._tables.set(tableName, new Set());
  } else {
    gtfs._tables.set(tableName, new Map());
  }
}

/**
 * Table-generic function to get the number of items in the provided GTFS table
 *
 * @param {Gtfs}           gtfs      GTFS object containing the table.
 * @param {string}         tableName Name of the table to be get the number of item from.
 */
function getNumberOfItemsInTable(gtfs, tableName) {
  const indexKeys = gtfs._schema.indexKeysByTableName[tableName];
  const deepness = gtfs._schema.deepnessByTableName[tableName];

  if (deepness === 1) {
    const indexedTable = gtfs.getIndexedTable(tableName);
    return getSizeOfMap(indexedTable);
  }
  if (deepness === 0 && indexKeys.setOfItems) {
    const items = gtfs.getIndexedTable(tableName);
    return getSizeOfSet(items);
  }

  throw new Error(
    `'${tableName}' has a deepness of ${deepness}.` +
    'getNumberOfItemsInTable can only apply on a first level table or a Set.'
  );
}

class Gtfs {
  /**
   * Constructor of the GTFS
   *
   * # options.regexPatternObjectsByTableName
   *
   * Optional ad-hoc list of regex to fix the tables. The keys are the tableName like defined in schema.js, the value
   * are arrays containing pairs of regex and pattern to be applied on the raw table, before parsing. The goal is to fix
   * some bad CSV to make them readable.
   *
   * Example
   *
   * The following raw is invalid according to the CSV specification:
   *
   * > something,something else,a field "not" properly escaped,one last thing
   *
   * Assuming it is in someTable.txt, it could be fixed with the following regexPatternObjectsByTableName:
   *
   * regexPatternObjectsByTableName = {
   *   nameOfTheTable: [{
   *     regex: /,a field "not" properly escaped,/g,
   *     pattern: ',a field ""not"" properly escaped,',
   *   }]
   * };
   *
   *
   * # options.throws
   *
   * Optional ad-hoc boolean. Default is true. Will force the parser to ignore invalid rows in the tables.
   *
   *
   * # options.postImportTableFunction
   *
   * Optional ad-hoc function which will be applied on every item of every table after importation.
   *
   *
   * # options.forcedSchema
   *
   * Will overwrite the default schema by the value passed.
   *
   *
   * @param {string} [path] Path to the folder that contains the GTFS text files.
   * @param {{
   *   regexPatternObjectsByTableName: Map.<string, Array.<{regex: RegExp, pattern: string}>>,
   *   throws: boolean,
   *   forcedSchema,
   *   postImportItemFunction: function,
   *   preExportItemFunction: function,
   * }} [options] Optional. See list above.
   * @return {Gtfs} gtfs Instanciated GTFS object.
   */
  constructor(
    path,
    {
      regexPatternObjectsByTableName = new Map(),
      throws = true,
      forcedSchema,
      postImportItemFunction,
      preExportItemFunction,
    } = {}
  ) {
    if (path !== undefined) {
      if (typeof path !== 'string' || path.length === 0) {
        throw new Error(`Gtfs need a valid input path as string, instead of: "${path}".`);
      }

      path = (path[path.length - 1] === '/') ? path : `${path}/`;

      if (fs.existsSync(path) === false) {
        throw new Error(`inputPath: "${path}" is not a valid folder.`);
      }
    }

    this.isGtfs = true;

    this._path = path;
    this._regexPatternObjectsByTableName = regexPatternObjectsByTableName;
    this._shouldThrow = throws;
    this._postImportItemFunction = postImportItemFunction;
    this._preExportItemFunction = preExportItemFunction;
    this._tables = new Map();
    this._schema = forcedSchema || defaultSchema;
  }

  /* Input/Output */
  /**
   * Async function exporting the GTFS at a specific path.
   *
   * @param  {string}   path     Path to the folder which will contain the GTFS. The folder will be created if needed.
   * @param  {function} callback Function called when the export will be done.
   */
  exportAtPath(path, callback) { return exportGtfs(this, path, callback); }

  /**
   * Getter returning the path of the GTFS when it was imported.
   *
   * @return {string} Path to the imported GTFS.
   */
  getPath() { return this._path; }


  /* Generic table & item manipulation */

  /**
   * Table-generic function to add an item in a table of the GTFS.
   *
   * @param {Object} item      Item to add in the GTFS.
   * @param {string} tableName Name of the table of the GTFS in which the item will be added.
   */
  addItemInTable(item, tableName) { addItems(this, tableName, [item]); }

  /**
   * Table-generic function to add items in a table of the GTFS.
   *
   * @param {Array.<Map>} items Array of items to add in the GTFS.
   * @param {string}            tableName Name of the table of the GTFS in which the item will be added.
   */
  addItemsInTable(items, tableName) { addItems(this, tableName, items); }

  /**
   * Table-generic function to get an iterate in a table of the GTFS.
   *
   * @param  {string}   tableName Name of the table of the GTFS to enumerate.
   * @param  {function} iterator  Function which will be applied on every item of the table.
   */
  forEachItemInTable(tableName, iterator) { forEachItem(this, tableName, iterator); }

  /**
   * Enumerate through every table name of the GTFS.
   *
   * @param {function} iterator Function which will be applied on every table name.
   */
  forEachTableName(iterator) { this.getTableNames().forEach(iterator); }

  /**
   * Table-generic function to get an indexed table of the GTFS. The indexation depends of the table, and is defined in
   * the schema (see schema.js).
   *
   * @param  {string} tableName Name of the table of the GTFS to get.
   * @return {Object}           Indexed table returned
   */
  getIndexedTable(tableName) { return getIndexedTable(this, tableName); }

  /**
   * Get an item of a table using its index.
   *
   * WARNING: Will work only for the tables in which such unique indexing value exists (see schema.js for an
   * exhaustive list)
   *
   * @param {string} index     Index of the item
   * @param {string} tableName Name of the table
   */
  getItemWithIndexInTable(index, tableName) { return getters.getItemWithIndex(index, tableName, this); }

  /**
   * Get a Set containing every table names, either defined as part of the GTFS specification, or already loaded in
   * the GTFS.
   *
   * @return {Set.<string>} Array of the table names
   */
  getTableNames() { return new Set([...this._schema.tableNames, ...this._tables.keys()]); }

  /**
   * Get the default schema of the GTFS. For safety, the schema is cloned before being passed.
   *
   * @return {Object} The schema
   */
  static getDefaultSchema() { return JSON.parse(JSON.stringify(defaultSchema)); }

  /**
   * Get the schema of the GTFS. For safety, the schema is cloned before being passed.
   *
   * @return {Object} The schema
   */
  getSchema() { return JSON.parse(JSON.stringify(this._schema)); }

  /**
   * Build the list of the keys used in a table of the GTFS. Since the GTFS specification allows any additional field,
   * this function allows to explore those additional values.
   *
   * @param {string} tableName Table of the GTFS of which we want to key.
   * @return {Array.<string>}  Keys used by the items of the table.
   */
  getActualKeysForTable(tableName) { return getters.getActualKeysForTable(this, tableName); }

  /**
   * Table-generic function returning the number of items in the provided GTFS table.
   *
   * @param  {string}         tableName Name of the table of the GTFS
   */
  getNumberOfItemsInTable(tableName) { return getNumberOfItemsInTable(this, tableName); }

  /**
   * Get the parent item using one of its child.
   *
   * @param {Object} item      The child item.
   * @param {string} tableName The name of the table containing the parent item.
   * @return {Object}          The parent item.
   */
  getParentItem(item, tableName) { return getters.getParentItem(item, tableName, this); }

  /**
   * Table-generic function to remove one item in a table of the GTFS.
   *
   * @param  {Object} item      Item to remove of the GTFS.
   * @param  {string} tableName Name of the table of the GTFS in which to remove the items.
   */
  removeItemInTable(item, tableName) { removeItems(this, tableName, [item]); }

  /**
   * Table-generic function to remove items in a table of the GTFS.
   *
   * @param  {Array.<Object>} items     Array of items to remove of the GTFS.
   * @param  {string}         tableName Name of the table of the GTFS in which to remove the items.
   */
  removeItemsInTable(items, tableName) { removeItems(this, tableName, items); }

  /**
   * Table-generic function to reset a GTFS table (ie, create a new Map)
   *
   * @param {Gtfs}           gtfs      GTFS object containing the table to be reset.
   * @param {string}         tableName Name of the table to be reset.
   */
  resetTable(tableName) { resetTable(this, tableName); }

  /**
   * Table-generic function to set an indexed table in the GTFS.
   *
   * @param  {Map}    indexedItems Object properly indexed as the schema requires the table to be (see schema.js).
   * @param  {string} tableName    Name of the table of the GTFS to set.
   */
  setIndexedItemsAsTable(indexedItems, tableName) { setTable(this, tableName, indexedItems); }

  /* agency.txt */

  /**
   * Adds an agency in the GTFS.
   *
   * @param {Object} agency Agency to add in the GTFS.
   */
  addAgency(agency) { addItems(this, 'agency', [agency]); }

  /**
   * Adds a list of agencies in the GTFS.
   *
   * @param {Array.<Object>} agencies Array of agencies to add in the GTFS.
   */
  addAgencies(agencies) { addItems(this, 'agency', agencies); }

  /**
   * Apply a function to each agency in the GTFS.
   *
   * @param {function} iterator Function which will be applied on every agency.
   */
  forEachAgency(iterator) { forEachItem(this, 'agency', iterator); }

  /**
   * Get the agency using one of its child route.
   *
   * WARNING: Will return the agency which is indexed with the route.agency_id of the route passed as argument. If the
   * internal value of the agency's agency_id has been changed but not it's indexing, the result will be wrong.
   *
   * @param {Object} route A route of the GTFS.
   * @return {Object} The agency indexed by the route.agency_id of the route passed as parameter.
   */
  getAgencyOfRoute(route) { return getters.getParentItem(route, 'agency', this); }

  /**
   * Get the agency using its agency_id.
   *
   * WARNING: Will return the agency which is indexed with the agency_id passed as argument. If the internal value of
   * the agency's agency_id has been changed but not it's indexing, the result will be wrong.
   *
   * @param {string} agencyId Index of the agency.
   * @return {Object} The agency indexed by the agency_id passed as parameter.
   */
  getAgencyWithId(agencyId) { return getters.getItemWithIndex(agencyId, 'agency', this); }

  /**
   * Get the indexed agencies of the GTFS. The indexation is defined in the schema (see schema.js).
   *
   * @return {Map.<string, Object>} Indexed agencies.
   */
  getIndexedAgencies() { return getIndexedTable(this, 'agency'); }

  /**
   * Removes an agency of the GTFS.
   *
   * WARNING: It will remove the agency indexed by the `agency.agency_id` of the agency passed as parameter.
   *
   * @param {Object} agency Agency to remove of the GTFS.
   */
  removeAgency(agency) { removeItems(this, 'agency', [agency]); }

  /**
   * Removes a list of agencies of the GTFS.
   *
   * WARNING: It will remove the agencies indexed by the `agency.agency_id` of the agencies passed as parameter.
   *
   * @param {Array.<Object>} agencies Agencies to remove of the GTFS.
   */
  removeAgencies(agencies) { removeItems(this, 'agency', agencies); }

  /**
   * Reset the map of indexed agencies.
   */
  resetAgencies() { resetTable(this, 'agency'); }

  /**
   * Set the map of indexed agencies.
   *
   * WARNING: The Map should be indexed as defined in schema.js
   *
   * @param {Map.<string, Object>} indexedAgencies Map of agencies properly indexed (see schema.js).
   */
  setIndexedAgencies(indexedAgencies) { setTable(this, 'agency', indexedAgencies); }


  /* stops.txt */

  /**
   * Adds a stop in the GTFS.
   *
   * @param {Object} stop Stop to add in the GTFS.
   */
  addStop(stop) { addItems(this, 'stops', [stop]); }

  /**
   * Adds a list of stops in the GTFS.
   *
   * @param {Array.<Object>} stops Array of stops to add in the GTFS.
   */
  addStops(stops) { addItems(this, 'stops', stops); }

  /**
   * Apply a function to each stop in the GTFS.
   *
   * @param {function} iterator Function which will be applied on every stop.
   */
  forEachStop(iterator) { forEachItem(this, 'stops', iterator); }

  /**
   * Get the indexed stops of the GTFS. The indexation is defined in the schema (see schema.js).
   *
   * @return {Map.<string, Object>} Indexed stops.
   */
  getIndexedStops() { return getIndexedTable(this, 'stops'); }

  /**
   * Get the number of stops defined
   *
   * @returns {number}
   */
  getNumberOfStops() { return getNumberOfItemsInTable(this, 'stops'); }

  /**
   * Get the stop using one of its child stopTime.
   *
   * WARNING: Will return the stop which is indexed with the stopTime.stop_id of the stopTime passed as argument. If the
   * internal value of the stop's stop_id has been changed but not it's indexing, the result will be wrong.
   *
   * @param {Object} stopTime A stopTime of the GTFS.
   * @return {Object} The stop indexed by the stopTime.stop_id of the stopTime passed as parameter.
   */
  getStopOfStopTime(stopTime) { return getters.getParentItem(stopTime, 'stops', this); }

  /**
   * Get the stop using its stop_id.
   *
   * WARNING: Will return the stop which is indexed with the stop_id passed as argument. If the internal value of
   * the stop's stop_id has been changed but not it's indexing, the result will be wrong.
   *
   * @param {string} stopId Index of the stop.
   * @return {Object} The stop indexed by the stop_id passed as parameter.
   */
  getStopWithId(stopId) { return getters.getItemWithIndex(stopId, 'stops', this); }

  /**
   * Removes a stop of the GTFS.
   *
   * WARNING: It will remove the stop indexed by the `stop.stop_id` of the stop passed as parameter.
   *
   * @param {Object} stop Stop to remove of the GTFS.
   */
  removeStop(stop) { removeItems(this, 'stops', [stop]); }

  /**
   * Removes a list of stops of the GTFS.
   *
   * WARNING: It will remove the stops indexed by the `stop.stop_id` of the stops passed as parameter.
   *
   * @param {Array.<Object>} stops Stops to remove of the GTFS.
   */
  removeStops(stops) { removeItems(this, 'stops', stops); }

  /**
   * Reset the map of indexed stops.
   */
  resetStops() { resetTable(this, 'stops'); }

  /**
   * Set the map of indexed stops.
   *
   * WARNING: The Map should be indexed as defined in schema.js
   *
   * @param {Map.<string, Object>} indexedStops Map of stops properly indexed (see schema.js).
   */
  setIndexedStops(indexedStops) { setTable(this, 'stops', indexedStops); }


  /* routes.txt */

  /**
   * Adds a route in the GTFS.
   *
   * @param {Object} route Route to add in the GTFS.
   */
  addRoute(route) { addItems(this, 'routes', [route]); }

  /**
   * Adds a list of routes in the GTFS.
   *
   * @param {Array.<Object>} routes Array of routes to add in the GTFS.
   */
  addRoutes(routes) { addItems(this, 'routes', routes); }

  /**
   * Apply a function to each route in the GTFS.
   *
   * @param {function} iterator Function which will be applied on every route.
   */
  forEachRoute(iterator) { forEachItem(this, 'routes', iterator); }

  /**
   * Get the indexed routes of the GTFS. The indexation is defined in the schema (see schema.js).
   *
   * @return {Map.<string, Object>} Indexed routes.
   */
  getIndexedRoutes() { return getIndexedTable(this, 'routes'); }

  /**
   * Get the number of routes defined
   *
   * @returns {number}
   */
  getNumberOfRoutes() { return getNumberOfItemsInTable(this, 'routes'); }

  /**
   * Get the route using one of its grand child stopTime.
   *
   * @param  {Object} stopTime A stopTime of the GTFS.
   * @return {Object}          The grand parent route of the stopTime.
   */
  getRouteOfStopTime(stopTime) { return getters.getGrandParentItem(stopTime, 'trips', 'routes', this); }

  /**
   * Get a sample route.
   *
   * WARNING: This is not a random route. With the current implementation, it will be the first one in inserting order.
   *
   * @returns {Object}
   */
  getSampleRoute() { return getIndexedTable(this, 'routes').values().next().value; }

  /**
   * Get the route using one of its child trip.
   *
   * WARNING: Will return the route which is indexed with the trip.route_id of the trip passed as argument. If the
   * internal value of the route's route_id has been changed but not it's indexing, the result will be wrong.
   *
   * @param {Object} trip A trip of the GTFS.
   * @return {Object} The route indexed by the trip.route_id of the trip passed as parameter.
   */
  getRouteOfTrip(trip) { return getters.getParentItem(trip, 'routes', this); }

  /**
   * Get the route using its route_id.
   *
   * WARNING: Will return the route which is indexed with the route_id passed as argument. If the internal value of
   * the route's route_id has been changed but not it's indexing, the result will be wrong.
   *
   * @param {string} routeId Index of the route.
   * @return {Object} The route indexed by the route_id passed as parameter.
   */
  getRouteWithId(routeId) { return getters.getItemWithIndex(routeId, 'routes', this); }

  /**
   * Removes a route of the GTFS.
   *
   * WARNING: It will remove the route indexed by the `route.route_id` of the route passed as parameter.
   *
   * @param {Object} route Route to remove of the GTFS.
   */
  removeRoute(route) { removeItems(this, 'routes', [route]); }

  /**
   * Removes a list of routes of the GTFS.
   *
   * WARNING: It will remove the routes indexed by the `route.route_id` of the routes passed as parameter.
   *
   * @param {Array.<Object>} routes Routes to remove of the GTFS.
   */
  removeRoutes(routes) { removeItems(this, 'routes', routes); }

  /**
   * Reset the map of indexed routes.
   */
  resetRoutes() { resetTable(this, 'routes'); }

  /**
   * Set the map of indexed routes.
   *
   * WARNING: The Map should be indexed as defined in schema.js
   *
   * @param {Map.<string, Object>} indexedRoutes Map of routes properly indexed (see schema.js).
   */
  setIndexedRoutes(indexedRoutes) { setTable(this, 'routes', indexedRoutes); }

  /* trips.txt */

  /**
   * Adds a trip in the GTFS.
   *
   * @param {Object} trip Trip to add in the GTFS.
   */
  addTrip(trip) { addItems(this, 'trips', [trip]); }

  /**
   * Adds a list of trips in the GTFS.
   *
   * @param {Array.<Object>} trips Array of trips to add in the GTFS.
   */
  addTrips(trips) { addItems(this, 'trips', trips); }

  /**
   * Apply a function to each trip in the GTFS.
   *
   * @param {function} iterator Function which will be applied on every trip.
   */
  forEachTrip(iterator) { forEachItem(this, 'trips', iterator); }

  /**
   * Get the indexed trips of the GTFS. The indexation is defined in the schema (see schema.js).
   *
   * @return {Map.<string, Object>} Indexed trips.
   */
  getIndexedTrips() { return getIndexedTable(this, 'trips'); }

  /**
   * Get the number of trips defined
   *
   * @returns {number}
   */
  getNumberOfTrips() { return getNumberOfItemsInTable(this, 'trips'); }

  /**
   * Get a sample trip.
   *
   * WARNING: This is not a random trip. With the current implementation, it will be the first one in inserting order.
   *
   * @returns {Object}
   */
  getSampleTrip() { return getIndexedTable(this, 'trips').values().next().value; }

  /**
   * Get the trip using one of its child stopTime.
   *
   * WARNING: Will return the trip which is indexed with the stopTime.trip_id of the stopTime passed as argument. If the
   * internal value of the trip's trip_id has been changed but not it's indexing, the result will be wrong.
   *
   * @param {Object} stopTime A stopTime of the GTFS.
   * @return {Object} The trip indexed by the stopTime.trip_id of the stopTime passed as parameter.
   */
  getTripOfStopTime(stopTime) { return getters.getParentItem(stopTime, 'trips', this); }

  /**
   * Get the trip using its trip_id.
   *
   * WARNING: Will return the trip which is indexed with the trip_id passed as argument. If the internal value of
   * the trip's trip_id has been changed but not it's indexing, the result will be wrong.
   *
   * @param {string} tripId Index of the trip.
   * @return {Object} The trip indexed by the trip_id passed as parameter.
   */
  getTripWithId(tripId) { return getters.getItemWithIndex(tripId, 'trips', this); }

  /**
   * Removes a trip of the GTFS.
   *
   * WARNING: It will remove the trip indexed by the `trip.trip_id` of the trip passed as parameter.
   *
   * @param {Object} trip Trip to remove of the GTFS.
   */
  removeTrip(trip) { removeItems(this, 'trips', [trip]); }

  /**
   * Removes a list of trips of the GTFS.
   *
   * WARNING: It will remove the trips indexed by the `trip.trip_id` of the trips passed as parameter.
   *
   * @param {Array.<Object>} trips Trips to remove of the GTFS.
   */
  removeTrips(trips) { removeItems(this, 'trips', trips); }

  /**
   * Set the map of indexed trips.
   *
   * WARNING: The Map should be indexed as defined in schema.js
   *
   * @param {Map.<string, Object>} indexedTrips Map of trips properly indexed (see schema.js).
   */
  setIndexedTrips(indexedTrips) { setTable(this, 'trips', indexedTrips); }

  /**
   * Reset the map of indexed trips.
   */
  resetTrips() { resetTable(this, 'trips'); }


  /* stop_times.txt */

  /**
   * Adds a stopTime in the GTFS.
   *
   * @param {Object} stopTime StopTime to add in the GTFS.
   */
  addStopTime(stopTime) { addItems(this, 'stop_times', [stopTime]); }

  /**
   * Adds a list of stopTimes in the GTFS.
   *
   * @param {Array.<Object>} stopTimes Array of stopTimes to add in the GTFS.
   */
  addStopTimes(stopTimes) { addItems(this, 'stop_times', stopTimes); }

  /**
   * Apply a function to each stopTime in the GTFS.
   *
   * @param {function} iterator Function which will be applied on every stopTime.
   */
  forEachStopTime(iterator) { forEachItem(this, 'stop_times', iterator); }

  /**
   * Apply a function to each stopTime of a specific trip in the GTFS.
   *
   * @param {Object}   trip     Trip scoping the stopTime in which to enumerate.
   * @param {function} iterator Function which will be applied on every stopTime of the trip.
   */
  forEachStopTimeOfTrip(trip, iterator) {
    const stopTimeByStopSequence = this.getStopTimeByStopSequenceOfTrip(trip);
    if (stopTimeByStopSequence instanceof Map) {
      stopTimeByStopSequence.forEach(iterator);
    }
  }

  /**
   * Apply a function to each stopTime of a specific trip id in the GTFS.
   *
   * @param {string}   tripId   Trip id scoping the stopTime in which to enumerate.
   * @param {function} iterator Function which will be applied on every stopTime of the trip.
   */
  forEachStopTimeOfTripId(tripId, iterator) {
    const stopTimeByStopSequenceByTripId = this.getIndexedStopTimes();
    const stopTimeByStopSequence = stopTimeByStopSequenceByTripId.get(tripId);

    if (stopTimeByStopSequence instanceof Map) {
      stopTimeByStopSequence.forEach(iterator);
    }
  }

  /**
   * Get the indexed stopTimes of the GTFS. The indexation is defined in the schema (see schema.js).
   *
   * @return {Map.<string, Map.<string, Object>>} Indexed stopTimes.
   */
  getIndexedStopTimes() { return getIndexedTable(this, 'stop_times'); }

  /**
   * Get the number of stop time defined for one specific trip
   *
   * @param {Object}   trip  Trip scoping the stop times to count.
   * @returns {number}
   */
  getNumberOfStopTimeOfTrip(trip) {
    const stopTimeByStopSequence = this.getStopTimeByStopSequenceOfTrip(trip);
    return (stopTimeByStopSequence instanceof Map) ? stopTimeByStopSequence.size : 0;
  }

  /**
   * Get the number of stop time defined for one specific trip id
   *
   * @param {string}   tripId  Trip id scoping the stop times to count.
   * @returns {number}
   */
  getNumberOfStopTimeOfTripId(tripId) {
    const stopTimeByStopSequenceByTripId = this.getIndexedStopTimes();
    const stopTimeByStopSequence = stopTimeByStopSequenceByTripId.get(tripId);
    return (stopTimeByStopSequence instanceof Map) ? stopTimeByStopSequence.size : 0;
  }

  /**
   * Get the child stopTimes of a trip.
   *
   * @param  {Object} trip          The parent trip.
   * @return {Map.<string, Object>} Indexed child stopTimes.
   */
  getStopTimeByStopSequenceOfTrip(trip) { return getters.getIndexedItemsWithParent(trip, 'stop_times', this); }

  /**
   * Get a stopTime using its indexes: the tripId and the stopSequence.
   *
   * @param  {string} tripId       First index of the stopTime
   * @param  {string} stopSequence Second index of the stopTime
   * @return {Object}              StopTime object
   */
  getStopTimeWithTripIdAndStopSequence(tripId, stopSequence) {
    return getters.getItemWithIndexes(tripId, stopSequence, 'stop_times', this);
  }

  /**
   * Removes a stopTime of the GTFS.
   *
   * @param {Object} stopTime StopTime to remove of the GTFS.
   */
  removeStopTime(stopTime) { removeItems(this, 'stop_times', [stopTime]); }

  /**
   * Removes a list of stopTimes of the GTFS.
   *
   * @param {Array.<Object>} stopTimes StopTimes to remove of the GTFS.
   */
  removeStopTimes(stopTimes) { removeItems(this, 'stop_times', stopTimes); }

  /**
   * Set the map of indexed stopTimes.
   *
   * WARNING: The Map should be indexed as defined in schema.js
   *
   * @param {Map.<string, Map.<string, Object>>} indexedStopTimes Map of stopTimes properly indexed (see schema.js).
   */
  setIndexedStopTimes(indexedStopTimes) { setTable(this, 'stop_times', indexedStopTimes); }

  /**
   * Reset the map of indexed stop times.
   */
  resetStopTimes() { resetTable(this, 'stop_times'); }


  /* calendar.txt */

  /**
   * Adds a calendar in the GTFS.
   *
   * @param {Object} calendar Calendar to add in the GTFS.
   */
  addCalendar(calendar) { addItems(this, 'calendar', [calendar]); }

  /**
   * Adds a list of calendars in the GTFS.
   *
   * @param {Array.<Object>} calendars Array of calendars to add in the GTFS.
   */
  addCalendars(calendars) { addItems(this, 'calendar', calendars); }

  /**
   * Apply a function to each calendar in the GTFS.
   *
   * @param {function} iterator Function which will be applied on every calendar.
   */
  forEachCalendar(iterator) { forEachItem(this, 'calendar', iterator); }

  /**
   * Get the calendar using one of its child trip.
   *
   * WARNING: Will return the calendar which is indexed with the trip.service_id of the trip passed as argument. If the
   * internal value of the calendar's service_id has been changed but not it's indexing, the result will be wrong.
   *
   * @param {Object} trip A trip of the GTFS.
   * @return {Object} The calendar indexed by the trip.service_id of the trip passed as parameter.
   */
  getCalendarOfTrip(trip) { return getters.getParentItem(trip, 'calendar', this); }

  /**
   * Get the calendar using one of its grand child stopTime.
   *
   * @param  {Object} stopTime A stopTime of the GTFS.
   * @return {Object}          The grand parent calendar of the stopTime.
   */
  getCalendarOfStopTime(stopTime) {
    return getters.getGrandParentItem(stopTime, 'trips', 'calendar', this);
  }

  /**
   * Get the calendar using its service_id.
   *
   * WARNING: Will return the calendar which is indexed with the service_id passed as argument. If the internal value of
   * the calendar's service_id has been changed but not it's indexing, the result will be wrong.
   *
   * @param {string} serviceId Index of the calendar.
   * @return {Object} The calendar indexed by the service_id passed as parameter.
   */
  getCalendarWithServiceId(serviceId) { return getters.getItemWithIndex(serviceId, 'calendar', this); }

  /**
   * Get the indexed calendars of the GTFS. The indexation is defined in the schema (see schema.js).
   *
   * @return {Map.<string, Object>} Indexed calendars.
   */
  getIndexedCalendars() { return getIndexedTable(this, 'calendar'); }

  /**
   * Get the number of calendar defined
   *
   * @returns {number}
   */
  getNumberOfCalendars() { return getNumberOfItemsInTable(this, 'calendar'); }

  /**
   * Removes an calendar of the GTFS.
   *
   * WARNING: It will remove the calendar indexed by the `calendar.service_id` of the calendar passed as parameter.
   *
   * @param {Object} calendar Calendar to remove of the GTFS.
   */
  removeCalendar(calendar) { removeItems(this, 'calendar', [calendar]); }

  /**
   * Removes a list of calendars of the GTFS.
   *
   * @param {Array.<Object>} calendars Calendars to remove of the GTFS.
   */
  removeCalendars(calendars) { removeItems(this, 'calendar', calendars); }

  /**
   * Reset the map of indexed calendars.
   */
  resetCalendars() { resetTable(this, 'calendar'); }

  /**
   * Set the map of indexed calendars.
   *
   * WARNING: The Map should be indexed as defined in schema.js
   *
   * @param {Map.<string, Object>} indexedCalendars Map of calendars properly indexed (see schema.js).
   */
  setIndexedCalendars(indexedCalendars) { setTable(this, 'calendar', indexedCalendars); }


  /* calendar_dates.txt */

  /**
   * Adds a calendarDate in the GTFS.
   *
   * @param {Object} calendarDate CalendarDate to add in the GTFS.
   */
  addCalendarDate(calendarDate) { addItems(this, 'calendar_dates', [calendarDate]); }

  /**
   * Adds a list of calendarDates in the GTFS.
   *
   * @param {Array.<Object>} calendarDates Array of calendarDates to add in the GTFS.
   */
  addCalendarDates(calendarDates) { addItems(this, 'calendar_dates', calendarDates); }

  /**
   * Apply a function to each calendarDate in the GTFS.
   *
   * @param {function} iterator Function which will be applied on every calendarDate.
   */
  forEachCalendarDate(iterator) { forEachItem(this, 'calendar_dates', iterator); }

  /**
   * Apply a function to each calendar date of a specific trip in the GTFS.
   *
   * @param {Object}   trip     Trip scoping the calendar dates in which to enumerate.
   * @param {function} iterator Function which will be applied on every calendar dates of the trip.
   */
  forEachCalendarDateOfTrip(trip, iterator) {
    const calendarDateByDate = this.getCalendarDateByDateOfTrip(trip);

    if (calendarDateByDate instanceof Map) {
      calendarDateByDate.forEach(iterator);
    }
  }

  /**
   * Apply a function to each calendar dates of a specific service id in the GTFS.
   *
   * @param {string}   serviceId  Service id scoping the calendar dates in which to enumerate.
   * @param {function} iterator   Function which will be applied on every calendar dates of the service.
   */
  forEachCalendarDateWithServiceId(serviceId, iterator) {
    const calendarDateByDateByServiceId = this.getIndexedCalendarDates();
    const calendarDateByDate = calendarDateByDateByServiceId.get(serviceId);

    if (calendarDateByDate instanceof Map) {
      calendarDateByDate.forEach(iterator);
    }
  }

  /**
   * Get the calendarDates of a serviceId.
   *
   * @param  {string} serviceId     The serviceId.
   * @return {Map.<string, Object>} Indexed calendarDates.
   */
  getCalendarDateByDateOfServiceId(serviceId) {
    return getters.getIndexedItemsWithParentIndex(serviceId, 'calendar_dates', this);
  }

  /**
   * Get the child calendarDates of a trip.
   *
   * @param  {Object} trip          The parent trip.
   * @return {Map.<string, Object>} Indexed child calendarDates.
   */
  getCalendarDateByDateOfTrip(trip) { return getters.getIndexedItemsWithParent(trip, 'calendar_dates', this); }

  /**
   * Get a calendarDate using its indexes: the serviceId and the date.
   *
   * @param  {string} serviceId First index of the calendarDate
   * @param  {string} date      Second index of the calendarDate
   * @return {Object}           CalendarDate object
   */
  getCalendarDateWithServiceIdAndDate(serviceId, date) {
    return getters.getItemWithIndexes(serviceId, date, 'calendar_dates', this);
  }

  /**
   * Get the indexed calendarDates of the GTFS. The indexation is defined in the schema (see schema.js).
   *
   * @return {Map.<string, Map.<string, Object>>} Indexed calendarDates.
   */
  getIndexedCalendarDates() { return getIndexedTable(this, 'calendar_dates'); }

  /**
   * Check if there are calendar dates with a specific service id
   *
   * @param {string}   serviceId  Service id to for which to check if calendar dates are defined.
   * @returns {boolean}
   */
  hasCalendarDatesWithServiceId(serviceId) {
    const calendarDateByDateByServiceId = this.getIndexedCalendarDates();
    const calendarDateByDate = calendarDateByDateByServiceId.get(serviceId);

    return (calendarDateByDate instanceof Map && calendarDateByDate.size !== 0);
  }

  /**
   * Removes a calendarDate of the GTFS.
   *
   * @param {Object} calendarDate CalendarDate to remove of the GTFS.
   */
  removeCalendarDate(calendarDate) { removeItems(this, 'calendar_dates', [calendarDate]); }

  /**
   * Removes a list of calendarDates of the GTFS.
   *
   * @param {Array.<Object>} calendarDates CalendarDates to remove of the GTFS.
   */
  removeCalendarDates(calendarDates) { removeItems(this, 'calendar_dates', calendarDates); }

  /**
   * Reset the map of indexed calendars dates.
   */
  resetCalendarDates() { resetTable(this, 'calendar_dates'); }

  /**
   * Set the map of indexed calendarDates.
   *
   * WARNING: The Map should be indexed as defined in schema.js
   *
   * @param {
   *   Map.<string, Map.<string, Object>>
   * } indexedCalendarDates Map of calendarDates properly indexed (see schema.js).
   */
  setIndexedCalendarDates(indexedCalendarDates) { setTable(this, 'calendar_dates', indexedCalendarDates); }


  /* fare_attributes.txt */

  /**
   * Adds a fareAttribute in the GTFS.
   *
   * @param {Object} fareAttribute - FareAttribute to add in the GTFS.
   */
  addFareAttribute(fareAttribute) { addItems(this, 'fare_attributes', [fareAttribute]); }

  /**
   * Adds a list of fareAttributes in the GTFS.
   *
   * @param {Array.<Object>} fareAttributes - Array of fareAttributes to add in the GTFS.
   */
  addFareAttributes(fareAttributes) { addItems(this, 'fare_attributes', fareAttributes); }

  /**
   * Apply a function to each fareAttribute in the GTFS.
   *
   * @param {function} iterator - Function which will be applied on every fareAttribute.
   */
  forEachFareAttribute(iterator) { forEachItem(this, 'fare_attributes', iterator); }

  /**
   * Get the indexed fareAttributes of the GTFS. The indexation is defined in the schema (see schema.js).
   *
   * @return {Map.<string, Object>} Indexed fareAttributes.
   */
  getIndexedFareAttributes() { return getIndexedTable(this, 'fare_attributes'); }

  /**
   * Get the number of fareAttributes defined
   *
   * @returns {number}
   */
  getNumberOfFareAttributes() { return getNumberOfItemsInTable(this, 'fare_attributes'); }

  /**
   * Get the fareAttribute using its fare_id.
   *
   * WARNING: Will return the fareAttribute which is indexed with the fare_id passed as argument. If the internal value
   * of the fareAttribute's fare_id has been changed but not it's indexing, the result will be wrong.
   *
   * @param {string} fareId - Index of the fareAttribute.
   * @return {Object} The fareAttribute indexed by the fare_id passed as parameter.
   */
  getFareAttributeWithId(fareId) { return getters.getItemWithIndex(fareId, 'fare_attributes', this); }

  /**
   * Removes a fareAttribute of the GTFS.
   *
   * WARNING: It will remove the fareAttribute indexed by the `fareAttribute.fare_id` of the fareAttribute passed as
   * parameter.
   *
   * @param {Object} fareAttribute - FareAttribute to remove of the GTFS.
   */
  removeFareAttribute(fareAttribute) { removeItems(this, 'fare_attributes', [fareAttribute]); }

  /**
   * Removes a list of fareAttributes of the GTFS.
   *
   * WARNING: It will remove the fareAttributes indexed by the `fareAttribute.fare_id` of the fareAttributes
   * passed as parameter.
   *
   * @param {Array.<Object>} fareAttributes FareAttributes to remove of the GTFS.
   */
  removeFareAttributes(fareAttributes) { removeItems(this, 'fare_attributes', fareAttributes); }

  /**
   * Reset the map of indexed fareAttributes.
   */
  resetFareAttributes() { resetTable(this, 'fare_attributes'); }

  /**
   * Set the map of indexed fareAttributes.
   *
   * WARNING: The Map should be indexed as defined in schema.js
   *
   * @param {Map.<string, Object>} indexedFareAttributes Map of fareAttributes properly indexed (see schema.js).
   */
  setIndexedFareAttributes(indexedFareAttributes) { setTable(this, 'fare_attributes', indexedFareAttributes); }


  /* fare_rules.txt */

  /**
   * Adds a fareRule in the GTFS.
   *
   * @param {Object} fareRule - FareRule to add in the GTFS.
   */
  addFareRule(fareRule) { addItems(this, 'fare_rules', [fareRule]); }

  /**
   * Adds a list of fareRules in the GTFS.
   *
   * @param {Array.<Object>} fareRules - Array of fareRules to add in the GTFS.
   */
  addFareRules(fareRules) { addItems(this, 'fare_rules', fareRules); }

  /**
   * Apply a function to each fareRule in the GTFS.
   *
   * @param {function} iterator - Function which will be applied on every fareRule.
   */
  forEachFareRule(iterator) { forEachItem(this, 'fare_rules', iterator); }

  /**
   * Get the number of fareRule defined
   *
   * @returns {number}
   */
  getNumberOfFareRules() { return getNumberOfItemsInTable(this, 'fare_rules'); }

  /**
   * Check if a fareRule is in the GTFS.
   *
   * @param {Object} fareRule - FareRule which could be in the GTFS.
   * @returns {Boolean} true is the item is in the GTFS, false otherwise.
   */
  hasFareRule(fareRule) { return hasItemInTable(this, fareRule, 'fare_rules'); }

  /**
   * Removes a fareRule of the GTFS.
   *
   * @param {Object} fareRule - FareRule to remove of the GTFS.
   */
  removeFareRule(fareRule) { removeItems(this, 'fare_rules', [fareRule]); }

  /**
   * Removes a list of fareRules of the GTFS.
   *
   * @param {Array.<Object>} fareRules - FareRules to remove of the GTFS.
   */
  removeFareRules(fareRules) { removeItems(this, 'fare_rules', fareRules); }

  /**
   * Reset the map of indexed fareRules.
   */
  resetFareRules() { resetTable(this, 'fare_rules'); }

  /**
   * Set the Set of fareRules.
   *
   * @param {Set.<Object>} fareRules - Set of fareRules properly indexed (see schema.js).
   */
  setFareRules(fareRules) { setTable(this, 'fare_rules', fareRules); }


  /* shapes.txt */

  /**
   * Adds a shapePoint in the GTFS.
   *
   * @param {Object} shapePoint ShapePoint to add in the GTFS.
   */
  addShapePoint(shapePoint) { addItems(this, 'shapes', [shapePoint]); }

  /**
   * Adds a list of shapePoints in the GTFS.
   *
   * @param {Array.<Object>} shapePoints Array of shapePoints to add in the GTFS.
   */
  addShapePoints(shapePoints) { addItems(this, 'shapes', shapePoints); }

  /**
   * Apply a function to each shapePoint in the GTFS.
   *
   * @param {function} iterator Function which will be applied on every shapePoint.
   */
  forEachShapePoint(iterator) { forEachItem(this, 'shapes', iterator); }

  /**
   * Apply a function to each calendar dates of a specific service id in the GTFS.
   *
   * @param {string}   shapeId  Service id scoping the calendar dates in which to enumerate.
   * @param {function} iterator   Function which will be applied on every calendar dates of the service.
   */
  forEachShapePointOfShapeId(shapeId, iterator) {
    const shapePointByShapePointSequenceByShapeId = this.getIndexedShapePoints();
    const shapePointByShapePointSequence = shapePointByShapePointSequenceByShapeId.get(shapeId);

    if (shapePointByShapePointSequence instanceof Map) {
      shapePointByShapePointSequence.forEach(iterator);
    }
  }

  /**
   * Get the indexed shapePoints of the GTFS. The indexation is defined in the schema (see schema.js).
   *
   * @return {Map.<string, Map.<string, Object>>} Indexed shapePoints.
   */
  getIndexedShapePoints() { return getIndexedTable(this, 'shapes'); }

  /**
   * Get the shapePoint of a shapeId.
   *
   * @param  {string} shapeId       The shapeId.
   * @return {Map.<string, Object>} Indexed shapePoints.
   */
  getShapePointByShapePointSequenceOfShapeId(shapeId) {
    return getters.getIndexedItemsWithParentIndex(shapeId, 'shapes', this);
  }

  /**
   * Get the child shapePoints of a trip.
   *
   * @param  {Object} trip          The parent trip.
   * @return {Map.<string, Object>} Indexed child shapePoints.
   */
  getShapePointByShapePointSequenceOfTrip(trip) { return getters.getIndexedItemsWithParent(trip, 'shapes', this); }

  /**
   * Get a shapePoint using its indexes: the shapeId and the shapePointSequence.
   *
   * @param  {string} shapeId            First index of the shapePoint
   * @param  {string} shapePointSequence Second index of the shapePoint
   * @return {Object}                    ShapePoint object
   */
  getShapePointWithShapeIdAndShapePointSequence(shapeId, shapePointSequence) {
    return getters.getItemWithIndexes(shapeId, shapePointSequence, 'shapes', this);
  }

  /**
   * Removes a shapePoint of the GTFS.
   *
   * @param {Object} shapePoint ShapePoint to remove of the GTFS.
   */
  removeShapePoint(shapePoint) { removeItems(this, 'shapes', [shapePoint]); }

  /**
   * Removes a list of shapePoints of the GTFS.
   *
   * @param {Array.<Object>} shapePoints ShapePoints to remove of the GTFS.
   */
  removeShapePoints(shapePoints) { removeItems(this, 'shapes', shapePoints); }

  /**
   * Reset the shape points.
   */
  resetShapePoints() { resetTable(this, 'shapes'); }

  /**
   * Set the map of indexed shapePoints.
   *
   * WARNING: The Map should be indexed as defined in schema.js
   *
   * @param {Map.<string, Object>} indexedShapePoints Map of shapePoints properly indexed (see schema.js).
   */
  setIndexedShapePoints(indexedShapePoints) { setTable(this, 'shapes', indexedShapePoints); }


  /* frequencies.txt */

  /**
   * Adds a frequency in the GTFS.
   *
   * @param {Object} frequency Frequency to add in the GTFS.
   */
  addFrequency(frequency) { addItems(this, 'frequencies', [frequency]); }

  /**
   * Adds a list of frequencies in the GTFS.
   *
   * @param {Array.<Object>} frequencies Array of frequencies to add in the GTFS.
   */
  addFrequencies(frequencies) { addItems(this, 'frequencies', frequencies); }

  /**
   * Apply a function to each frequency in the GTFS.
   *
   * @param {function} iterator Function which will be applied on every frequency.
   */
  forEachFrequency(iterator) { forEachItem(this, 'frequencies', iterator); }

  /**
   * Get the indexed frequencies of the GTFS. The indexation is defined in the schema (see schema.js).
   *
   * @return {Map.<string, Map.<string, Object>>} Indexed frequencies.
   */
  getIndexedFrequencies() { return getIndexedTable(this, 'frequencies'); }

  /**
   * Get a frequency using its indexes: the tripId and the startTime.
   *
   * @param  {string} tripId    First index of the frequency
   * @param  {string} startTime Second index of the frequency
   * @return {Object}           Frequency object
   */
  getFrequencyWithTripIdAndStartTime(tripId, startTime) {
    return getters.getItemWithIndexes(tripId, startTime, 'frequencies', this);
  }

  /**
   * Removes a frequency of the GTFS.
   *
   * @param {Object} frequency Frequency to remove of the GTFS.
   */
  removeFrequency(frequency) { removeItems(this, 'frequencies', [frequency]); }

  /**
   * Removes a list of frequencies of the GTFS.
   *
   * @param {Array.<Object>} frequencies Frequencies to remove of the GTFS.
   */
  removeFrequencies(frequencies) { removeItems(this, 'frequencies', frequencies); }

  /**
   * Reset the map of indexed frequencies.
   */
  resetFrequencies() { resetTable(this, 'frequencies'); }

  /**
   * Set the map of indexed frequencies.
   *
   * WARNING: The Map should be indexed as defined in schema.js
   *
   * @param {Map.<string, Object>} indexedFrequencies Map of frequencies properly indexed (see schema.js).
   */
  setIndexedFrequencies(indexedFrequencies) { setTable(this, 'frequencies', indexedFrequencies); }


  /* transfers.txt */

  /**
   * Adds a transfer in the GTFS.
   *
   * @param {Object} transfer Transfer to add in the GTFS.
   */
  addTransfer(transfer) { addItems(this, 'transfers', [transfer]); }

  /**
   * Adds a list of transfers in the GTFS.
   *
   * @param {Array.<Object>} transfers Array of transfers to add in the GTFS.
   */
  addTransfers(transfers) { addItems(this, 'transfers', transfers); }

  /**
   * Apply a function to each transfer in the GTFS.
   *
   * @param {function} iterator Function which will be applied on every transfer.
   */
  forEachTransfer(iterator) { forEachItem(this, 'transfers', iterator); }

  /**
   * Get the indexed transfers of the GTFS. The indexation is defined in the schema (see schema.js).
   *
   * @return {Map.<string, Map.<string, Object>>} Indexed transfers.
   */
  getIndexedTransfers() { return getIndexedTable(this, 'transfers'); }

  /**
   * Get a transfer using its indexes: the fromStopId and the toStopId.
   *
   * @param  {string} fromStopId First index of the transfer
   * @param  {string} toStopId   Second index of the transfer
   * @return {Object}            Transfer object
   */
  getTransferWithFromStopIdAndToStopId(fromStopId, toStopId) {
    return getters.getItemWithIndexes(fromStopId, toStopId, 'transfers', this);
  }

  /**
   * Removes a transfer of the GTFS.
   *
   * @param {Object} transfer Transfer to remove of the GTFS.
   */
  removeTransfer(transfer) { removeItems(this, 'transfers', [transfer]); }

  /**
   * Removes a list of transfers of the GTFS.
   *
   * @param {Array.<Object>} transfers Transfers to remove of the GTFS.
   */
  removeTransfers(transfers) { removeItems(this, 'transfers', transfers); }

  /**
   * Reset the map of indexed transfers.
   */
  resetTransfers() { resetTable(this, 'transfers'); }

  /**
   * Set the map of indexed transfers.
   *
   * WARNING: The Map should be indexed as defined in schema.js
   *
   * @param {Map.<string, Map.<string, Object>>} indexedTransfers Map of transfers properly indexed (see schema.js).
   */
  setIndexedTransfers(indexedTransfers) { setTable(this, 'transfers', indexedTransfers); }

  /* pathways.txt */

  /**
   * Adds a pathway in the GTFS.
   *
   * @param {Object} pathway Pathway to add in the GTFS.
   */
  addPathway(pathway) { addItems(this, 'pathways', [pathway]); }

  /**
   * Adds a list of pathways in the GTFS.
   *
   * @param {Array.<Object>} pathways Array of transfers to add in the GTFS.
   */
  addPathways(pathways) { addItems(this, 'pathways', pathways); }

  /**
   * Apply a function to each pathway in the GTFS.
   *
   * @param {function} iterator Function which will be applied on every pathway.
   */
  forEachPathway(iterator) { forEachItem(this, 'pathways', iterator); }

  /**
   * Get the indexed pathways of the GTFS. The indexation is defined in the schema (see schema.js).
   *
   * @return {Map.<string, Map.<string, Object>>} Indexed transfers.
   */
  getIndexedPathways() { return getIndexedTable(this, 'pathways'); }

  /**
   * Get a pathway using its index: pathwayId.
   *
   * @param  {string} pathwayId   First index of the pathway
   * @return {Object}            Pathway object
   */
  getPathwayWithPathwayId(pathwayId) {
    return getters.getItemWithIndex(pathwayId, 'pathways', this);
  }

  /**
   * Removes a pathway of the GTFS.
   *
   * @param {Object} pathway Pathway to remove of the GTFS.
   */
  removePathway(pathway) { removeItems(this, 'pathways', [pathway]); }

  /**
   * Removes a list of pathways of the GTFS.
   *
   * @param {Array.<Object>} pathways Pathways to remove of the GTFS.
   */
  removePathways(pathways) { removeItems(this, 'pathways', pathways); }

  /**
   * Reset the map of indexed pathways.
   */
  resetPathways() { resetTable(this, 'pathways'); }

  /**
   * Set the map of indexed transfers.
   *
   * WARNING: The Map should be indexed as defined in schema.js
   *
   * @param {Map.<string, Map.<string, Object>>} indexedPathways Map of pathways properly indexed (see schema.js).
   */
  setIndexedPathways(indexedPathways) { setTable(this, 'pathways', indexedPathways); }


  /* feed_info.txt */

  /**
   * Get the feed info of the GTFS, which is unique.
   *
   * @return {Object} The feed info object.
   */
  getFeedInfo() { return getIndexedTable(this, 'feed_info'); }

  /**
   * Set the feed info of the GTFS, which is unique.
   *
   * @param {Object} feedInfo The feed info object.
   */
  setFeedInfo(feedInfo) { setTable(this, 'feed_info', feedInfo); }

  /** Create a gtfs object from a simple object */
  createGtfsObjectFromSimpleObject(obj) { return createGtfsObjectFromSimpleObject(obj); }
}

module.exports = Gtfs;
