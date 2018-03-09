'use strict';

/* Run the tests with mocha: mocha tests.js */

// eslint-disable-next-line import/no-extraneous-dependencies
const { expect } = require('chai');
const fs = require('fs-extra');

const { Gtfs } = require('./index');

describe('Tests on GTFS', () => {
  it('Test on meta functions', (done) => {
    const path = `${__dirname}/samples/1/`;
    const gtfs = new Gtfs(path);

    expect(gtfs.isGtfs).to.equal(true);
    expect(gtfs.getPath()).to.equal(path);

    done();
  });

  it('Test on generic table functions', (done) => {
    const path = `${__dirname}/samples/1/`;
    const gtfs = new Gtfs(path);

    const indexedAgencies = gtfs.getIndexedTable('agency');
    expect(indexedAgencies.get('agency_0').agency_name).to.equal('Agency 0');

    const agency0 = gtfs.getItemWithIndexInTable('agency_0', 'agency');
    expect(agency0.agency_name).to.equal('Agency 0');

    const expectedTableNames = [
      'agency', 'calendar', 'calendar_dates', 'fare_attributes', 'frequencies',
      'routes', 'stop_times', 'stops', 'trips', 'shapes', 'transfers', 'feed_info',
    ];
    expect(Array.from(gtfs.getTableNames())).to.deep.equal(expectedTableNames);

    const tableNames = [];
    gtfs.forEachTableName((tableName) => {
      tableNames.push(tableName);
    });
    expect(tableNames).to.deep.equal(expectedTableNames);

    const ROUTE_TABLE_NAME = 'routes';
    const route0 = gtfs.getRouteWithId('route_0');

    gtfs.addItemInTable({ route_id: 'route_1', route_long_name: 'Route 1' }, ROUTE_TABLE_NAME);
    expect(sortedKeys(gtfs.getIndexedRoutes())).to.deep.equal(['route_0', 'route_1']);

    gtfs.addItemsInTable([
      { route_id: 'route_2', route_long_name: 'Route 2' },
      { route_id: 'route_3', route_long_name: 'Route 3' },
    ], ROUTE_TABLE_NAME);
    expect(sortedKeys(gtfs.getIndexedRoutes())).to.deep.equal(['route_0', 'route_1', 'route_2', 'route_3']);

    gtfs.removeItemInTable(gtfs.getRouteWithId('route_2'), ROUTE_TABLE_NAME);
    expect(sortedKeys(gtfs.getIndexedRoutes())).to.deep.equal(['route_0', 'route_1', 'route_3']);

    gtfs.removeItemsInTable([gtfs.getRouteWithId('route_0'), gtfs.getRouteWithId('route_3')], ROUTE_TABLE_NAME);
    expect(sortedKeys(gtfs.getIndexedRoutes())).to.deep.equal(['route_1']);

    gtfs.setIndexedItemsAsTable(new Map([['route_0', route0]]), ROUTE_TABLE_NAME);
    expect(sortedKeys(gtfs.getIndexedRoutes())).to.deep.equal(['route_0']);

    const routeIds = [];
    gtfs.forEachItemInTable(ROUTE_TABLE_NAME, (route) => {
      routeIds.push(route.route_id);
    });
    expect(routeIds).to.deep.equal(['route_0']);

    const trip0 = gtfs.getTripWithId('trip_0');
    const routeOfTrip0 = gtfs.getParentItem(trip0, ROUTE_TABLE_NAME);
    expect(routeOfTrip0.route_long_name).to.equal('Route 0');

    done();
  });

  it('Tests on agencies', (done) => {
    const path = `${__dirname}/samples/1`;
    const gtfs = new Gtfs(path);

    expect(sortedKeys(gtfs.getIndexedAgencies())).to.deep.equal(['agency_0']);

    const agency0 = gtfs.getAgencyWithId('agency_0');
    expect(agency0.agency_name).to.equal('Agency 0');

    gtfs.addAgency({ agency_id: 'agency_1', agency_name: 'Agency 1' });
    expect(sortedKeys(gtfs.getIndexedAgencies())).to.deep.equal(['agency_0', 'agency_1']);

    gtfs.addAgencies([
      { agency_id: 'agency_2', agency_name: 'Agency 2' },
      { agency_id: 'agency_3', agency_name: 'Agency 3' },
    ]);
    expect(sortedKeys(gtfs.getIndexedAgencies())).to.deep.equal(['agency_0', 'agency_1', 'agency_2', 'agency_3']);

    gtfs.removeAgency(gtfs.getAgencyWithId('agency_2'));
    expect(sortedKeys(gtfs.getIndexedAgencies())).to.deep.equal(['agency_0', 'agency_1', 'agency_3']);

    gtfs.removeAgencies([gtfs.getAgencyWithId('agency_0'), gtfs.getAgencyWithId('agency_3')]);
    expect(sortedKeys(gtfs.getIndexedAgencies())).to.deep.equal(['agency_1']);

    gtfs.setIndexedAgencies(new Map([['agency_0', agency0]]));
    expect(sortedKeys(gtfs.getIndexedAgencies())).to.deep.equal(['agency_0']);

    const agencyIds = [];
    gtfs.forEachAgency((agency) => {
      agencyIds.push(agency.agency_id);
    });
    expect(agencyIds).to.deep.equal(['agency_0']);

    const route0 = gtfs.getRouteWithId('route_0');
    const agencyOfRoute0 = gtfs.getAgencyOfRoute(route0);
    expect(agencyOfRoute0.agency_name).to.deep.equal('Agency 0');

    done();
  });

  it('Tests on stops', (done) => {
    const path = `${__dirname}/samples/1`;
    const gtfs = new Gtfs(path);

    expect(sortedKeys(gtfs.getIndexedStops())).to.deep.equal(['stop_0', 'stop_1']);

    const stop0 = gtfs.getStopWithId('stop_0');
    const stop1 = gtfs.getStopWithId('stop_1');
    expect(stop0.stop_name).to.equal('Stop 0');
    expect(stop1.stop_name).to.equal('Stop 1');

    gtfs.addStop({ stop_id: 'stop_2', stop_name: 'Stop 2' });
    expect(sortedKeys(gtfs.getIndexedStops())).to.deep.equal(['stop_0', 'stop_1', 'stop_2']);

    gtfs.addStops([
      { stop_id: 'stop_3', stop_name: 'Stop 3' },
      { stop_id: 'stop_4', stop_name: 'Stop 4' },
    ]);
    expect(sortedKeys(gtfs.getIndexedStops())).to.deep.equal(['stop_0', 'stop_1', 'stop_2', 'stop_3', 'stop_4']);

    gtfs.removeStop(gtfs.getStopWithId('stop_2'));
    expect(sortedKeys(gtfs.getIndexedStops())).to.deep.equal(['stop_0', 'stop_1', 'stop_3', 'stop_4']);

    gtfs.removeStops([gtfs.getStopWithId('stop_1'), gtfs.getStopWithId('stop_3')]);
    expect(sortedKeys(gtfs.getIndexedStops())).to.deep.equal(['stop_0', 'stop_4']);

    gtfs.setIndexedStops(new Map([['stop_0', stop0], ['stop_1', stop1]]));
    expect(sortedKeys(gtfs.getIndexedStops())).to.deep.equal(['stop_0', 'stop_1']);

    const stopIds = [];
    gtfs.forEachStop((stop) => {
      stopIds.push(stop.stop_id);
    });
    expect(stopIds.sort()).to.deep.equal(['stop_0', 'stop_1']);

    const stopTime00 = gtfs.getStopTimeWithTripIdAndStopSequence('trip_0', '0');
    const stopOfStopTime00 = gtfs.getStopOfStopTime(stopTime00);
    expect(stopOfStopTime00.stop_name).to.equal('Stop 0');

    done();
  });

  it('Tests on routes', (done) => {
    const path = `${__dirname}/samples/1`;
    const gtfs = new Gtfs(path);

    expect(sortedKeys(gtfs.getIndexedRoutes())).to.deep.equal(['route_0']);

    const route0 = gtfs.getRouteWithId('route_0');
    expect(route0.route_long_name).to.equal('Route 0');

    gtfs.addRoute({ route_id: 'route_1', route_long_name: 'Route 1' });
    expect(sortedKeys(gtfs.getIndexedRoutes())).to.deep.equal(['route_0', 'route_1']);

    gtfs.addRoutes([
      { route_id: 'route_2', route_long_name: 'Route 2' },
      { route_id: 'route_3', route_long_name: 'Route 3' },
    ]);
    expect(sortedKeys(gtfs.getIndexedRoutes())).to.deep.equal(['route_0', 'route_1', 'route_2', 'route_3']);

    gtfs.removeRoute(gtfs.getRouteWithId('route_2'));
    expect(sortedKeys(gtfs.getIndexedRoutes())).to.deep.equal(['route_0', 'route_1', 'route_3']);

    gtfs.removeRoutes([gtfs.getRouteWithId('route_0'), gtfs.getRouteWithId('route_3')]);
    expect(sortedKeys(gtfs.getIndexedRoutes())).to.deep.equal(['route_1']);

    gtfs.setIndexedRoutes(new Map([['route_0', route0]]));
    expect(sortedKeys(gtfs.getIndexedRoutes())).to.deep.equal(['route_0']);

    const routeIds = [];
    gtfs.forEachRoute((route) => {
      routeIds.push(route.route_id);
    });
    expect(routeIds).to.deep.equal(['route_0']);

    const trip0 = gtfs.getTripWithId('trip_0');
    const routeOfTrip0 = gtfs.getRouteOfTrip(trip0);
    expect(routeOfTrip0.route_long_name).to.equal('Route 0');

    const stopTime00 = gtfs.getStopTimeWithTripIdAndStopSequence('trip_0', '0');
    const routeOfStopTime00 = gtfs.getRouteOfStopTime(stopTime00);
    expect(routeOfStopTime00.route_long_name).to.equal('Route 0');

    done();
  });

  it('Tests on trips', (done) => {
    const path = `${__dirname}/samples/1`;
    const gtfs = new Gtfs(path);

    expect(sortedKeys(gtfs.getIndexedTrips())).to.deep.equal(['trip_0']);

    const trip0 = gtfs.getTripWithId('trip_0');
    expect(trip0.trip_headsign).to.equal('Trip 0');

    gtfs.addTrip({ trip_id: 'trip_1', trip_headsign: 'Trip 1' });
    expect(sortedKeys(gtfs.getIndexedTrips())).to.deep.equal(['trip_0', 'trip_1']);

    gtfs.addTrips([
      { trip_id: 'trip_2', trip_headsign: 'Trip 2' },
      { trip_id: 'trip_3', trip_headsign: 'Trip 3' },
    ]);
    expect(sortedKeys(gtfs.getIndexedTrips())).to.deep.equal(['trip_0', 'trip_1', 'trip_2', 'trip_3']);

    gtfs.removeTrip(gtfs.getTripWithId('trip_2'));
    expect(sortedKeys(gtfs.getIndexedTrips())).to.deep.equal(['trip_0', 'trip_1', 'trip_3']);

    gtfs.removeTrips([gtfs.getTripWithId('trip_0'), gtfs.getTripWithId('trip_3')]);
    expect(sortedKeys(gtfs.getIndexedTrips())).to.deep.equal(['trip_1']);

    gtfs.setIndexedTrips(new Map([['trip_0', trip0]]));
    expect(sortedKeys(gtfs.getIndexedTrips())).to.deep.equal(['trip_0']);

    const tripIds = [];
    gtfs.forEachTrip((trip) => {
      tripIds.push(trip.trip_id);
    });
    expect(tripIds).to.deep.equal(['trip_0']);

    const stopTime00 = gtfs.getStopTimeWithTripIdAndStopSequence('trip_0', '0');
    const tripOfStopTime00 = gtfs.getTripOfStopTime(stopTime00);
    expect(tripOfStopTime00.trip_headsign).to.equal('Trip 0');

    done();
  });

  it('Tests on stop times', (done) => {
    const path = `${__dirname}/samples/1`;
    const gtfs = new Gtfs(path);

    expect(sortedKeys(gtfs.getIndexedStopTimes())).to.deep.equal(['trip_0']);

    const trip0 = gtfs.getTripWithId('trip_0');
    expect(sortedKeys(gtfs.getStopTimeByStopSequenceOfTrip(trip0))).to.deep.equal(['0', '1']);

    const stopTime0 = gtfs.getStopTimeWithTripIdAndStopSequence('trip_0', '0');
    const stopTime1 = gtfs.getStopTimeWithTripIdAndStopSequence('trip_0', '1');
    expect(stopTime0.stop_headsign).to.equal('Stop Headsign 0');
    expect(stopTime1.stop_headsign).to.equal('Stop Headsign 1');

    gtfs.addStopTime({ trip_id: 'trip_0', stop_id: 'stop_0', stop_sequence: '2', stop_headsign: 'Stop Headsign 2' });
    expect(sortedKeys(gtfs.getStopTimeByStopSequenceOfTrip(trip0))).to.deep.equal(['0', '1', '2']);

    gtfs.addStopTimes([
      { trip_id: 'trip_0', stop_id: 'stop_1', stop_sequence: '3', stop_headsign: 'Stop Headsign 3' },
      { trip_id: 'trip_0', stop_id: 'stop_0', stop_sequence: '4', stop_headsign: 'Stop Headsign 4' },
    ]);
    expect(sortedKeys(gtfs.getStopTimeByStopSequenceOfTrip(trip0))).to.deep.equal(['0', '1', '2', '3', '4']);

    gtfs.removeStopTime(gtfs.getStopTimeWithTripIdAndStopSequence('trip_0', '2'));
    expect(sortedKeys(gtfs.getStopTimeByStopSequenceOfTrip(trip0))).to.deep.equal(['0', '1', '3', '4']);

    gtfs.removeStopTimes([
      gtfs.getStopTimeWithTripIdAndStopSequence('trip_0', '0'),
      gtfs.getStopTimeWithTripIdAndStopSequence('trip_0', '3'),
    ]);
    expect(sortedKeys(gtfs.getStopTimeByStopSequenceOfTrip(trip0))).to.deep.equal(['1', '4']);

    gtfs.setIndexedStopTimes(new Map([
      ['trip_0', new Map([
        ['0', { trip_id: 'trip_0', stop_id: 'stop_0', stop_sequence: '0', stop_headsign: 'Stop Headsign 000' }],
        ['1', { trip_id: 'trip_0', stop_id: 'stop_1', stop_sequence: '1', stop_headsign: 'Stop Headsign 011' }],
      ])],
      ['trip_1', new Map([
        ['5', { trip_id: 'trip_1', stop_id: 'stop_1', stop_sequence: '5', stop_headsign: 'Stop Headsign 115' }],
        ['6', { trip_id: 'trip_1', stop_id: 'stop_0', stop_sequence: '6', stop_headsign: 'Stop Headsign 106' }],
      ])],
    ]));
    expect(sortedKeys(gtfs.getIndexedStopTimes())).to.deep.equal(['trip_0', 'trip_1']);
    expect(sortedKeys(gtfs.getStopTimeByStopSequenceOfTrip({ trip_id: 'trip_0' }))).to.deep.equal(['0', '1']);
    expect(sortedKeys(gtfs.getStopTimeByStopSequenceOfTrip({ trip_id: 'trip_1' }))).to.deep.equal(['5', '6']);

    const stopHeadsigns = [];
    gtfs.forEachStopTime((stopTime) => {
      stopHeadsigns.push(stopTime.stop_headsign);
    });
    const expectedStopHeadsigns = ['Stop Headsign 000', 'Stop Headsign 011', 'Stop Headsign 106', 'Stop Headsign 115'];
    expect(stopHeadsigns.sort()).to.deep.equal(expectedStopHeadsigns);

    const stopHeadsignsOfTrip0 = [];
    gtfs.forEachStopTimeOfTrip({ trip_id: 'trip_0' }, (stopTime) => {
      stopHeadsignsOfTrip0.push(stopTime.stop_headsign);
    });
    const expectedStopHeadsignsOfTrip0 = ['Stop Headsign 000', 'Stop Headsign 011'];
    expect(stopHeadsignsOfTrip0.sort()).to.deep.equal(expectedStopHeadsignsOfTrip0);

    done();
  });

  it('Tests on calendars', (done) => {
    const path = `${__dirname}/samples/1`;
    const gtfs = new Gtfs(path);

    expect(sortedKeys(gtfs.getIndexedCalendars())).to.deep.equal(['service_0']);

    const calendar0 = gtfs.getCalendarWithServiceId('service_0');
    expect(calendar0.start_date).to.equal('20000101');

    gtfs.addCalendar({ service_id: 'service_1', start_date: '20010101', end_date: '20010101' });
    expect(sortedKeys(gtfs.getIndexedCalendars())).to.deep.equal(['service_0', 'service_1']);

    gtfs.addCalendars([
      { service_id: 'service_2', start_date: '20020101', end_date: '20020101' },
      { service_id: 'service_3', start_date: '20030101', end_date: '20030101' },
    ]);
    expect(sortedKeys(gtfs.getIndexedCalendars())).to.deep.equal(['service_0', 'service_1', 'service_2', 'service_3']);

    gtfs.removeCalendar(gtfs.getCalendarWithServiceId('service_2'));
    expect(sortedKeys(gtfs.getIndexedCalendars())).to.deep.equal(['service_0', 'service_1', 'service_3']);

    gtfs.removeCalendars([gtfs.getCalendarWithServiceId('service_0'), gtfs.getCalendarWithServiceId('service_3')]);
    expect(sortedKeys(gtfs.getIndexedCalendars())).to.deep.equal(['service_1']);

    gtfs.setIndexedCalendars(new Map([['service_0', calendar0]]));
    expect(sortedKeys(gtfs.getIndexedCalendars())).to.deep.equal(['service_0']);

    const serviceIds = [];
    gtfs.forEachCalendar((calendar) => {
      serviceIds.push(calendar.service_id);
    });
    expect(serviceIds).to.deep.equal(['service_0']);

    const trip0 = gtfs.getTripWithId('trip_0');
    const calendarOfTrip0 = gtfs.getCalendarOfTrip(trip0);
    expect(calendarOfTrip0.start_date).to.equal('20000101');

    const stopTime00 = gtfs.getStopTimeWithTripIdAndStopSequence('trip_0', '0');
    const calendarOfStopTime00 = gtfs.getCalendarOfStopTime(stopTime00);
    expect(calendarOfStopTime00.start_date).to.equal('20000101');

    done();
  });

  it('Tests on calendar dates', (done) => {
    const path = `${__dirname}/samples/1`;
    const gtfs = new Gtfs(path);

    expect(sortedKeys(gtfs.getIndexedCalendarDates())).to.deep.equal(['service_0']);

    const trip0 = gtfs.getTripWithId('trip_0');
    expect(sortedKeys(gtfs.getCalendarDateByDateOfTrip(trip0))).to.deep.equal(['20171228', '20171231']);
    expect(sortedKeys(gtfs.getCalendarDateByDateOfServiceId('service_0'))).to.deep.equal(['20171228', '20171231']);

    const calendarDate28 = gtfs.getCalendarDateWithServiceIdAndDate('service_0', '20171228');
    const calendarDate31 = gtfs.getCalendarDateWithServiceIdAndDate('service_0', '20171231');
    expect(calendarDate28.exception_type).to.equal('1');
    expect(calendarDate31.exception_type).to.equal('2');

    gtfs.addCalendarDate({ service_id: 'service_0', date: '20180101', exception_type: '2' });
    expect(sortedKeys(gtfs.getCalendarDateByDateOfTrip(trip0))).to.deep.equal(['20171228', '20171231', '20180101']);

    gtfs.addCalendarDates([
      { service_id: 'service_0', date: '20180102', exception_type: '1' },
      { service_id: 'service_0', date: '20180103', exception_type: '1' },
    ]);
    const expectedDates1 = ['20171228', '20171231', '20180101', '20180102', '20180103'];
    expect(sortedKeys(gtfs.getCalendarDateByDateOfTrip(trip0))).to.deep.equal(expectedDates1);

    gtfs.removeCalendarDate(gtfs.getCalendarDateWithServiceIdAndDate('service_0', '20180101'));
    const expectedDates2 = ['20171228', '20171231', '20180102', '20180103'];
    expect(sortedKeys(gtfs.getCalendarDateByDateOfTrip(trip0))).to.deep.equal(expectedDates2);

    gtfs.removeCalendarDates([
      gtfs.getCalendarDateWithServiceIdAndDate('service_0', '20171228'),
      gtfs.getCalendarDateWithServiceIdAndDate('service_0', '20180102'),
    ]);
    expect(sortedKeys(gtfs.getCalendarDateByDateOfTrip(trip0))).to.deep.equal(['20171231', '20180103']);

    gtfs.setIndexedCalendarDates(new Map([
      ['service_0', new Map([
        ['20171228', { trip_id: 'service_0', date: '20171228', exception_type: '1' }],
        ['20171231', { trip_id: 'service_0', date: '20171231', exception_type: '2' }],
      ])],
      ['service_1', new Map([
        ['20180101', { trip_id: 'service_1', date: '20180101', exception_type: '2' }],
        ['20180102', { trip_id: 'service_1', date: '20180102', exception_type: '1' }],
      ])],
    ]));
    expect(sortedKeys(gtfs.getIndexedCalendarDates())).to.deep.equal(['service_0', 'service_1']);
    const expectedDates3 = ['20171228', '20171231'];
    expect(sortedKeys(gtfs.getCalendarDateByDateOfTrip({ service_id: 'service_0' }))).to.deep.equal(expectedDates3);
    const expectedDates4 = ['20180101', '20180102'];
    expect(sortedKeys(gtfs.getCalendarDateByDateOfTrip({ service_id: 'service_1' }))).to.deep.equal(expectedDates4);

    const exceptionsTypes = [];
    gtfs.forEachCalendarDate((calendarDate) => {
      exceptionsTypes.push(calendarDate.exception_type);
    });
    expect(exceptionsTypes.sort()).to.deep.equal(['1', '1', '2', '2']);

    done();
  });

  it('Tests on shapes', (done) => {
    const path = `${__dirname}/samples/1`;
    const gtfs = new Gtfs(path);

    expect(sortedKeys(gtfs.getIndexedShapePoints())).to.deep.equal(['shape_0']);

    const trip0 = gtfs.getTripWithId('trip_0');
    expect(sortedKeys(gtfs.getShapePointByShapePointSequenceOfTrip(trip0))).to.deep.equal(['1', '2']);
    expect(sortedKeys(gtfs.getShapePointByShapePointSequenceOfShapeId('shape_0'))).to.deep.equal(['1', '2']);

    const shapePoint1 = gtfs.getShapePointWithTripIdAndShapePointSequence('shape_0', '1');
    const shapePoint2 = gtfs.getShapePointWithTripIdAndShapePointSequence('shape_0', '2');
    expect(shapePoint1.shape_dist_traveled).to.equal('0');
    expect(shapePoint2.shape_dist_traveled).to.equal('10');

    gtfs.addShapePoint({ shape_id: 'shape_0', shape_pt_sequence: '3', shape_dist_traveled: '100' });
    expect(sortedKeys(gtfs.getShapePointByShapePointSequenceOfTrip(trip0))).to.deep.equal(['1', '2', '3']);

    gtfs.addShapePoints([
      { shape_id: 'shape_0', shape_pt_sequence: '4', shape_dist_traveled: '1000' },
      { shape_id: 'shape_0', shape_pt_sequence: '5', shape_dist_traveled: '10000' },
    ]);
    expect(sortedKeys(gtfs.getShapePointByShapePointSequenceOfTrip(trip0))).to.deep.equal(['1', '2', '3', '4', '5']);

    gtfs.removeShapePoint(gtfs.getShapePointWithTripIdAndShapePointSequence('shape_0', '3'));
    expect(sortedKeys(gtfs.getShapePointByShapePointSequenceOfTrip(trip0))).to.deep.equal(['1', '2', '4', '5']);

    gtfs.removeShapePoints([
      gtfs.getShapePointWithTripIdAndShapePointSequence('shape_0', '2'),
      gtfs.getShapePointWithTripIdAndShapePointSequence('shape_0', '5'),
    ]);
    expect(sortedKeys(gtfs.getShapePointByShapePointSequenceOfTrip(trip0))).to.deep.equal(['1', '4']);

    gtfs.setIndexedShapePoints(new Map([
      ['shape_0', new Map([
        ['1', { shape_id: 'shape_0', shape_pt_sequence: '1', shape_dist_traveled: '0' }],
        ['2', { shape_id: 'shape_0', shape_pt_sequence: '2', shape_dist_traveled: '20' }],
      ])],
      ['shape_1', new Map([
        ['6', { shape_id: 'shape_1', shape_pt_sequence: '6', shape_dist_traveled: '0' }],
        ['7', { shape_id: 'shape_1', shape_pt_sequence: '7', shape_dist_traveled: '21' }],
      ])],
    ]));
    expect(sortedKeys(gtfs.getIndexedShapePoints())).to.deep.equal(['shape_0', 'shape_1']);
    expect(sortedKeys(gtfs.getShapePointByShapePointSequenceOfTrip({ shape_id: 'shape_0' }))).to.deep.equal(['1', '2']);
    expect(sortedKeys(gtfs.getShapePointByShapePointSequenceOfTrip({ shape_id: 'shape_1' }))).to.deep.equal(['6', '7']);

    const shapeDistanceTraveled = [];
    gtfs.forEachShapePoint((shapePoint) => {
      shapeDistanceTraveled.push(shapePoint.shape_dist_traveled);
    });
    expect(shapeDistanceTraveled.sort()).to.deep.equal(['0', '0', '20', '21']);

    done();
  });

  it('Tests on frequencies', (done) => {
    const path = `${__dirname}/samples/1`;
    const gtfs = new Gtfs(path);

    expect(sortedKeys(gtfs.getIndexedFrequencies())).to.deep.equal(['trip_0']);

    const frequency010h = gtfs.getFrequencyWithTripIdAndStartTime('trip_0', '10:00:00');
    expect(frequency010h.headway_secs).to.equal('600');

    gtfs.addFrequency({ trip_id: 'trip_1', start_time: '20:00:00', end_time: '25:00:00' });
    expect(sortedKeys(gtfs.getIndexedFrequencies())).to.deep.equal(['trip_0', 'trip_1']);

    gtfs.addFrequencies([
      { trip_id: 'trip_2', start_time: '20:00:00', end_time: '25:00:00' },
      { trip_id: 'trip_3', start_time: '20:00:00', end_time: '25:00:00' },
    ]);
    expect(sortedKeys(gtfs.getIndexedFrequencies())).to.deep.equal(['trip_0', 'trip_1', 'trip_2', 'trip_3']);

    gtfs.removeFrequency(gtfs.getFrequencyWithTripIdAndStartTime('trip_2', '20:00:00'));
    expect(sortedKeys(gtfs.getIndexedFrequencies())).to.deep.equal(['trip_0', 'trip_1', 'trip_3']);

    gtfs.removeFrequencies([
      gtfs.getFrequencyWithTripIdAndStartTime('trip_0', '10:00:00'),
      gtfs.getFrequencyWithTripIdAndStartTime('trip_0', '15:00:00'),
    ]);
    expect(sortedKeys(gtfs.getIndexedFrequencies())).to.deep.equal(['trip_1', 'trip_3']);

    gtfs.setIndexedFrequencies(new Map([
      ['trip_0', new Map([
        ['05:00:00', { trip_id: 'trip_0', start_time: '05:00:00', end_time: '10:00:00' }],
        ['10:00:00', { trip_id: 'trip_0', start_time: '10:00:00', end_time: '15:00:00' }],
      ])],
      ['trip_1', new Map([
        ['05:00:00', { trip_id: 'trip_1', start_time: '05:00:00', end_time: '10:00:00' }],
        ['10:00:00', { trip_id: 'trip_1', start_time: '10:00:00', end_time: '16:00:00' }],
      ])],
    ]));
    expect(sortedKeys(gtfs.getIndexedFrequencies())).to.deep.equal(['trip_0', 'trip_1']);
    const frequency110h = gtfs.getFrequencyWithTripIdAndStartTime('trip_1', '10:00:00');
    expect(frequency110h.end_time).to.equal('16:00:00');

    const endTimes = [];
    gtfs.forEachFrequency((frequency) => {
      endTimes.push(frequency.end_time);
    });
    expect(endTimes.sort()).to.deep.equal(['10:00:00', '10:00:00', '15:00:00', '16:00:00']);

    done();
  });

  it('Tests on transfers', (done) => {
    const path = `${__dirname}/samples/1`;
    const gtfs = new Gtfs(path);

    expect(sortedKeys(gtfs.getIndexedTransfers())).to.deep.equal(['stop_0', 'stop_1']);

    const transfer01 = gtfs.getTransferWithFromStopIdAndToStopId('stop_0', 'stop_1');
    expect(transfer01.transfer_type).to.equal('0');

    gtfs.addTransfer({ from_stop_id: 'stop_2', to_stop_id: 'stop_0', transfer_type: '3' });
    expect(sortedKeys(gtfs.getIndexedTransfers())).to.deep.equal(['stop_0', 'stop_1', 'stop_2']);

    gtfs.addTransfers([
      { from_stop_id: 'stop_3', to_stop_id: 'stop_0', transfer_type: '3' },
      { from_stop_id: 'stop_4', to_stop_id: 'stop_0', transfer_type: '3' },
    ]);
    expect(sortedKeys(gtfs.getIndexedTransfers())).to.deep.equal(['stop_0', 'stop_1', 'stop_2', 'stop_3', 'stop_4']);

    gtfs.removeTransfer(gtfs.getTransferWithFromStopIdAndToStopId('stop_0', 'stop_1'));
    expect(sortedKeys(gtfs.getIndexedTransfers())).to.deep.equal(['stop_1', 'stop_2', 'stop_3', 'stop_4']);

    gtfs.removeTransfers([
      gtfs.getTransferWithFromStopIdAndToStopId('stop_1', 'stop_0'),
      gtfs.getTransferWithFromStopIdAndToStopId('stop_3', 'stop_0'),
    ]);
    expect(sortedKeys(gtfs.getIndexedTransfers())).to.deep.equal(['stop_2', 'stop_4']);

    gtfs.setIndexedTransfers(new Map([
      ['stop_0', new Map([
        ['stop_1', { from_stop_id: 'stop_0', to_stop_id: 'stop_1', transfer_type: '0' }],
        ['stop_2', { from_stop_id: 'stop_0', to_stop_id: 'stop_2', transfer_type: '3' }],
      ])],
      ['stop_1', new Map([
        ['stop_0', { from_stop_id: 'stop_1', to_stop_id: 'stop_0', transfer_type: '1' }],
        ['stop_3', { from_stop_id: 'stop_1', to_stop_id: 'stop_3', transfer_type: '3' }],
      ])],
    ]));
    expect(sortedKeys(gtfs.getIndexedTransfers())).to.deep.equal(['stop_0', 'stop_1']);
    const transfer02 = gtfs.getTransferWithFromStopIdAndToStopId('stop_0', 'stop_2');
    expect(transfer02.transfer_type).to.equal('3');
    const transfer10 = gtfs.getTransferWithFromStopIdAndToStopId('stop_1', 'stop_0');
    expect(transfer10.transfer_type).to.equal('1');

    const transferTypes = [];
    gtfs.forEachTransfer((transfer) => {
      transferTypes.push(transfer.transfer_type);
    });
    expect(transferTypes.sort()).to.deep.equal(['0', '1', '3', '3']);

    done();
  });

  it('Tests on feed info', (done) => {
    const path = `${__dirname}/samples/1`;
    const gtfs = new Gtfs(path);

    expect(gtfs.getFeedInfo().feed_lang).to.equal('en');

    gtfs.setFeedInfo({
      feed_publisher_name: 'Some other name',
      feed_publisher_url: 'http://google.ca',
      feed_lang: 'en-CA',
    });

    expect(gtfs.getFeedInfo().feed_lang).to.equal('en-CA');

    done();
  });

  it('Tests on exporting', (done) => {
    const path = `${__dirname}/samples/1`;
    const gtfs = new Gtfs(path);

    gtfs.getFeedInfo().feed_lang = 'fr';
    gtfs.getFeedInfo().some_extra_field = 'some_extra_value';

    gtfs.forEachRoute((route) => {
      route.route_desc = 'Some new description';
      route.some_extra_route_field = 'some_extra_route_value';
    });

    const outputPath = `${__dirname}/temp_4865ce67d01f96a489fbd0e71ad8800b/`;
    gtfs.exportAtPath(outputPath, (exportError) => {
      if (exportError) { throw exportError; }

      fs.readFile(`${outputPath}routes.txt`, (readRoutesError, routesTxt) => {
        if (readRoutesError) { throw readRoutesError; }

        expect(String(routesTxt)).to.equal(
          'route_id,agency_id,route_short_name,route_long_name,route_desc,route_type,route_url,route_color,' +
          'route_text_color,route_sort_order,some_extra_route_field\n' +
          'route_0,agency_0,R0,Route 0,Some new description,3,,,,,some_extra_route_value\n'
        );

        fs.readFile(`${outputPath}feed_info.txt`, (readFeedInfoError, feedInfoTxt) => {
          if (readFeedInfoError) { throw readFeedInfoError; }

          expect(String(feedInfoTxt)).to.equal(
            'feed_publisher_name,feed_publisher_url,feed_lang,feed_start_date,feed_end_date,feed_version,' +
            'some_extra_field\n' +
            'Publisher Name,http://google.com,fr,20000101,21001231,42,some_extra_value\n'
          );

          fs.remove(outputPath, (removeError) => {
            if (removeError) { throw removeError; }

            done();
          });
        });
      });
    });
  });

  it('Tests on the regex/pattern applied to fix a bad CSV', (done) => {
    const path = `${__dirname}/samples/2/`;
    const gtfsWithoutFix = new Gtfs(path);

    expect(() => gtfsWithoutFix.getIndexedStops()).to.throw();

    const gtfsWithoutFixWithoutThrow = new Gtfs(path, { throws: false });

    expect(() => gtfsWithoutFixWithoutThrow.getIndexedStops()).to.not.throw();

    const regexPatternObjectsByTableName = new Map([[
      'stops', [{regex: /,Some "other" stop,/g, pattern: ',"Some ""other"" stop",'}],
    ]]);
    const gtfsWithFix = new Gtfs(path, { regexPatternObjectsByTableName });

    expect(gtfsWithFix.getStopWithId('stop_1').stop_desc).to.equal('Some "other" stop');

    done();
  });

  it('Test getters helpers: getActualKeysForTable', (done) => {
    const gtfs = new Gtfs();
    const funkyStop = {};
    gtfs.addStop(funkyStop);

    expect(gtfs.getSchema().keysByTableName.stops).to.deep.equal(gtfs.getActualKeysForTable('stops'));

    funkyStop.route_funky_name = 'Tshboom tshboom';
    funkyStop.route_esoteric_float = 120.37;
    const standardRouteKeys = gtfs.getSchema().keysByTableName.stops;
    const actualRouteKeys = gtfs.getActualKeysForTable('stops');

    expect(standardRouteKeys).to.not.deep.equal(actualRouteKeys);

    expect([...standardRouteKeys, 'route_funky_name', 'route_esoteric_float']).to.deep.equal(actualRouteKeys);

    done();
  });
});

function sortedKeys(map) {
  return Array.from(map.keys()).sort();
}
