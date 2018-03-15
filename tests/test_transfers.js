'use strict';

const { expect } = require('chai');
const { Gtfs } = require('../index');

describe('Tests on GTFS transfers', () => {
  it('Tests on transfers functions', (done) => {
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

  it('Tests on gtfs.resetTransfers()', (done) => {
    const gtfs = new Gtfs(`${__dirname}/samples/1`);

    expect(gtfs.getIndexedTransfers().size).to.equal(2);

    gtfs.resetTransfers();

    expect(gtfs.getIndexedTransfers().size).to.equal(0);

    done();
  });
});

function sortedKeys(map) {
  return Array.from(map.keys()).sort();
}
