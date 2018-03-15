'use strict';

const { expect } = require('chai');
const { Gtfs } = require('../index');

describe('Tests on GTFS trips', () => {
  it('Tests on trips functions', (done) => {
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

  it('Tests on gtfs.getNumberOfTrips()', (done) => {
    const gtfs = new Gtfs(`${__dirname}/samples/1`);

    expect(gtfs.getNumberOfTrips()).to.equal(1);

    gtfs.resetTrips();

    expect(gtfs.getNumberOfTrips()).to.equal(0);

    done();
  });

  it('Tests on gtfs.getSampleTrip()', (done) => {
    const gtfs = new Gtfs(`${__dirname}/samples/1`);

    const trip = gtfs.getSampleTrip();

    expect(trip.trip_id).to.equal('trip_0');
    expect(trip.trip_headsign).to.equal('Trip 0');

    done();
  });

  it('Tests on gtfs.resetTrips()', (done) => {
    const gtfs = new Gtfs(`${__dirname}/samples/1`);

    expect(gtfs.getIndexedTrips().size).to.equal(1);

    gtfs.resetTrips();

    expect(gtfs.getIndexedTrips().size).to.equal(0);

    done();
  });
});

function sortedKeys(map) {
  return Array.from(map.keys()).sort();
}
