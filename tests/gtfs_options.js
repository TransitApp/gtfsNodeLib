'use strict';

/* Run the tests with mocha: mocha tests.js */

// eslint-disable-next-line import/no-extraneous-dependencies
const { expect } = require('chai');

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
    const postImportTableFunction = (item) => { item.temp = 'some value'; };
    const gtfs = new Gtfs(path, { postImportTableFunction });

    const route = gtfs.getRouteWithId('route_0')

    expect(route.temp).to.equal('some value');

    done();
  });
});