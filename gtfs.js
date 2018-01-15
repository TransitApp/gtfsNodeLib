'use strict';

/* eslint-disable no-underscore-dangle */

const infoLog = require('debug')('gtfsNodeLib:i');
const fs = require('fs-extra');

const forEachWithLog = require('./helpers/logging_iterator_wrapper');
const { exportGtfs } = require('./helpers/export');
const getters = require('./helpers/getters');
const { importTable } = require('./helpers/import');
const schema = require('./helpers/schema');

function addItems(items, tableName, gtfs) {
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

function getIndexedTableOfGtfs(tableName, gtfs, options) {
  if (gtfs._tables.has(tableName) === false) {
    importTable(gtfs, tableName, options);
    infoLog(`[Importation] Table ${tableName} has been imported.`);
  }

  return gtfs._tables.get(tableName);
}

function forEachItem(iterator, tableName, gtfs) {
  if (typeof iterator !== 'function') {
    throw new Error(`iterator mulst be a function, instead of a ${typeof iterator}.`);
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

function removeItems(items, tableName, gtfs) {
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

function setIndexedItems(indexedItems, tableName, gtfs) {
  if (indexedItems instanceof Map === false && schema.deepnessByTableName[tableName] !== 0) {
    throw new Error(`indexedItems must be a Map instead of: ${indexedItems}`);
  }

  gtfs._tables.set(tableName, indexedItems);
}

class Gtfs {
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
  exportAtPath(path, callback) { exportGtfs(this, path, callback); }
  getPath() { return this._path; }

  /* Generic table & item manipulation */
  addItemInTable(item, tableName) { addItems([item], tableName, this); }
  addItemsInTable(items, tableName) { addItems(items, tableName, this); }
  forEachItemInTable(tableName, iterator) { forEachItem(iterator, tableName, this); }
  forEachTableName(iterator) { this.getTableNames().forEach(iterator); }
  getIndexedTable(tableName, forcedValuesByKeys) { return getIndexedTableOfGtfs(tableName, this, forcedValuesByKeys); }
  getItemWithIndexInTable(index, tableName) { return getters.getItemWithIndex(index, tableName, this); }
  getTableNames() { return new Set([...schema.tableNames, ...this._tables.keys()]); }
  getParentItem(item, tableName) { return getters.getParentItem(item, tableName, this); }
  removeItemInTable(item, tableName) { removeItems([item], tableName, this); }
  removeItemsInTable(items, tableName) { removeItems(items, tableName, this); }
  setIndexedItemsAsTable(indexedItems, tableName) { setIndexedItems(indexedItems, tableName, this); }

  /* agency.txt */
  addAgency(agency) { addItems([agency], 'agency', this); }
  addAgencies(agencies) { addItems(agencies, 'agency', this); }
  forEachAgency(iterator) { forEachItem(iterator, 'agency', this); }
  getAgencyOfRoute(route) { return getters.getParentItem(route, 'agency', this); }
  getAgencyWithId(agencyId) { return getters.getItemWithIndex(agencyId, 'agency', this); }
  getIndexedAgencies() { return getIndexedTableOfGtfs('agency', this); }
  removeAgency(agency) { removeItems([agency], 'agency', this); }
  removeAgencies(agencies) { removeItems(agencies, 'agency', this); }
  setIndexedAgencies(indexedAgencies) { setIndexedItems(indexedAgencies, 'agency', this); }

  /* stops.txt */
  addStop(stop) { addItems([stop], 'stops', this); }
  addStops(stops) { addItems(stops, 'stops', this); }
  forEachStop(iterator) { forEachItem(iterator, 'stops', this); }
  getIndexedStops() { return getIndexedTableOfGtfs('stops', this); }
  getStopOfStopTime(stopTime) { return getters.getParentItem(stopTime, 'stops', this); }
  getStopWithId(stopId) { return getters.getItemWithIndex(stopId, 'stops', this); }
  removeStop(stop) { removeItems([stop], 'stops', this); }
  removeStops(stops) { removeItems(stops, 'stops', this); }
  setIndexedStops(indexedStops) { setIndexedItems(indexedStops, 'stops', this); }

  /* routes.txt */
  addRoute(route) { addItems([route], 'routes', this); }
  addRoutes(routes) { addItems(routes, 'routes', this); }
  forEachRoute(iterator) { forEachItem(iterator, 'routes', this); }
  getIndexedRoutes() { return getIndexedTableOfGtfs('routes', this); }
  getRouteOfStopTime(stopTime) { return getters.getGrandParentItem(stopTime, 'trips', 'routes', this); }
  getRouteOfTrip(trip) { return getters.getParentItem(trip, 'routes', this); }
  getRouteWithId(routeId) { return getters.getItemWithIndex(routeId, 'routes', this); }
  removeRoute(route) { removeItems([route], 'routes', this); }
  removeRoutes(routes) { removeItems(routes, 'routes', this); }
  setIndexedRoutes(indexedRoutes) { setIndexedItems(indexedRoutes, 'routes', this); }

  /* trips.txt */
  addTrip(trip) { addItems([trip], 'trips', this); }
  addTrips(trips) { addItems(trips, 'trips', this); }
  forEachTrip(iterator) { forEachItem(iterator, 'trips', this); }
  getIndexedTrips() { return getIndexedTableOfGtfs('trips', this); }
  getTripOfStopTime(stopTime) { return getters.getParentItem(stopTime, 'trips', this); }
  getTripWithId(tripId) { return getters.getItemWithIndex(tripId, 'trips', this); }
  removeTrip(trip) { removeItems([trip], 'trips', this); }
  removeTrips(trips) { removeItems(trips, 'trips', this); }
  setIndexedTrips(indexedTrips) { setIndexedItems(indexedTrips, 'trips', this); }

  /* stop_times.txt */
  addStopTime(stopTime) { addItems([stopTime], 'stop_times', this); }
  addStopTimes(stopTimes) { addItems(stopTimes, 'stop_times', this); }
  forEachStopTime(iterator) { forEachItem(iterator, 'stop_times', this); }
  forEachStopTimeOfTrip(trip, iterator) {
    const stopTimeByStopSequence = this.getStopTimeByStopSequenceOfTrip(trip);
    if (stopTimeByStopSequence instanceof Map) {
      stopTimeByStopSequence.forEach(iterator);
    }
  }
  getIndexedStopTimes() { return getIndexedTableOfGtfs('stop_times', this); }
  getStopTimeByStopSequenceOfTrip(trip) { return getters.getIndexedItemsWithParent(trip, 'stop_times', this); }
  getStopTimeWithTripIdAndStopSequence(tripId, stopSequence) {
    return getters.getItemWithIndexes(tripId, stopSequence, 'stop_times', this);
  }
  removeStopTime(stopTime) { removeItems([stopTime], 'stop_times', this); }
  removeStopTimes(stopTimes) { removeItems(stopTimes, 'stop_times', this); }
  setIndexedStopTimes(indexedStopTimes) { setIndexedItems(indexedStopTimes, 'stop_times', this); }

  /* calendar.txt */
  addCalendar(calendar) { addItems([calendar], 'calendar', this); }
  addCalendars(calendars) { addItems(calendars, 'calendar', this); }
  forEachCalendar(iterator) { forEachItem(iterator, 'calendar', this); }
  getCalendarOfTrip(trip) { return getters.getParentItem(trip, 'calendar', this); }
  getCalendarOfStopTime(stopTime) {
    return getters.getGrandParentItem(stopTime, 'trips', 'calendar', this);
  }
  getCalendarWithServiceId(serviceId) { return getters.getItemWithIndex(serviceId, 'calendar', this); }
  getIndexedCalendars() { return getIndexedTableOfGtfs('calendar', this); }
  removeCalendar(calendar) { removeItems([calendar], 'calendar', this); }
  removeCalendars(calendars) { removeItems(calendars, 'calendar', this); }
  setIndexedCalendars(indexedCalendars) { setIndexedItems(indexedCalendars, 'calendar', this); }

  /* calendar_dates.txt */
  addCalendarDate(calendarDate) { addItems([calendarDate], 'calendar_dates', this); }
  addCalendarDates(calendarDates) { addItems(calendarDates, 'calendar_dates', this); }
  forEachCalendarDate(iterator) { forEachItem(iterator, 'calendar_dates', this); }
  getCalendarDateByDateOfServiceId(serviceId) {
    return getters.getIndexedItemsWithParentIndex(serviceId, 'calendar_dates', this);
  }
  getCalendarDateByDateOfTrip(trip) { return getters.getIndexedItemsWithParent(trip, 'calendar_dates', this); }
  getCalendarDateWithServiceIdAndDate(serviceId, date) {
    return getters.getItemWithIndexes(serviceId, date, 'calendar_dates', this);
  }
  getIndexedCalendarDates() { return getIndexedTableOfGtfs('calendar_dates', this); }
  removeCalendarDate(calendarDate) { removeItems([calendarDate], 'calendar_dates', this); }
  removeCalendarDates(calendarDates) { removeItems(calendarDates, 'calendar_dates', this); }
  setIndexedCalendarDates(indexedCalendarDates) { setIndexedItems(indexedCalendarDates, 'calendar_dates', this); }

  /* fare_attributes.txt */
  // Not used, therefore not implemented

  /* fare_rules.txt */
  // Not used, therefore not implemented

  /* shapes.txt */
  addShapePoint(shapePoint) { addItems([shapePoint], 'shapes', this); }
  addShapePoints(shapePoints) { addItems(shapePoints, 'shapes', this); }
  forEachShapePoint(iterator) { forEachItem(iterator, 'shapes', this); }
  getIndexedShapePoints() { return getIndexedTableOfGtfs('shapes', this); }
  getShapePointByShapePointSequenceOfShapeId(shapeId) {
    return getters.getIndexedItemsWithParentIndex(shapeId, 'shapes', this);
  }
  getShapePointByShapePointSequenceOfTrip(trip) { return getters.getIndexedItemsWithParent(trip, 'shapes', this); }
  getShapePointWithTripIdAndShapePointSequence(tripId, shapePointSequence) {
    return getters.getItemWithIndexes(tripId, shapePointSequence, 'shapes', this);
  }
  removeShapePoint(shapePoint) { removeItems([shapePoint], 'shapes', this); }
  removeShapePoints(shapePoints) { removeItems(shapePoints, 'shapes', this); }
  setIndexedShapePoints(indexedShapes) { setIndexedItems(indexedShapes, 'shapes', this); }

  /* frequencies.txt */
  addFrequency(frequency) { addItems([frequency], 'frequencies', this); }
  addFrequencies(frequencies) { addItems(frequencies, 'frequencies', this); }
  forEachFrequency(iterator) { forEachItem(iterator, 'frequencies', this); }
  getIndexedFrequencies() { return getIndexedTableOfGtfs('frequencies', this); }
  getFrequencyWithTripIdAndStartTime(tripId, startTime) {
    return getters.getItemWithIndexes(tripId, startTime, 'frequencies', this);
  }
  removeFrequency(frequency) { removeItems([frequency], 'frequencies', this); }
  removeFrequencies(frequencies) { removeItems(frequencies, 'frequencies', this); }
  setIndexedFrequencies(indexedFrequencies) { setIndexedItems(indexedFrequencies, 'frequencies', this); }

  /* transfers.txt */
  addTransfer(transfer) { addItems([transfer], 'transfers', this); }
  addTransfers(transfers) { addItems(transfers, 'transfers', this); }
  forEachTransfer(iterator) { forEachItem(iterator, 'transfers', this); }
  getIndexedTransfers() { return getIndexedTableOfGtfs('transfers', this); }
  getTransferWithFromStopIdAndToStopId(fromStopId, toStopId) {
    return getters.getItemWithIndexes(fromStopId, toStopId, 'transfers', this);
  }
  removeTransfer(transfer) { removeItems([transfer], 'transfers', this); }
  removeTransfers(transfers) { removeItems(transfers, 'transfers', this); }
  setIndexedTransfers(indexedTransfers) { setIndexedItems(indexedTransfers, 'transfers', this); }

  /* feed_info.txt */
  getFeedInfo() { return getIndexedTableOfGtfs('feed_info', this); }
  setFeedInfo(feedInfo) { setIndexedItems(feedInfo, 'feed_info', this); }
}

module.exports = Gtfs;
