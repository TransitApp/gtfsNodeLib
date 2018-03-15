'use strict';

const { expect } = require('chai');
const { Gtfs } = require('../index');

describe('Tests on GTFS shapes', () => {
  it('Tests on shapes functions', (done) => {
    const path = `${__dirname}/samples/1`;
    const gtfs = new Gtfs(path);

    expect(sortedKeys(gtfs.getIndexedShapePoints())).to.deep.equal(['shape_0']);

    const trip0 = gtfs.getTripWithId('trip_0');
    expect(sortedKeys(gtfs.getShapePointByShapePointSequenceOfTrip(trip0))).to.deep.equal(['1', '2']);
    expect(sortedKeys(gtfs.getShapePointByShapePointSequenceOfShapeId('shape_0'))).to.deep.equal(['1', '2']);

    const shapePoint1 = gtfs.getShapePointWithShapeIdAndShapePointSequence('shape_0', '1');
    const shapePoint2 = gtfs.getShapePointWithShapeIdAndShapePointSequence('shape_0', '2');
    expect(shapePoint1.shape_dist_traveled).to.equal('0');
    expect(shapePoint2.shape_dist_traveled).to.equal('10');

    gtfs.addShapePoint({ shape_id: 'shape_0', shape_pt_sequence: '3', shape_dist_traveled: '100' });
    expect(sortedKeys(gtfs.getShapePointByShapePointSequenceOfTrip(trip0))).to.deep.equal(['1', '2', '3']);

    gtfs.addShapePoints([
      { shape_id: 'shape_0', shape_pt_sequence: '4', shape_dist_traveled: '1000' },
      { shape_id: 'shape_0', shape_pt_sequence: '5', shape_dist_traveled: '10000' },
    ]);
    expect(sortedKeys(gtfs.getShapePointByShapePointSequenceOfTrip(trip0))).to.deep.equal(['1', '2', '3', '4', '5']);

    gtfs.removeShapePoint(gtfs.getShapePointWithShapeIdAndShapePointSequence('shape_0', '3'));
    expect(sortedKeys(gtfs.getShapePointByShapePointSequenceOfTrip(trip0))).to.deep.equal(['1', '2', '4', '5']);

    gtfs.removeShapePoints([
      gtfs.getShapePointWithShapeIdAndShapePointSequence('shape_0', '2'),
      gtfs.getShapePointWithShapeIdAndShapePointSequence('shape_0', '5'),
    ]);
    expect(sortedKeys(gtfs.getShapePointByShapePointSequenceOfTrip(trip0))).to.deep.equal(['1', '4']);

    gtfs.setIndexedShapePoints(new Map([
      ['shape_0', new Map([
        ['1', { shape_id: 'shape_0', shape_pt_sequence: '1', shape_dist_traveled: '0' }],
        ['2', { shape_id: 'shape_0', shape_pt_sequence: '2', shape_dist_traveled: '20' }],
      ])],
      ['shape_1', new Map([
        ['6', { shape_id: 'shape_1', shape_pt_sequence: '6', shape_dist_traveled: '0' }],
        ['7', { shape_id: 'shape_1', shape_pt_sequence: '7', shape_dist_traveled: '21' }],
      ])],
    ]));
    expect(sortedKeys(gtfs.getIndexedShapePoints())).to.deep.equal(['shape_0', 'shape_1']);
    expect(sortedKeys(gtfs.getShapePointByShapePointSequenceOfTrip({ shape_id: 'shape_0' }))).to.deep.equal(['1', '2']);
    expect(sortedKeys(gtfs.getShapePointByShapePointSequenceOfTrip({ shape_id: 'shape_1' }))).to.deep.equal(['6', '7']);

    const shapeDistanceTraveled = [];
    gtfs.forEachShapePoint((shapePoint) => {
      shapeDistanceTraveled.push(shapePoint.shape_dist_traveled);
    });
    expect(shapeDistanceTraveled.sort()).to.deep.equal(['0', '0', '20', '21']);

    done();
  });

  it('Tests on gtfs.forEachShapePointOfShapeId(shapeId, iterator)', (done) => {
    const gtfs = new Gtfs(`${__dirname}/samples/1`);

    gtfs.setIndexedShapePoints(new Map([
      ['shape_0', new Map([
        ['1', { shape_id: 'shape_0', shape_pt_sequence: '1', shape_dist_traveled: '0' }],
        ['2', { shape_id: 'shape_0', shape_pt_sequence: '2', shape_dist_traveled: '20' }],
      ])],
      ['shape_1', new Map([
        ['6', { shape_id: 'shape_1', shape_pt_sequence: '6', shape_dist_traveled: '0' }],
        ['7', { shape_id: 'shape_1', shape_pt_sequence: '7', shape_dist_traveled: '21' }],
      ])],
    ]));

    const shapePointSequencesForShape1 = [];
    gtfs.forEachShapePointOfShapeId('shape_1', (calendarDates) => {
      shapePointSequencesForShape1.push(calendarDates.exception_type);
    });
    expect(shapePointSequencesForShape1.sort()).to.deep.equal(['6', '7']);

    done();
  });

  it('Tests on gtfs.resetShapePoints()', (done) => {
    const gtfs = new Gtfs(`${__dirname}/samples/1`);

    expect(gtfs.getIndexedShapePoints().size).to.equal(1);

    gtfs.resetShapePoints();

    expect(gtfs.getIndexedShapePoints().size).to.equal(0);

    done();
  });
});

function sortedKeys(map) {
  return Array.from(map.keys()).sort();
}
