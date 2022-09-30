'use strict';

module.exports = parseHttpDate;


/**
 * Parse an HTTP Date into a number.
 *
 * @param {string} date
 * @private
 */

function parseHttpDate (date) {
  const timestamp = date && Date.parse(date);

  return (typeof timestamp === 'number') ? timestamp : NaN;
}
