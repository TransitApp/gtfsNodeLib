'use strict';

/* Run the tests with mocha: mocha tests.js */

// eslint-disable-next-line import/no-extraneous-dependencies
const { expect } = require('chai');
const fs = require('fs-extra');

const { Gtfs } = require('../index');

describe('Tests on GTFS constructor options', () => {
  it('Test on forcedSchema', (done) => {
    const forcedSchema = Gtfs.getDefaultSchema();
    forcedSchema.deepnessByTableName.modes = 1;
    forcedSchema.indexKeysByTableName.modes = { indexKey: 'mode_id' };
    forcedSchema.keysByTableName.modes = [
      'mode_id',
      'mode_name',
      'mode_url',
      'mode_timezone',
      'mode_lang',
      'mode_phone',
      'mode_fare_url',
      'mode_email',
    ];
    forcedSchema.tableNames.push('modes');

    const path = `${__dirname}/samples/1/`;
    const gtfs = new Gtfs(path, { forcedSchema });

    const mode = gtfs.getItemWithIndexInTable('mode_0', 'modes');

    expect(mode.mode_name).to.equal('mode 0');

    done();
  });

  it('Test on postImportTableFunction', (done) => {
    const path = `${__dirname}/samples/1/`;
    const postImportItemFunction = (item) => { item.temp = 'some value'; };
    const gtfs = new Gtfs(path, { postImportItemFunction });

    const route = gtfs.getRouteWithId('route_0');

    expect(route.temp).to.equal('some value');

    const outputPath = `${__dirname}/temp_4865de67d01696s48dfbd0e71adx8f0b/`;
    gtfs.exportAtPath(outputPath, (exportError) => {
      if (exportError) { throw exportError; }

      fs.readFile(`${outputPath}routes.txt`, (readRoutesError, routesTxt) => {
        if (readRoutesError) { throw readRoutesError; }

        expect(String(routesTxt)).to.equal(
          'route_id,agency_id,route_short_name,route_long_name,route_desc,route_type,route_url,route_color,' +
          'route_text_color,route_sort_order,tts_route_short_name,tts_route_long_name,temp\r\n' +
          'route_0,agency_0,R0,Route 0,,3,,,,,r0,rooouuuteee 0,some value\r\n' +
          'route_x,agency_0,RX,"""Route X""",,3,,,,,,,some value\r\n' +
          'route_utf8,agency_0,RÛTF8,route_😎êωn → ∞⠁⠧⠑ ⠼éöÿΚαλημέρα\'´`,,3,,,,,旱獺屬,,some value\r\n' +
          'route_y,agency_0,RY,"{""routeLongName"":""""}",,3,,,,,,,some value'
        );

        fs.remove(outputPath, (removeError) => {
          if (removeError) { throw removeError; }

          done();
        });
      });
    });
  });

  it('Test on postImportTableFunction', (done) => {
    const path = `${__dirname}/samples/1/`;
    const postImportItemFunction = (item) => { item.temp = { key: 'value' }; };
    const preExportItemFunction = (item) => {
      const item2 = item.clone();
      item2.temp = JSON.stringify(item.temp);
      return item2;
    };
    const gtfs = new Gtfs(path, { postImportItemFunction, preExportItemFunction });

    const route = gtfs.getRouteWithId('route_0');

    expect(route.temp).to.deep.equal({ key: 'value' });

    const outputPath = `${__dirname}/temp_4865de67d01f96s489fbd0e71ad88f0b/`;
    gtfs.exportAtPath(outputPath, (exportError) => {
      if (exportError) { throw exportError; }

      fs.readFile(`${outputPath}routes.txt`, (readRoutesError, routesTxt) => {
        if (readRoutesError) { throw readRoutesError; }

        expect(String(routesTxt)).to.equal(
          'route_id,agency_id,route_short_name,route_long_name,route_desc,route_type,route_url,route_color,' +
          'route_text_color,route_sort_order,tts_route_short_name,tts_route_long_name,temp\r\n' +
          'route_0,agency_0,R0,Route 0,,3,,,,,r0,rooouuuteee 0,"{""key"":""value""}"\r\n' +
          'route_x,agency_0,RX,"""Route X""",,3,,,,,,,"{""key"":""value""}"\r\n' +
          'route_utf8,agency_0,RÛTF8,route_😎êωn → ∞⠁⠧⠑ ⠼éöÿΚαλημέρα\'´`,,3,,,,,旱獺屬,,"{""key"":""value""}"\r\n' +
          'route_y,agency_0,RY,"{""routeLongName"":""""}",,3,,,,,,,"{""key"":""value""}"'
        );

        fs.remove(outputPath, (removeError) => {
          if (removeError) { throw removeError; }

          done();
        });
      });
    });
  });
});
