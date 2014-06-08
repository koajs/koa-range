
var util = require('util');
var slice = require('./slice').slice;
var Stream = require('stream');

module.exports = function * (next) {
  var subranges = [];
  var range = this.header['range'];
  var ranges = range && rangeParse(range);
  this.set('Accept-Range', 'bytes');

  if (!ranges || ranges.length == 0) {
    this.status = 416;
    return;
  }

  if (ranges && this.method == 'PUT') {
    this.status = 400;
    return;
  }

  if (this.method != 'GET') {
    return;
  }
  
  yield * next;

  var first = ranges[0];
  var rawBody = this.body;
  var len = rawBody.length;

  // avoid multi ranges
  var firstRange = ranges[0];
  var start = firstRange[0];
  var end = firstRange[1];
  var args = [start, end].filter(function(item) {
    return typeof item == 'number';
  });

  if (!Buffer.isBuffer(rawBody)) {
    if (rawBody instanceof Stream.Readable) {
      len = '*';
      rawBody = rawBody.pipe(slice(start, end));
    } else if (typeof rawBody != 'string') {
      rawBody = new Buffer(JSON.stringify(rawBody));
    } else {
      rawBody = new Buffer(rawBody);
    }
  }

  this.set('Range-Content', rangeContentGenerator(start, end, len));
  this.status = 206;

  if (rawBody instanceof Stream)
    this.body = rawBody;
  else
    this.body = rawBody.slice.apply(rawBody, args);
};

function rangeParse(str) {
  var token = str.split('=');
  if (!token || token.length != 2 || token[0] != 'bytes') {
    return null;
  }
  return token[1].split(',')
    .map(function(range) {
      return range.split('-').map(Number);
    })
    .filter(function(range) {
      return !isNaN(range[0]) && !isNaN(range[1]) && range[0] < range[1];
    });
}

function rangeContentGenerator(start, end, length) {
  return util.format('bytes %d-%d/%s', start, end, length);
}
