'use strict';

/* Run the tests with mocha: mocha tests.js */

// eslint-disable-next-line import/no-extraneous-dependencies
const { expect } = require('chai');
const fs = require('fs-extra');

const { Gtfs } = require('../index');

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
