'use strict';

const { expect } = require('chai');
const { Gtfs } = require('../index');

describe('Tests on GTFS stops', () => {
  it('Tests on stops functions', (done) => {
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

  it('Tests on gtfs.resetStops()', (done) => {
    const gtfs = new Gtfs(`${__dirname}/samples/1`);

    expect(gtfs.getIndexedStops().size).to.equal(2);

    gtfs.resetStops();

    expect(gtfs.getIndexedStops().size).to.equal(0);

    done();
  });
});

function sortedKeys(map) {
  return Array.from(map.keys()).sort();
}
