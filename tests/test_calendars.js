'use strict';

const { expect } = require('chai');
const { Gtfs } = require('../index');

describe('Tests on GTFS stop times', () => {
  it('Tests on calendars functions', (done) => {
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

  it('Tests on gtfs.resetCalendars()', (done) => {
    const gtfs = new Gtfs(`${__dirname}/samples/1`);

    expect(gtfs.getIndexedCalendars().size).to.equal(1);

    gtfs.resetCalendars();

    expect(gtfs.getIndexedCalendars().size).to.equal(0);

    done();
  });
});

function sortedKeys(map) {
  return Array.from(map.keys()).sort();
}
