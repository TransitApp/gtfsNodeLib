'use strict';

const { expect } = require('chai');
const { Gtfs } = require('../index');

describe('Tests on GTFS stop times', () => {
  it('Tests on stop times functions', (done) => {
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

  it('Tests on gtfs.forEachStopTimeOfTripId(tripId, iterator)', (done) => {
    const gtfs = new Gtfs(`${__dirname}/samples/1`);

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

    const stopHeadsignsOfTrip0 = [];
    gtfs.forEachStopTimeOfTripId('trip_0', (stopTime) => {
      stopHeadsignsOfTrip0.push(stopTime.stop_headsign);
    });
    const expectedStopHeadsigns = ['Stop Headsign 000', 'Stop Headsign 011'];
    expect(stopHeadsignsOfTrip0.sort()).to.deep.equal(expectedStopHeadsigns);

    done();
  });

  it('Tests on gtfs.getNumberOfStopTimeOfTrip(trip)', (done) => {
    const gtfs = new Gtfs(`${__dirname}/samples/1`);

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

    expect(gtfs.getNumberOfStopTimeOfTrip({ trip_id: 'trip_1' })).to.equal(2);

    done();
  });

  it('Tests on gtfs.getNumberOfStopTimeOfTripId(tripId)', (done) => {
    const gtfs = new Gtfs(`${__dirname}/samples/1`);

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

    expect(gtfs.getNumberOfStopTimeOfTripId('trip_1')).to.equal(2);

    done();
  });

  it('Tests on gtfs.resetStopTimes()', (done) => {
    const gtfs = new Gtfs(`${__dirname}/samples/1`);

    expect(gtfs.getIndexedStopTimes().size).to.equal(1);
    expect(gtfs.getNumberOfStopTimeOfTripId('trip_0')).to.equal(2);

    gtfs.resetStopTimes();

    expect(gtfs.getIndexedStopTimes().size).to.equal(0);
    expect(gtfs.getNumberOfStopTimeOfTripId('trip_0')).to.equal(0);

    done();
  });
});

function sortedKeys(map) {
  return Array.from(map.keys()).sort();
}
