'use strict';

const { expect } = require('chai');
const { Gtfs } = require('../index');

describe('Tests on GTFS frequencies', () => {
  it('Tests on frequencies functions', (done) => {
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

  it('Tests on gtfs.resetFrequencies()', (done) => {
    const gtfs = new Gtfs(`${__dirname}/samples/1`);

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

    expect(gtfs.getIndexedFrequencies().size).to.equal(2);

    gtfs.resetFrequencies();

    expect(gtfs.getIndexedFrequencies().size).to.equal(0);

    done();
  });
});

function sortedKeys(map) {
  return Array.from(map.keys()).sort();
}
