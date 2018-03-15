'use strict';

const { expect } = require('chai');
const { Gtfs } = require('../index');

describe('Tests on GTFS feed info', () => {
  it('Tests on gtfs.getFeedInfo()', (done) => {
    const path = `${__dirname}/samples/1`;
    const gtfs = new Gtfs(path);

    expect(gtfs.getFeedInfo().feed_lang).to.equal('en');

    done();
  });

  it('Tests on gtfs.setFeedInfo(feedInfo)', (done) => {
    const path = `${__dirname}/samples/1`;
    const gtfs = new Gtfs(path);

    gtfs.setFeedInfo({
      feed_publisher_name: 'Some other name',
      feed_publisher_url: 'http://google.ca',
      feed_lang: 'en-CA',
    });

    expect(gtfs.getFeedInfo().feed_lang).to.equal('en-CA');

    done();
  });
});