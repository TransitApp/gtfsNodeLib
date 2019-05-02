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

        // Test  deepness 1
        expect(String(routesTxt)).to.equal(
          'route_id,agency_id,route_short_name,route_long_name,route_desc,route_type,route_url,route_color,' +
          'route_text_color,route_sort_order,some_extra_route_field\r\n' +
          'route_0,agency_0,R0,Route 0,Some new description,3,,,,,some_extra_route_value\r\n' +
          'route_x,agency_0,RX,"""Route X""",Some new description,3,,,,,some_extra_route_value\r\n' +
          'route_utf8,agency_0,RÛTF8,route_😎êωn → ∞⠁⠧⠑ ⠼éöÿΚαλημέρα\'´`,' +
          'Some new description,3,,,,,some_extra_route_value\r\n' +
          'route_y,agency_0,RY,"{""routeLongName"":""""}",Some new description,3,,,,,some_extra_route_value'
        );

        // Test singleton
        fs.readFile(`${outputPath}feed_info.txt`, (readFeedInfoError, feedInfoTxt) => {
          if (readFeedInfoError) { throw readFeedInfoError; }

          expect(String(feedInfoTxt)).to.equal(
            'feed_publisher_name,feed_publisher_url,feed_lang,feed_start_date,feed_end_date,feed_version,' +
            'some_extra_field\r\n' +
            'Publisher Name,http://google.com,fr,20000101,21001231,42,some_extra_value'
          );

          // Test deepness 2
          fs.readFile(`${outputPath}stop_times.txt`, (readStopTimesError, stopTimesTxt) => {
            if (readStopTimesError) {
              throw readStopTimesError;
            }

            expect(String(stopTimesTxt)).to.equal(
              'trip_id,arrival_time,departure_time,stop_id,stop_sequence,pickup_type,drop_off_type,stop_headsign\n' +
              'trip_0,10:00:00,10:00:00,stop_0,0,,,Stop Headsign 0\n' +
              'trip_0,20:00:00,20:00:00,stop_1,1,,,Stop Headsign 1'
            );

            fs.remove(outputPath, (removeError) => {
              if (removeError) { throw removeError; }

              done();
            });
          });
        });
      });
    });
  });

  it('Tests on the regex/pattern applied to fix a bad CSV', (done) => {
    const path = `${__dirname}/samples/2/`;
    const gtfsWithoutFix = new Gtfs(path);

    const stop0 = gtfsWithoutFix.getStopWithId('stop_0');
    const stop1 = gtfsWithoutFix.getStopWithId('stop_1');
    const stop2 = gtfsWithoutFix.getStopWithId('stop_2');

    // Fixes too many fields
    expect(Object.keys(stop0).length).to.equal(Object.keys(stop1).length);

    // Fixes too few field
    expect(Object.keys(stop0).length).to.equal(Object.keys(stop2).length);

    // Fixes field using regexPatternObjectsByTableName
    const regexPatternObjectsByTableName = new Map([[
      'stops', [{ regex: /,Some "other" stop,/g, pattern: ',Some stop,' }],
    ]]);

    const gtfsWithFix = new Gtfs(path, { regexPatternObjectsByTableName });

    expect(gtfsWithFix.getStopWithId('stop_0').stop_desc).to.equal('Some stop');

    done();
  });

  it('Tests on bad decoding of UTF-8 characters when decoding by batch', (done) => {
    const path = `${__dirname}/samples/3/`;
    const gtfs = new Gtfs(path);

    expect(() => gtfs.getIndexedStops()).to.not.throw();

    gtfs.forEachStop((stop) => {
      /*
      The stop_code of the samples/3 only contains the character ê.
      That character takes two bytes in UTF-8.
      If replacing ê by empty string still yields any character => there was an error decoding.
      */
      const wronglyDecodedCharacters = stop.stop_code.replace(/ê*/g, '');
      expect(wronglyDecodedCharacters.length).to.equals(0);
    });

    done();
  });

  it('Test getters helpers: getActualKeysForTable', (done) => {
    const gtfs = new Gtfs();

    expect(gtfs.getSchema().keysByTableName.stops).to.deep.equal(gtfs.getActualKeysForTable('stops'));

    const funkyStop = {};
    funkyStop.route_funky_name = 'Tshboom tshboom';
    funkyStop.route_esoteric_float = 120.37;
    gtfs.addStop(funkyStop);

    const standardRouteKeys = gtfs.getSchema().keysByTableName.stops;
    const actualRouteKeys = gtfs.getActualKeysForTable('stops');

    expect(standardRouteKeys).to.not.deep.equal(actualRouteKeys);

    expect([...standardRouteKeys, 'route_funky_name', 'route_esoteric_float']).to.deep.equal(actualRouteKeys);

    done();
  });

  it('Tests clone and toJSON', (done) => {
    const path = `${__dirname}/samples/1/`;
    const gtfs = new Gtfs(path);

    const stop = gtfs.getStopWithId('stop_0');

    expect(stop.toJSON()).to.equal('{"stop_id":"stop_0","stop_code":"SC0","stop_name":"Stop 0"' +
      ',"stop_desc":"Some stop","stop_lat":"37.728631","stop_lon":"-122.431282"}');

    stop.temp = {};
    expect(stop.toJSON()).to.equal('{"stop_id":"stop_0","stop_code":"SC0","stop_name":"Stop 0",' +
      '"stop_desc":"Some stop","stop_lat":"37.728631","stop_lon":"-122.431282","temp":{}}');

    expect(stop.stop_name).to.equal('Stop 0');
    stop.temp.test = 'test';
    expect(stop.temp.test).to.equal('test');
    const clone = stop.clone();
    clone.stop_name = 'Some other stop';

    expect(stop.stop_name).to.equal('Stop 0');
    expect(clone.stop_name).to.equal('Some other stop');
    expect(clone.temp.test).to.equal('test');

    done();
  });

  it('Tests create gtfs object', (done) => {
    const path = `${__dirname}/samples/1/`;
    const gtfs = new Gtfs(path);

    const emptyCalendar = {
      monday: '0', tuesday: '0', wednesday: '0', thursday: '0', friday: '0', saturday: '0', sunday: '0',
    };

    const gtfsEmptyCal = gtfs.createGtfsObjectFromSimpleObject(emptyCalendar);
    expect(gtfsEmptyCal.monday).to.equal(emptyCalendar.monday);
    expect(gtfsEmptyCal.tuesday).to.equal(emptyCalendar.tuesday);
    expect(gtfsEmptyCal.wednesday).to.equal(emptyCalendar.wednesday);
    expect(gtfsEmptyCal.thursday).to.equal(emptyCalendar.thursday);
    expect(gtfsEmptyCal.friday).to.equal(emptyCalendar.friday);

    done();
  });
});
