'use strict';

const { expect } = require('chai');
const { Gtfs } = require('../index');

describe('Tests on GTFS routes', () => {
  it('Tests on routes functions', (done) => {
    const path = `${__dirname}/samples/1`;
    const gtfs = new Gtfs(path);

    expect(sortedKeys(gtfs.getIndexedRoutes())).to.deep.equal(['route_0', 'route_utf8', 'route_x', 'route_y']);

    const route0 = gtfs.getRouteWithId('route_0');
    expect(route0.route_long_name).to.equal('Route 0');

    const routeX = gtfs.getRouteWithId('route_x');
    expect(routeX.route_long_name).to.equal('"Route X"');

    gtfs.addRoute({ route_id: 'route_1', route_long_name: 'Route 1' });
    expect(sortedKeys(gtfs.getIndexedRoutes())).to.deep.equal(['route_0', 'route_1', 'route_utf8', 'route_x', 'route_y']);

    gtfs.addRoutes([
      { route_id: 'route_2', route_long_name: 'Route 2' },
      { route_id: 'route_3', route_long_name: 'Route 3' },
    ]);
    expect(sortedKeys(gtfs.getIndexedRoutes())).to.deep.equal(['route_0', 'route_1', 'route_2',
      'route_3', 'route_utf8', 'route_x', 'route_y']);

    gtfs.removeRoute(gtfs.getRouteWithId('route_2'));
    expect(sortedKeys(gtfs.getIndexedRoutes())).to.deep.equal(['route_0', 'route_1', 'route_3',
      'route_utf8', 'route_x', 'route_y']);

    gtfs.removeRoutes([gtfs.getRouteWithId('route_0'), gtfs.getRouteWithId('route_3')]);
    expect(sortedKeys(gtfs.getIndexedRoutes())).to.deep.equal(['route_1', 'route_utf8', 'route_x', 'route_y']);

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

  it('Tests on gtfs.getNumberOfRoutes()', (done) => {
    const gtfs = new Gtfs(`${__dirname}/samples/1`);

    expect(gtfs.getNumberOfRoutes()).to.equal(4);

    gtfs.resetRoutes();

    expect(gtfs.getNumberOfRoutes()).to.equal(0);

    done();
  });

  it('Tests on gtfs.getSampleRoute()', (done) => {
    const gtfs = new Gtfs(`${__dirname}/samples/1`);

    const route = gtfs.getSampleRoute();

    expect(route.route_id).to.equal('route_0');
    expect(route.route_short_name).to.equal('R0');

    done();
  });

  it('Tests on gtfs.resetRoutes()', (done) => {
    const gtfs = new Gtfs(`${__dirname}/samples/1`);

    expect(gtfs.getIndexedRoutes().size).to.equal(4);

    gtfs.resetRoutes();

    expect(gtfs.getIndexedRoutes().size).to.equal(0);

    done();
  });
});

function sortedKeys(map) {
  return Array.from(map.keys()).sort();
}
