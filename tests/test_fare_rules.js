'use strict';

const { expect } = require('chai');
const { Gtfs } = require('../index');

describe('Tests on GTFS feed info', () => {
  it('Tests on gtfs.getNumberOfFareRules(), .addFareRules?(), .getFareRules?() and .hasFareRule', (done) => {
    const path = `${__dirname}/samples/1`;
    const gtfs = new Gtfs(path);
    const fareRule1 = buildFareRule(1);
    const fareRule2 = buildFareRule(2);
    const fareRule3 = buildFareRule(3);

    expect(gtfs.getNumberOfFareRules()).to.equal(0);
    expect(gtfs.hasFareRule(fareRule1)).to.equal(false);
    expect(gtfs.hasFareRule(fareRule2)).to.equal(false);
    expect(gtfs.hasFareRule(fareRule3)).to.equal(false);

    gtfs.addFareRules([fareRule1, fareRule2]);

    expect(gtfs.getNumberOfFareRules()).to.equal(2);
    expect(gtfs.hasFareRule(fareRule1)).to.equal(true);
    expect(gtfs.hasFareRule(fareRule2)).to.equal(true);
    expect(gtfs.hasFareRule(fareRule3)).to.equal(false);

    gtfs.addFareRule(fareRule3);

    expect(gtfs.getNumberOfFareRules()).to.equal(3);
    expect(gtfs.hasFareRule(fareRule1)).to.equal(true);
    expect(gtfs.hasFareRule(fareRule2)).to.equal(true);
    expect(gtfs.hasFareRule(fareRule3)).to.equal(true);

    gtfs.removeFareRule(fareRule2);

    expect(gtfs.getNumberOfFareRules()).to.equal(2);
    expect(gtfs.hasFareRule(fareRule1)).to.equal(true);
    expect(gtfs.hasFareRule(fareRule2)).to.equal(false);
    expect(gtfs.hasFareRule(fareRule3)).to.equal(true);

    gtfs.removeFareRules([fareRule1, fareRule3]);

    expect(gtfs.getNumberOfFareRules()).to.equal(0);
    expect(gtfs.hasFareRule(fareRule1)).to.equal(false);
    expect(gtfs.hasFareRule(fareRule2)).to.equal(false);
    expect(gtfs.hasFareRule(fareRule3)).to.equal(false);

    done();
  });

  it('Tests on gtfs.setFareRules() and .resetFareRules', (done) => {
    const path = `${__dirname}/samples/1`;
    const gtfs = new Gtfs(path);
    const fareRule1 = buildFareRule(1);
    const fareRule2 = buildFareRule(2);
    const fareRule3 = buildFareRule(3);

    expect(gtfs.getNumberOfFareRules()).to.equal(0);
    expect(gtfs.hasFareRule(fareRule1)).to.equal(false);
    expect(gtfs.hasFareRule(fareRule2)).to.equal(false);
    expect(gtfs.hasFareRule(fareRule3)).to.equal(false);

    gtfs.setFareRules(new Set([fareRule1, fareRule2]));

    expect(gtfs.getNumberOfFareRules()).to.equal(2);
    expect(gtfs.hasFareRule(fareRule1)).to.equal(true);
    expect(gtfs.hasFareRule(fareRule2)).to.equal(true);
    expect(gtfs.hasFareRule(fareRule3)).to.equal(false);

    gtfs.resetFareRules();

    expect(gtfs.getNumberOfFareRules()).to.equal(0);
    expect(gtfs.hasFareRule(fareRule1)).to.equal(false);
    expect(gtfs.hasFareRule(fareRule2)).to.equal(false);
    expect(gtfs.hasFareRule(fareRule3)).to.equal(false);

    done();
  });

  it('Tests on gtfs.forEachFareRule()', (done) => {
    const path = `${__dirname}/samples/1`;
    const gtfs = new Gtfs(path);
    gtfs.addFareRules([buildFareRule(1), buildFareRule(3)]);

    const fareIds = [];
    gtfs.forEachFareRule(fareRule => fareIds.push(fareRule.fare_id));

    expect(fareIds.sort()).to.deep.equal(['fareRule.fare_id.1', 'fareRule.fare_id.3']);

    done();
  });
});

function buildFareRule(integer) {
  return {
    'fare_id': `fareRule.fare_id.${integer}`,
    'route_id': `fareRule.route_id.${integer}`,
    'origin_id': `fareRule.origin_id.${integer}`,
    'destination_id': `fareRule.destination_id.${integer}`,
    'contains_id': `fareRule.contains_id.${integer}`,
  };
}
