'use strict';

/**
 * Private functions
 */

const SPECIAL_CHARACTERS_REGEX = /[",\\]/;

function formatRegularValue(value) {
  if (value === undefined || value === null) {
    return '';
  }

  value = (typeof value === 'string') ? value : String(value);

  if (value.match(SPECIAL_CHARACTERS_REGEX)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

/**
 * Public functions
 */

function fromObjectToCsvString(object, sortedKeys) {
  return `${sortedKeys.map(key => formatRegularValue(object[key], key)).join(',')}\n`;
}

/*
  Source: http://stackoverflow.com/questions/8493195/how-can-i-parse-a-csv-string-with-javascript
  Explaination:
  (?!\s*$)                            # Don't match empty last value.
  \s*                                 # Strip whitespace before value.
  (?:                                 # Group for value alternatives.
  '([^'\\]*(?:\\[\S\s][^'\\]*)*)'     # Either $1: Single quoted string,
  | "([^"\\]*(?:\\[\S\s][^"\\]*)*)"   # or $2: Double quoted string,
  | ([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)  # or $3: Non-comma, non-quote stuff.
  )                                   # End group of value alternatives.
  \s*                                 # Strip whitespace after value.
  (?:,|$)                             # Field ends on comma or EOS.

  For practical reason, we remove the case with single quoted string.
*/

// eslint-disable-next-line max-len
// var re_valid_original = /^\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*(?:,\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*)*$/;

// eslint-disable-next-line max-len
// var re_value_original = /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\S\s][^'\\]*)*)'|"([^"\\]*(?:\\[\S\s][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g;

// eslint-disable-next-line max-len
const reValid = /^\s*(?:"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,"\s\\]*(?:\s+[^,"\s\\]+)*)\s*(?:,\s*(?:"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,"\s\\]*(?:\s+[^,"\s\\]+)*)\s*)*$/;

// eslint-disable-next-line max-len
const reValue = /(?!\s*$)\s*(?:"([^"\\]*(?:\\[\S\s][^"\\]*)*)"|([^,"\s\\]*(?:\s+[^,"\s\\]+)*))\s*(?:,|$)/g;

function fromCsvStringToArray(string, tableName) {
  string = string.trim();

  if (string.length === 0) {
    return null;
  }

  if (!string.includes('"')) {
    return string.split(',');
  }

  if (!reValid.test(string)) {
    if (string.match(/""/)) {
      string = string.replace(/""/g, '\\"');
      return fromCsvStringToArray(string, tableName);
    }
    process.notices.addWarning(`Row not valid in table ${tableName}: ${string}`);
    return null;
  }

  const a = []; // Initialize array to receive values.
    // "Walk" the string using replace with callback.
  string.replace(reValue, (m0, /* m1, */ m2, m3) => {
        // Remove backslash from \' in single quoted values.
        /* if      (m1 !== undefined) a.push(m1.replace(/\\'/g, "'")); */
        // Remove backslash from \" in double quoted values.
        /* else */
    if (m2 !== undefined) a.push(m2.replace(/\\"/g, '"'));
    else if (m3 !== undefined) a.push(m3);
    return ''; // Return empty string.
  });
    // Handle special case of empty last value.
  if (/,\s*$/.test(string)) {
    a.push('');
  }
  return a;
}

module.exports = {
  fromCsvStringToArray,
  fromObjectToCsvString,
};
