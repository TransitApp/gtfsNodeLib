'use strict';

const { expect } = require('chai');
const { Gtfs } = require('../index');

describe('Tests on GTFS generic table functions', () => {
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
    expect(sortedKeys(gtfs.getIndexedRoutes())).to.deep.equal(['route_0', 'route_1', 'route_x']);

    gtfs.addItemsInTable([
      { route_id: 'route_2', route_long_name: 'Route 2' },
      { route_id: 'route_3', route_long_name: 'Route 3' },
    ], ROUTE_TABLE_NAME);
    expect(sortedKeys(gtfs.getIndexedRoutes())).to.deep.equal(['route_0', 'route_1', 'route_2', 'route_3', 'route_x']);

    gtfs.removeItemInTable(gtfs.getRouteWithId('route_2'), ROUTE_TABLE_NAME);
    expect(sortedKeys(gtfs.getIndexedRoutes())).to.deep.equal(['route_0', 'route_1', 'route_3', 'route_x']);

    gtfs.removeItemsInTable([gtfs.getRouteWithId('route_0'), gtfs.getRouteWithId('route_3')], ROUTE_TABLE_NAME);
    expect(sortedKeys(gtfs.getIndexedRoutes())).to.deep.equal(['route_1', 'route_x']);

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

  it('Test on gtfs.resetTable(tableName)', (done) => {
    const gtfs = new Gtfs(`${__dirname}/samples/1`);

    expect(gtfs.getIndexedTransfers().size).to.equal(2);

    gtfs.resetTable('transfers');

    expect(gtfs.getIndexedTransfers().size).to.equal(0);

    done();
  });

  it('Test on gtfs.getNumberOfItemsInTable(tableName)', (done) => {
    const gtfs = new Gtfs(`${__dirname}/samples/1`);

    expect(gtfs.getNumberOfItemsInTable('routes')).to.equal(2);

    gtfs.resetRoutes();
    expect(gtfs.getNumberOfItemsInTable('routes')).to.equal(0);

    expect(() => gtfs.getNumberOfItemsInTable('stop_times')).to.throw();

    done();
  });
});

function sortedKeys(map) {
  return Array.from(map.keys()).sort();
}
