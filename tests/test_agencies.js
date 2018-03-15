'use strict';

const { expect } = require('chai');
const { Gtfs } = require('../index');

describe('Tests on GTFS agencies', () => {
  it('Tests on agencies functions', (done) => {
    const path = `${__dirname}/samples/1`;
    const gtfs = new Gtfs(path);

    expect(sortedKeys(gtfs.getIndexedAgencies())).to.deep.equal(['agency_0']);

    const agency0 = gtfs.getAgencyWithId('agency_0');
    expect(agency0.agency_name).to.equal('Agency 0');

    gtfs.addAgency({agency_id: 'agency_1', agency_name: 'Agency 1'});
    expect(sortedKeys(gtfs.getIndexedAgencies())).to.deep.equal(['agency_0', 'agency_1']);

    gtfs.addAgencies([
      {agency_id: 'agency_2', agency_name: 'Agency 2'},
      {agency_id: 'agency_3', agency_name: 'Agency 3'},
    ]);
    expect(sortedKeys(gtfs.getIndexedAgencies())).to.deep.equal(['agency_0', 'agency_1', 'agency_2', 'agency_3']);

    gtfs.removeAgency(gtfs.getAgencyWithId('agency_2'));
    expect(sortedKeys(gtfs.getIndexedAgencies())).to.deep.equal(['agency_0', 'agency_1', 'agency_3']);

    gtfs.removeAgencies([gtfs.getAgencyWithId('agency_0'), gtfs.getAgencyWithId('agency_3')]);
    expect(sortedKeys(gtfs.getIndexedAgencies())).to.deep.equal(['agency_1']);

    gtfs.setIndexedAgencies(new Map([['agency_0', agency0]]));
    expect(sortedKeys(gtfs.getIndexedAgencies())).to.deep.equal(['agency_0']);

    const agencyIds = [];
    gtfs.forEachAgency((agency) => {
      agencyIds.push(agency.agency_id);
    });
    expect(agencyIds).to.deep.equal(['agency_0']);

    const route0 = gtfs.getRouteWithId('route_0');
    const agencyOfRoute0 = gtfs.getAgencyOfRoute(route0);
    expect(agencyOfRoute0.agency_name).to.deep.equal('Agency 0');

    done();
  });

  it('Tests on gtfs.resetAgencies()', (done) => {
    const gtfs = new Gtfs(`${__dirname}/samples/1`);

    expect(gtfs.getIndexedAgencies().size).to.equal(1);

    gtfs.resetAgencies();

    expect(gtfs.getIndexedAgencies().size).to.equal(0);

    done();
  });
});

function sortedKeys(map) {
  return Array.from(map.keys()).sort();
}
