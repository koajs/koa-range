
var util = require('util');
var slice = require('stream-slice').slice;
var Stream = require('stream');

module.exports = function * (next) {
  var range = this.header.range;
  this.set('Accept-Ranges', 'bytes');

  if (!range) {
    return yield * next;
  }

  var ranges = rangeParse(range);

  if (!ranges || ranges.length == 0) {
    this.status = 416;
    return;
  }

  if (this.method == 'PUT') {
    this.status = 400;
    return;
  }

  yield * next;

  if (this.method != 'GET') {
    return;
  }

  var first = ranges[0];
  var rawBody = this.body;
  var len = rawBody.length;

  // avoid multi ranges
  var firstRange = ranges[0];
  var start = firstRange[0];
  var end = firstRange[1];

  if (!Buffer.isBuffer(rawBody)) {
    if (rawBody instanceof Stream.Readable) {
      len = this.length || '*';
      rawBody = rawBody.pipe(slice(start, end + 1));
    } else if (typeof rawBody != 'string') {
      rawBody = new Buffer(JSON.stringify(rawBody));
      len = rawBody.length;
    } else {
      rawBody = new Buffer(rawBody);
      len = rawBody.length;
    }
  }

  //Adjust infinite end
  if (end === Infinity) {
    if (Number.isInteger(len)) {
      end = len - 1;
    } else {
      // FIXME(Calle Svensson): If we don't know how much we can return, we do a normal HTTP 200 repsonse
      this.status = 200;
      return;
    }
  }

  var args = [start, end+1].filter(function(item) {
    return typeof item == 'number';
  });

  this.set('Content-Range', rangeContentGenerator(start, end, len));
  this.status = 206;

  if (rawBody instanceof Stream) {
    this.body = rawBody;
  } else {
    this.body = rawBody.slice.apply(rawBody, args);
  }

  if (len !== '*') {
    this.length = end - start + 1;
  }
};

function rangeParse(str) {
  var token = str.split('=');
  if (!token || token.length != 2 || token[0] != 'bytes') {
    return null;
  }
  return token[1].split(',')
    .map(function(range) {
      return range.split('-').map(function(value) {
        if (value === '') {
          return Infinity;
        }
        return Number(value);
      });
    })
    .filter(function(range) {
      return !isNaN(range[0]) && !isNaN(range[1]) && range[0] <= range[1];
    });
}

function rangeContentGenerator(start, end, length) {
  return util.format('bytes %d-%d/%s', start, end, length);
}
