'use strict';

const parseHttpDate = require('./parse-http-date.js');


module.exports = isPreconditionFailure;


function isPreconditionFailure (ctx) {
  const req = ctx.request;
  const res = ctx.response;

  // if-match
  const match = req.get('if-match');
  if (match) {
    const etag = res.get('ETag');

    return !etag || (match !== '*' && parseTokenList(match).every(function (match) {
      return match !== etag && match !== 'W/' + etag && 'W/' + match !== etag;
    }));
  }

  // if-unmodified-since
  const unmodifiedSince = parseHttpDate(req.get('if-unmodified-since'));
  if (!isNaN(unmodifiedSince)) {
    const lastModified = parseHttpDate(res.get('Last-Modified'));
    return isNaN(lastModified) || lastModified > unmodifiedSince;
  }

  return false;
}


/**
 * Parse a HTTP token list.
 *
 * @param {string} str
 * @private
 */

function parseTokenList (str) {
  let end = 0;
  const list = [ ];
  let start = 0;

  // gather tokens
  for (let i = 0, len = str.length; i < len; i++) {
    switch (str.charCodeAt(i)) {
      case 0x20: /*   */
        if (start === end)
          start = end = i + 1;
        break;

      case 0x2c: /* , */
        if (start !== end) {
          list.push(str.substring(start, end));
        }
        start = end = i + 1;
        break;

      default:
        end = i + 1;
        break;
    }
  }

  // final token
  if (start !== end)
    list.push(str.substring(start, end));

  return list;
}
