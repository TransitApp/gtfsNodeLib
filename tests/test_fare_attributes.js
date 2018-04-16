'use strict';

const { expect } = require('chai');
const { Gtfs } = require('../index');

describe('Tests on GTFS fare attributes', () => {
  it('Tests on gtfs.getNumberOfFareAttributes(), .add…(), .remove…() and .getFareAttributeWithId', (done) => {
    const path = `${__dirname}/samples/1`;
    const gtfs = new Gtfs(path);
    const fareAttribute1 = buildFareAttribute(1);
    const fareAttribute2 = buildFareAttribute(2);
    const fareAttribute3 = buildFareAttribute(3);

    expect(gtfs.getNumberOfFareAttributes()).to.equal(0);
    expect(gtfs.getFareAttributeWithId('fareAttribute.fare_id.1') !== undefined).to.equal(false);
    expect(gtfs.getFareAttributeWithId('fareAttribute.fare_id.2') !== undefined).to.equal(false);
    expect(gtfs.getFareAttributeWithId('fareAttribute.fare_id.3') !== undefined).to.equal(false);

    gtfs.addFareAttributes([fareAttribute1, fareAttribute2]);

    expect(gtfs.getNumberOfFareAttributes()).to.equal(2);
    expect(gtfs.getFareAttributeWithId('fareAttribute.fare_id.1') !== undefined).to.equal(true);
    expect(gtfs.getFareAttributeWithId('fareAttribute.fare_id.2') !== undefined).to.equal(true);
    expect(gtfs.getFareAttributeWithId('fareAttribute.fare_id.3') !== undefined).to.equal(false);

    gtfs.addFareAttribute(fareAttribute3);

    expect(gtfs.getNumberOfFareAttributes()).to.equal(3);
    expect(gtfs.getFareAttributeWithId('fareAttribute.fare_id.1') !== undefined).to.equal(true);
    expect(gtfs.getFareAttributeWithId('fareAttribute.fare_id.2') !== undefined).to.equal(true);
    expect(gtfs.getFareAttributeWithId('fareAttribute.fare_id.3') !== undefined).to.equal(true);

    gtfs.removeFareAttribute(fareAttribute2);

    expect(gtfs.getNumberOfFareAttributes()).to.equal(2);
    expect(gtfs.getFareAttributeWithId('fareAttribute.fare_id.1') !== undefined).to.equal(true);
    expect(gtfs.getFareAttributeWithId('fareAttribute.fare_id.2') !== undefined).to.equal(false);
    expect(gtfs.getFareAttributeWithId('fareAttribute.fare_id.3') !== undefined).to.equal(true);

    gtfs.removeFareAttributes([fareAttribute1, fareAttribute3]);

    expect(gtfs.getNumberOfFareAttributes()).to.equal(0);
    expect(gtfs.getFareAttributeWithId('fareAttribute.fare_id.1') !== undefined).to.equal(false);
    expect(gtfs.getFareAttributeWithId('fareAttribute.fare_id.2') !== undefined).to.equal(false);
    expect(gtfs.getFareAttributeWithId('fareAttribute.fare_id.3') !== undefined).to.equal(false);

    done();
  });

  it('Tests on gtfs.setFareAttributes() and .resetFareAttributes', (done) => {
    const path = `${__dirname}/samples/1`;
    const gtfs = new Gtfs(path);
    const fareAttribute1 = buildFareAttribute(1);
    const fareAttribute2 = buildFareAttribute(2);

    expect(gtfs.getNumberOfFareAttributes()).to.equal(0);
    expect(gtfs.getFareAttributeWithId('fareAttribute.fare_id.1') !== undefined).to.equal(false);
    expect(gtfs.getFareAttributeWithId('fareAttribute.fare_id.2') !== undefined).to.equal(false);
    expect(gtfs.getFareAttributeWithId('fareAttribute.fare_id.3') !== undefined).to.equal(false);

    gtfs.setIndexedFareAttributes(new Map([
      ['fareAttribute.fare_id.1', fareAttribute1],
      ['fareAttribute.fare_id.2', fareAttribute2],
    ]));

    expect(gtfs.getNumberOfFareAttributes()).to.equal(2);
    expect(gtfs.getFareAttributeWithId('fareAttribute.fare_id.1') !== undefined).to.equal(true);
    expect(gtfs.getFareAttributeWithId('fareAttribute.fare_id.2') !== undefined).to.equal(true);
    expect(gtfs.getFareAttributeWithId('fareAttribute.fare_id.3') !== undefined).to.equal(false);

    gtfs.resetFareAttributes();

    expect(gtfs.getNumberOfFareAttributes()).to.equal(0);
    expect(gtfs.getFareAttributeWithId('fareAttribute.fare_id.1') !== undefined).to.equal(false);
    expect(gtfs.getFareAttributeWithId('fareAttribute.fare_id.2') !== undefined).to.equal(false);
    expect(gtfs.getFareAttributeWithId('fareAttribute.fare_id.3') !== undefined).to.equal(false);

    done();
  });

  it('Tests on gtfs.forEachFareAttribute()', (done) => {
    const path = `${__dirname}/samples/1`;
    const gtfs = new Gtfs(path);
    gtfs.addFareAttributes([buildFareAttribute(1), buildFareAttribute(3)]);

    const fareIds = [];
    gtfs.forEachFareAttribute(fareAttribute => fareIds.push(fareAttribute.fare_id));

    expect(fareIds.sort()).to.deep.equal(['fareAttribute.fare_id.1', 'fareAttribute.fare_id.3']);

    done();
  });

  it('Tests on gtfs.getIndexedFareAttributes()', (done) => {
    const path = `${__dirname}/samples/1`;
    const gtfs = new Gtfs(path);
    gtfs.addFareAttributes([buildFareAttribute(1), buildFareAttribute(3)]);

    const fareIds = [];
    const indexedFareAttributes = gtfs.getIndexedFareAttributes();
    indexedFareAttributes.forEach(fareAttribute => fareIds.push(fareAttribute.fare_id));

    expect(fareIds.sort()).to.deep.equal(['fareAttribute.fare_id.1', 'fareAttribute.fare_id.3']);

    done();
  });
});

function buildFareAttribute(integer) {
  return {
    'fare_id': `fareAttribute.fare_id.${integer}`,
    'price': `fareAttribute.price.${integer}`,
    'currency_type': `fareAttribute.currency_type.${integer}`,
    'payment_method': `fareAttribute.payment_method.${integer}`,
    'transfers': `fareAttribute.transfers.${integer}`,
    'agency_id': `fareAttribute.agency_id.${integer}`,
    'transfer_duration': `fareAttribute.transfer_duration.${integer}`,
  };
}
