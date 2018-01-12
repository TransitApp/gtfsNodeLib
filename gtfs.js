'use strict';

/* eslint-disable no-underscore-dangle */

const infoLog = require('debug')('gtfsNodeLib:i');
const fs = require('fs-extra');

const forEachWithLog = require('./helpers/logging_iterator_wrapper');
const { exportGtfs } = require('./helpers/export');
const getters = require('./helpers/getters');
const { importTable } = require('./helpers/import');
const schema = require('./helpers/schema');

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

  const indexedTable = gtfs.getIndexedTable(tableName);
  const indexKeys = schema.indexKeysByTableName[tableName];

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
 * @param  {Object} [options] Configuration object passed to importTable function.
 * @return {Object}           Indexed table returned
 */

function getIndexedTable(gtfs, tableName, options) {
  if (gtfs._tables.has(tableName) === false) {
    importTable(gtfs, tableName, options);
    infoLog(`[Importation] Table ${tableName} has been imported.`);
  }

  return gtfs._tables.get(tableName);
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
  const deepness = schema.deepnessByTableName[tableName];

  if (deepness === 1) {
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
  const indexKeys = schema.indexKeysByTableName[tableName];

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
 * @param  {Map}    indexedItems Object properly indexed as the schema requires the table to be (see schema.js).
 */

function setIndexedItems(gtfs, tableName, indexedItems) {
  if (indexedItems instanceof Map === false && schema.deepnessByTableName[tableName] !== 0) {
    throw new Error(`indexedItems must be a Map instead of: ${indexedItems}`);
  }

  gtfs._tables.set(tableName, indexedItems);
}

class Gtfs {
  /**
   * Constructor of the GTFS
   *
   * @param  {string} path Path to the folder that contains the GTFS text files.
   * @param  {Map.<
   *           string,
   *           Array.<{regex: RegExp, pattern: string}>
   *          >} [regexPatternObjectsByTableName] Optional ad-hoc regex to fix the tables. See importTable.
   * @return {Gtfs} gtfs Instanciated GTFS object.
   */

  constructor(path, regexPatternObjectsByTableName) {
    if (typeof path !== 'string' || path.length === 0) {
      throw new Error(`Gtfs need a valid input path as string, instead of: "${path}".`);
    }

    path = (path[path.length - 1] === '/') ? path : `${path}/`;

    if (fs.existsSync(path) === false) {
      throw new Error(`inputPath: "${path}" is not a valid folder.`);
    }

    this.isGtfs = true;

    this._path = path;
    this._regexPatternObjectsByTableName = regexPatternObjectsByTableName || {};
    this._tables = new Map();
  }

  /* io */
  /**
   * Async function exporting the GTFS at a specific path.
   *
   * @param  {string}   path     Path to the folder which will contain the GTFS. The folder will be created if needed.
   * @param  {function} callback Function called when the export will be done.
   */
  exportAtPath(path, callback) { exportGtfs(this, path, callback); }

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

  forEachItemInTable(tableName, iterator) { forEachItem(this, tableName, iterator); }
  forEachTableName(iterator) { this.getTableNames().forEach(iterator); }
  getIndexedTable(tableName, forcedValuesByKeys) { return getIndexedTable(this, tableName, forcedValuesByKeys); }
  getItemWithIndexInTable(index, tableName) { return getters.getItemWithIndex(index, tableName, this); }
  getTableNames() { return new Set([...schema.tableNames, ...this._tables.keys()]); }
  getParentItem(item, tableName) { return getters.getParentItem(item, tableName, this); }
  removeItemInTable(item, tableName) { removeItems(this, tableName, [item]); }
  removeItemsInTable(items, tableName) { removeItems(this, tableName, items); }
  setIndexedItemsAsTable(indexedItems, tableName) { setIndexedItems(this, tableName, indexedItems); }

  /* agency.txt */
  addAgency(agency) { addItems(this, 'agency', [agency]); }
  addAgencies(agencies) { addItems(this, 'agency', agencies); }
  forEachAgency(iterator) { forEachItem(this, 'agency', iterator); }
  getAgencyOfRoute(route) { return getters.getParentItem(route, 'agency', this); }
  getAgencyWithId(agencyId) { return getters.getItemWithIndex(agencyId, 'agency', this); }
  getIndexedAgencies() { return getIndexedTable(this, 'agency'); }
  removeAgency(agency) { removeItems(this, 'agency', [agency]); }
  removeAgencies(agencies) { removeItems(this, 'agency', agencies); }
  setIndexedAgencies(indexedAgencies) { setIndexedItems(this, 'agency', indexedAgencies); }

  /* stops.txt */
  addStop(stop) { addItems(this, 'stops', [stop]); }
  addStops(stops) { addItems(this, 'stops', stops); }
  forEachStop(iterator) { forEachItem(this, 'stops', iterator); }
  getIndexedStops() { return getIndexedTable(this, 'stops'); }
  getStopOfStopTime(stopTime) { return getters.getParentItem(stopTime, 'stops', this); }
  getStopWithId(stopId) { return getters.getItemWithIndex(stopId, 'stops', this); }
  removeStop(stop) { removeItems(this, 'stops', [stop]); }
  removeStops(stops) { removeItems(this, 'stops', stops); }
  setIndexedStops(indexedStops) { setIndexedItems(this, 'stops', indexedStops); }

  /* routes.txt */
  addRoute(route) { addItems(this, 'routes', [route]); }
  addRoutes(routes) { addItems(this, 'routes', routes); }
  forEachRoute(iterator) { forEachItem(this, 'routes', iterator); }
  getIndexedRoutes() { return getIndexedTable(this, 'routes'); }
  getRouteOfStopTime(stopTime) { return getters.getGrandParentItem(stopTime, 'trips', 'routes', this); }
  getRouteOfTrip(trip) { return getters.getParentItem(trip, 'routes', this); }
  getRouteWithId(routeId) { return getters.getItemWithIndex(routeId, 'routes', this); }
  removeRoute(route) { removeItems(this, 'routes', [route]); }
  removeRoutes(routes) { removeItems(this, 'routes', routes); }
  setIndexedRoutes(indexedRoutes) { setIndexedItems(this, 'routes', indexedRoutes); }

  /* trips.txt */
  addTrip(trip) { addItems(this, 'trips', [trip]); }
  addTrips(trips) { addItems(this, 'trips', trips); }
  forEachTrip(iterator) { forEachItem(this, 'trips', iterator); }
  getIndexedTrips() { return getIndexedTable(this, 'trips'); }
  getTripOfStopTime(stopTime) { return getters.getParentItem(stopTime, 'trips', this); }
  getTripWithId(tripId) { return getters.getItemWithIndex(tripId, 'trips', this); }
  removeTrip(trip) { removeItems(this, 'trips', [trip]); }
  removeTrips(trips) { removeItems(this, 'trips', trips); }
  setIndexedTrips(indexedTrips) { setIndexedItems(this, 'trips', indexedTrips); }

  /* stop_times.txt */
  addStopTime(stopTime) { addItems(this, 'stop_times', [stopTime]); }
  addStopTimes(stopTimes) { addItems(this, 'stop_times', stopTimes); }
  forEachStopTime(iterator) { forEachItem(this, 'stop_times', iterator); }
  forEachStopTimeOfTrip(trip, iterator) {
    const stopTimeByStopSequence = this.getStopTimeByStopSequenceOfTrip(trip);
    if (stopTimeByStopSequence instanceof Map) {
      stopTimeByStopSequence.forEach(iterator);
    }
  }
  getIndexedStopTimes() { return getIndexedTable(this, 'stop_times'); }
  getStopTimeByStopSequenceOfTrip(trip) { return getters.getIndexedItemsWithParent(trip, 'stop_times', this); }
  getStopTimeWithTripIdAndStopSequence(tripId, stopSequence) {
    return getters.getItemWithIndexes(tripId, stopSequence, 'stop_times', this);
  }
  removeStopTime(stopTime) { removeItems(this, 'stop_times', [stopTime]); }
  removeStopTimes(stopTimes) { removeItems(this, 'stop_times', stopTimes); }
  setIndexedStopTimes(indexedStopTimes) { setIndexedItems(this, 'stop_times', indexedStopTimes); }

  /* calendar.txt */
  addCalendar(calendar) { addItems(this, 'calendar', [calendar]); }
  addCalendars(calendars) { addItems(this, 'calendar', calendars); }
  forEachCalendar(iterator) { forEachItem(this, 'calendar', iterator); }
  getCalendarOfTrip(trip) { return getters.getParentItem(trip, 'calendar', this); }
  getCalendarOfStopTime(stopTime) {
    return getters.getGrandParentItem(stopTime, 'trips', 'calendar', this);
  }
  getCalendarWithServiceId(serviceId) { return getters.getItemWithIndex(serviceId, 'calendar', this); }
  getIndexedCalendars() { return getIndexedTable(this, 'calendar'); }
  removeCalendar(calendar) { removeItems(this, 'calendar', [calendar]); }
  removeCalendars(calendars) { removeItems(this, 'calendar', calendars); }
  setIndexedCalendars(indexedCalendars) { setIndexedItems(this, 'calendar', indexedCalendars); }

  /* calendar_dates.txt */
  addCalendarDate(calendarDate) { addItems(this, 'calendar_dates', [calendarDate]); }
  addCalendarDates(calendarDates) { addItems(this, 'calendar_dates', calendarDates); }
  forEachCalendarDate(iterator) { forEachItem(this, 'calendar_dates', iterator); }
  getCalendarDateByDateOfServiceId(serviceId) {
    return getters.getIndexedItemsWithParentIndex(serviceId, 'calendar_dates', this);
  }
  getCalendarDateByDateOfTrip(trip) { return getters.getIndexedItemsWithParent(trip, 'calendar_dates', this); }
  getCalendarDateWithServiceIdAndDate(serviceId, date) {
    return getters.getItemWithIndexes(serviceId, date, 'calendar_dates', this);
  }
  getIndexedCalendarDates() { return getIndexedTable(this, 'calendar_dates'); }
  removeCalendarDate(calendarDate) { removeItems(this, 'calendar_dates', [calendarDate]); }
  removeCalendarDates(calendarDates) { removeItems(this, 'calendar_dates', calendarDates); }
  setIndexedCalendarDates(indexedCalendarDates) { setIndexedItems(this, 'calendar_dates', indexedCalendarDates); }

  /* fare_attributes.txt */
  // Not used, therefore not implemented

  /* fare_rules.txt */
  // Not used, therefore not implemented

  /* shapes.txt */
  addShapePoint(shapePoint) { addItems(this, 'shapes', [shapePoint]); }
  addShapePoints(shapePoints) { addItems(this, 'shapes', shapePoints); }
  forEachShapePoint(iterator) { forEachItem(this, 'shapes', iterator); }
  getIndexedShapePoints() { return getIndexedTable(this, 'shapes'); }
  getShapePointByShapePointSequenceOfShapeId(shapeId) {
    return getters.getIndexedItemsWithParentIndex(shapeId, 'shapes', this);
  }
  getShapePointByShapePointSequenceOfTrip(trip) { return getters.getIndexedItemsWithParent(trip, 'shapes', this); }
  getShapePointWithTripIdAndShapePointSequence(tripId, shapePointSequence) {
    return getters.getItemWithIndexes(tripId, shapePointSequence, 'shapes', this);
  }
  removeShapePoint(shapePoint) { removeItems(this, 'shapes', [shapePoint]); }
  removeShapePoints(shapePoints) { removeItems(this, 'shapes', shapePoints); }
  setIndexedShapePoints(indexedShapes) { setIndexedItems(this, 'shapes', indexedShapes); }

  /* frequencies.txt */
  addFrequency(frequency) { addItems(this, 'frequencies', [frequency]); }
  addFrequencies(frequencies) { addItems(this, 'frequencies', frequencies); }
  forEachFrequency(iterator) { forEachItem(this, 'frequencies', iterator); }
  getIndexedFrequencies() { return getIndexedTable(this, 'frequencies'); }
  getFrequencyWithTripIdAndStartTime(tripId, startTime) {
    return getters.getItemWithIndexes(tripId, startTime, 'frequencies', this);
  }
  removeFrequency(frequency) { removeItems(this, 'frequencies', [frequency]); }
  removeFrequencies(frequencies) { removeItems(this, 'frequencies', frequencies); }
  setIndexedFrequencies(indexedFrequencies) { setIndexedItems(this, 'frequencies', indexedFrequencies); }

  /* transfers.txt */
  addTransfer(transfer) { addItems(this, 'transfers', [transfer]); }
  addTransfers(transfers) { addItems(this, 'transfers', transfers); }
  forEachTransfer(iterator) { forEachItem(this, 'transfers', iterator); }
  getIndexedTransfers() { return getIndexedTable(this, 'transfers'); }
  getTransfertWithFromStopIdAndToStopId(fromStopId, toStopId) {
    return getters.getItemWithIndexes(fromStopId, toStopId, 'transfers', this);
  }
  removeTransfer(transfer) { removeItems(this, 'transfers', [transfer]); }
  removeTransfers(transfers) { removeItems(this, 'transfers', transfers); }
  setIndexedTransfers(indexedTransfers) { setIndexedItems(this, 'transfers', indexedTransfers); }

  /* feed_info.txt */
  getFeedInfo() { return getIndexedTable(this, 'feed_info'); }
  setFeedInfo(feedInfo) { setIndexedItems(this, 'feed_info', feedInfo); }
}

module.exports = Gtfs;
