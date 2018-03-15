'use strict';

const { expect } = require('chai');
const { Gtfs } = require('../index');

describe('Tests on GTFS calendar dates', () => {
  it('Tests on calendar dates functions', (done) => {
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

  it('Tests on gtfs.forEachCalendarDateOfTrip(trip, iterator)', (done) => {
    const gtfs = new Gtfs(`${__dirname}/samples/1`);

    gtfs.setIndexedCalendarDates(new Map([
      ['service_0', new Map([
        ['20171228', { trip_id: 'service_0', date: '20171228', exception_type: '1' }],
        ['20171231', { trip_id: 'service_0', date: '20171231', exception_type: '2' }],
      ])],
      ['service_1', new Map([
        ['20180101', { trip_id: 'service_1', date: '20180101', exception_type: '3' }],
        ['20180102', { trip_id: 'service_1', date: '20180102', exception_type: '4' }],
      ])],
    ]));

    const exceptionTypesForService1 = [];
    gtfs.forEachCalendarDateOfTrip({ service_id: 'service_1' }, (calendarDates) => {
      exceptionTypesForService1.push(calendarDates.exception_type);
    });
    expect(exceptionTypesForService1.sort()).to.deep.equal(['3', '4']);

    done();
  });

  it('Tests on gtfs.forEachCalendarDateWithServiceId(serviceId, iterator)', (done) => {
    const gtfs = new Gtfs(`${__dirname}/samples/1`);

    gtfs.setIndexedCalendarDates(new Map([
      ['service_0', new Map([
        ['20171228', { trip_id: 'service_0', date: '20171228', exception_type: '1' }],
        ['20171231', { trip_id: 'service_0', date: '20171231', exception_type: '2' }],
      ])],
      ['service_1', new Map([
        ['20180101', { trip_id: 'service_1', date: '20180101', exception_type: '3' }],
        ['20180102', { trip_id: 'service_1', date: '20180102', exception_type: '4' }],
      ])],
    ]));

    const exceptionTypesForService1 = [];
    gtfs.forEachCalendarDateWithServiceId('service_1', (calendarDates) => {
      exceptionTypesForService1.push(calendarDates.exception_type);
    });
    expect(exceptionTypesForService1.sort()).to.deep.equal(['3', '4']);

    done();
  });

  it('Tests on gtfs.hasCalendarDatesWithServiceId(serviceId, iterator)', (done) => {
    const gtfs = new Gtfs(`${__dirname}/samples/1`);

    expect(gtfs.hasCalendarDatesWithServiceId('service_1')).to.equal(false);

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

    expect(gtfs.hasCalendarDatesWithServiceId('service_1')).to.equal(true);

    done();
  });

  it('Tests on gtfs.resetCalendarDates()', (done) => {
    const gtfs = new Gtfs(`${__dirname}/samples/1`);

    expect(gtfs.getIndexedCalendarDates().size).to.equal(1);

    gtfs.resetCalendarDates();

    expect(gtfs.getIndexedCalendarDates().size).to.equal(0);

    done();
  });
});

function sortedKeys(map) {
  return Array.from(map.keys()).sort();
}
