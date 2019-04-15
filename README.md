# Node.js light GTFS loading and manipulation
A Node.js naive library to load and manipulate GTFS datasets.

## Installation

```npm install --save @transit/gtfs```

## Usage

The tables of the GTFS will be loaded only when accessed, and not upfront. This allows manipulation of the small tables
(like routes.txt or stops.txt) without having to load the big tables (like stop_times.txt).

## Example

If you want to remove all the stops called 'Central Station' and the stop_times using this stop:

```js
const { Gtfs } = require('@transit/gtfs');

const gtfs = new Gtfs('pathToTheFolderContainingTheGtfs');

gtfs.forEachStop((stop) => {
  if (stop.stop_name === 'Central Station') {
    gtfs.removeStop(stop);
  }
});

gtfs.forEachStopTime((stopTime) => {
  if (!gtfs.getStopOfStopTime(stopTime)) {
    gtfs.removeStopTime(stopTime);
  }
});

// Let's also clean up the frequencies, to keep a consistent GTFS.
gtfs.forEachFrequency((frequency) => {
  const fromStop = gtfs.getStopWithId(frequency.from_stop_id);
  const toStop = gtfs.getStopWithId(frequency.to_stop_id);

  if (!fromStop || !toStop) {
    gtfs.removeFrequency(frequency);
  }
});

gtfs.exportAtPath('somePathWhereYouWantToExportTheGtfs', (error) => {
  if (error) { throw error };

  // Done
});
```

### Indexes

The tables are loaded and saved as Maps, to allow o(1) access using the ids. The routes are therefore indexed by the
`route_id` value, which is therefore saved in `route.route_id` but also as an index.

**This indexing is not automatically kept up to date.**

If you change the `route_id` just by changing the internal value of the `route` the index **won't** be updated, and
therefore the table will be corrupted. To properly update the id of a route, you should replace it:

```js
const route = gtfs.getRouteWithId('oldId');
gtfs.removeRoute(route);
route.route_id = 'newId';
gtfs.addRoute(route);
```

### Synchronous loading

The goal of this implementation was to avoid loading upfront all the tables. Therefore, they are loaded only when
required. This makes the code faster to run (if some tables are not required at all).

The drawback, is that any function could trigger the loading of a table. Since we do not want to turn every function into an async one, the loading of the tables is done synchronously.

## Naming

The wording used in the official GTFS specification has been followed as much as possible, including the inconsistencies.
For example, the table containing the stops is "stops", but the table containing the agencies is "agency". The reason
for this being that, in the specification, the files are named `stops.txt` vs `agency.txt`.

Most of the time, the name of one item of a table is the singular of the table name (routes -> route, stops -> stop),
but for the `shapes.txt`, since one item of the table is not a "shape" per-se, but just a point, the name used is
"shapePoint" (consistent with the name `shape_pt_sequence`, `shape_pt_lat` and `shape_pt_lon` of the spec).

## Support and contact

Please post any issues you find on [the repo of the project](https://github.com/TransitApp/gtfsNodeLib/issues). And
do not hesitate to contact [Transit App](https://github.com/TransitApp) directly if you have any questions.


