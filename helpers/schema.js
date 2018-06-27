'use strict';

const version = '2017.12.11';

const keysByTableName = {
  agency: [
    'agency_id',
    'agency_name',
    'agency_url',
    'agency_timezone',
    'agency_lang',
    'agency_phone',
    'agency_fare_url',
    'agency_email',
  ],
  stops: [
    'stop_id',
    'stop_code',
    'stop_name',
    'stop_desc',
    'stop_lat',
    'stop_lon',
    'zone_id',
    'stop_url',
    'location_type',
    'parent_station',
    'stop_timezone',
    'wheelchair_boarding',
  ],
  routes: [
    'route_id',
    'agency_id',
    'route_short_name',
    'route_long_name',
    'route_desc',
    'route_type',
    'route_url',
    'route_color',
    'route_text_color',
    'route_sort_order',
  ],
  trips: [
    'route_id',
    'service_id',
    'trip_id',
    'trip_headsign',
    'trip_short_name',
    'direction_id',
    'block_id',
    'shape_id',
    'wheelchair_accessible',
    'bikes_allowed',
  ],
  stop_times: [
    'trip_id',
    'arrival_time',
    'departure_time',
    'stop_id',
    'stop_sequence',
    'stop_headsign',
    'pickup_type',
    'drop_off_type',
    'shape_dist_traveled',
    'timepoint',
  ],
  calendar: [
    'service_id',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
    'start_date',
    'end_date',
  ],
  calendar_dates: [
    'service_id',
    'date',
    'exception_type',
  ],
  fare_attributes: [
    'fare_id',
    'price',
    'currency_type',
    'payment_method',
    'transfers',
    'agency_id',
    'transfer_duration',
  ],
  fare_rules: [
    'fare_id',
    'route_id',
    'origin_id',
    'destination_id',
    'contains_id',
  ],
  shapes: [
    'shape_id',
    'shape_pt_lat',
    'shape_pt_lon',
    'shape_pt_sequence',
    'shape_dist_traveled',
  ],
  frequencies: [
    'trip_id',
    'start_time',
    'end_time',
    'headway_secs',
    'exact_times',
  ],
  transfers: [
    'from_stop_id',
    'to_stop_id',
    'transfer_type',
    'min_transfer_time',
  ],
  feed_info: [
    'feed_publisher_name',
    'feed_publisher_url',
    'feed_lang',
    'feed_start_date',
    'feed_end_date',
    'feed_version',
  ],
};

const indexKeysByTableName = {
  agency: { indexKey: 'agency_id' },
  calendar: { indexKey: 'service_id' },
  calendar_dates: { firstIndexKey: 'service_id', secondIndexKey: 'date' },
  fare_attributes: { indexKey: 'fare_id' },
  fare_rules: { setOfItems: true },
  frequencies: { firstIndexKey: 'trip_id', secondIndexKey: 'start_time' },
  routes: { indexKey: 'route_id' },
  stop_times: { firstIndexKey: 'trip_id', secondIndexKey: 'stop_sequence' },
  stops: { indexKey: 'stop_id' },
  trips: { indexKey: 'trip_id' },
  shapes: { firstIndexKey: 'shape_id', secondIndexKey: 'shape_pt_sequence' },
  transfers: { firstIndexKey: 'from_stop_id', secondIndexKey: 'to_stop_id' },
  feed_info: { singleton: true },
};

const tableNames = Object.keys(indexKeysByTableName);

const deepnessByTableName = tableNames.reduce((accumulator, tableName) => {
  const indexKeys = indexKeysByTableName[tableName];

  if (indexKeys.singleton || indexKeys.setOfItems) {
    accumulator[tableName] = 0;
  } else if (indexKeys.indexKey) {
    accumulator[tableName] = 1;
  } else if (indexKeys.firstIndexKey && indexKeys.secondIndexKey) {
    accumulator[tableName] = 2;
  }

  return accumulator;
}, {});

module.exports = {
  deepnessByTableName,
  indexKeysByTableName,
  keysByTableName,
  tableNames,
  version,
};
