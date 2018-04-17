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