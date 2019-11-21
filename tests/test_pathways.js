'use strict';

const { expect } = require('chai');
const { Gtfs } = require('../index');

describe('Tests on GTFS pathways', () => {
  it('Tests on pathways functions', (done) => {
    const path = `${__dirname}/samples/1`;
    const gtfs = new Gtfs(path);
    expect(sortedKeys(gtfs.getIndexedPathways())).to.deep.equal(['1', '2']);

    const pathway1 = gtfs.getPathwayWithPathwayId('1');
    const pathway2 = gtfs.getPathwayWithPathwayId('2');
    expect(pathway1.pathway_mode).to.equal('1');
    expect(pathway1.is_bidirectional).to.equal('0');

    gtfs.addPathway({
      pathway_id: '3',
      from_stop_id: 'stop_4',
      to_stop_id: 'stop_5',
      pathway_mode: '1',
      is_bidirectional: '0',
      length: '100',
      traversal_time: '60',
      stair_count: '12',
      max_slope: '',
      min_width: '',
      signposted_as: 'signposted_as',
      reversed_signposted_as: 'reversed_signposted_as',
    });
    expect(sortedKeys(gtfs.getIndexedPathways())).to.deep.equal(['1', '2', '3']);

    gtfs.addPathways([
      {
        pathway_id: '4',
        from_stop_id: 'stop_4',
        to_stop_id: 'stop_6',
        pathway_mode: '1',
        is_bidirectional: '0',
        length: '100',
        traversal_time: '60',
        stair_count: '12',
        max_slope: '',
        min_width: '',
        signposted_as: 'signposted_as',
        reversed_signposted_as: 'reversed_signposted_as',
      },
      {
        pathway_id: '5',
        from_stop_id: 'stop_6',
        to_stop_id: 'stop_7',
        pathway_mode: '1',
        is_bidirectional: '0',
        length: '100',
        traversal_time: '60',
        stair_count: '12',
        max_slope: '',
        min_width: '',
        signposted_as: 'signposted_as',
        reversed_signposted_as: 'reversed_signposted_as',
      },
    ]);
    expect(sortedKeys(gtfs.getIndexedPathways())).to.deep.equal(['1', '2', '3', '4', '5']);

    gtfs.removePathway(gtfs.getPathwayWithPathwayId('1'));
    expect(sortedKeys(gtfs.getIndexedPathways())).to.deep.equal(['2', '3', '4', '5']);

    gtfs.removePathways([
      gtfs.getPathwayWithPathwayId('2'),
      gtfs.getPathwayWithPathwayId('3'),
    ]);

    expect(sortedKeys(gtfs.getIndexedPathways())).to.deep.equal(['4', '5']);

    gtfs.setIndexedPathways(new Map([['1', pathway1], ['2', pathway2]]));

    expect(sortedKeys(gtfs.getIndexedPathways())).to.deep.equal(['1', '2']);

    const pathwayModes = [];
    gtfs.forEachPathway((pathway) => {
      pathwayModes.push(pathway.pathway_mode);
    });
    expect(pathwayModes.sort()).to.deep.equal(['1', '2']);

    done();
  });

  it('Tests on gtfs.resetTransfers()', (done) => {
    const gtfs = new Gtfs(`${__dirname}/samples/1`);

    expect(gtfs.getIndexedPathways().size).to.equal(2);

    gtfs.resetPathways();

    expect(gtfs.getIndexedPathways().size).to.equal(0);

    done();
  });
});

function sortedKeys(map) {
  return Array.from(map.keys()).sort();
}
