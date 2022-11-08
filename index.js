'use strict';

const error         = require('./error');
const etag          = require('etag');
const fresh         = require('fresh');
const fs            = require('fs');
const isPreconditionFailure = require('./is-precondition-failure');
const mime          = require('mime');
const parseHttpDate = require('./parse-http-date');
// TODO: I would much prefer to use the range-parser npm module but my PR is not getting any attention.
// might be a dead project: https://github.com/jshttp/range-parser/pull/25
const parseRange    = require('./range-parser');
const pump          = require('pump');
const rangeStream   = require('range-stream');
const sbuff         = require('./buffer-stream'); 
const util          = require('util');
const Stream        = require('stream');


function stat (path) {
  return new Promise(function (resolve, reject) {
    fs.stat(path, function (err, stats) {
      if (err)
        reject(err);
      else
        resolve(stats);
    })
  })
}


function isConditionalGET (request) {
  return request.get('if-match') ||
    request.get('if-unmodified-since') ||
    request.get('if-none-match') ||
    request.get('if-modified-since');
}


// Respond with 304 not modified.
function notModified (ctx) {
  const res = ctx.response;

  // strip various content header fields for a change in entity.
  res.remove('Content-Encoding');
  res.remove('Content-Language');
  res.remove('Content-Length');
  res.remove('Content-Range');
  res.remove('Content-Type');

  ctx.body = null;
  res.status = 304;
}


/**
 * Check if the request is cacheable, aka
 * responded with 2xx or 304 (see RFC 2616 section 14.2{5,6}).
 *
 * @return {Boolean}
 */

function isCachable (ctx) {
  const statusCode = ctx.status;
  return (statusCode >= 200 && statusCode < 300) || statusCode === 304;
}


/**
 * Check if the cache is fresh.
 *
 * @return {Boolean}
 */

function isFresh (ctx) {
  return fresh(ctx.request.headers, {
    etag: ctx.response.get('ETag'),
    'last-modified': ctx.response.get('Last-Modified')
  });
}


/**
 * Check if the range is fresh.
 *
 * @return {Boolean}
 */

function isRangeFresh (ctx) {
  const ifRange = ctx.request.get('if-range');

  if (!ifRange)
    return true;

  // if-range as etag
  if (ifRange.indexOf('"') !== -1) {
    const etag = ctx.response.get('ETag');
    return Boolean(etag && ifRange.indexOf(etag) !== -1);
  }

  // if-range as modified date
  const lastModified = ctx.response.get('Last-Modified');
  return parseHttpDate(lastModified) <= parseHttpDate(ifRange);
}


module.exports = async function (ctx, next) {
  let stats;

  await next();

  if (Buffer.isBuffer(ctx.body))
    stats = ctx.body;
  else if ((ctx.body instanceof Stream.Readable) && ctx.body.path)
    stats = await stat(ctx.body.path);

  
  ctx.set('Accept-Ranges', 'bytes');

  // a server MUST ignore a Range header field received with a request method other than GET
  // rfc7233 section 3.1, paragraph 2
  if (ctx.method !== 'GET')
    return;

  // requests lacking a range header don't need further handling
  //
  // a server MUST ignore if-range header if request does not contain a range header
  // rfc4233 section 3.2, paragraph 3
  const range = ctx.request.get('range');
  if (!range)
    return;

  // responses lacking a body don't need further handling
  //
  // A server MUST ignore all received preconditions after it has successfully performed normal
  // request checks and just before it would perform the action associated with the request method.
  // A server MUST ignore all received preconditions if it's response to the same request without
  // those conditions would have been a status code other than a 2xx (Successful) or 412 (Precondition
  // Failed). i.e., redirects and failures take precendence over the evaluation of preconditions in
  // conditional get requests
  // rfc7232 section 5, paragraph 1
  if (ctx.body == null || ctx.body === undefined)
    return;

  if (stats) {
    //if (this._cacheControl && !res.get['Cache-Control'])
    //  ctx.set('Cache-Control', 'public, max-age=' + Math.floor(this._maxage / 1000);

    if (!Buffer.isBuffer(stats)) {
      if (/*this._lastModified &&*/ !ctx.response.get('Last-Modified'))
        ctx.set('Last-Modified', stats.mtime.toUTCString());
    }

    if (/*this._etag &&*/ !ctx.response.get('ETag'))
      ctx.set('ETag', etag(stats));
  }

  if (ctx.body && ctx.body.path && !ctx.response.get('Content-Type')) {
    const type = mime.getType(ctx.body.path);
    if (type)
      ctx.set('Content-Type', type);
  }


  // this logic defined in implements rfc7232 section 6
  // most of it came from the very comprehensive send npm module
  // https://github.com/pillarjs/send/blob/master/index.js#L619-L636
  if (isConditionalGET(ctx)) {
    if (isPreconditionFailure(ctx)) {
      ctx.body = null;
      error(ctx, 412);
      return;
    }

    if (isCachable(ctx) && isFresh(ctx)) {
      // The range header field is evaluated after evaluating the precondition header fields defined in rfc7232,
      // and only if the result in absence of a the Range header field would be a 200 (OK) response.
      // i.e., Range is ignored when a conditional GET would result in a 304 (Not Modified) response.
      // rfc 7233 section 3.1, paragraph 6

      ctx.body = null;


      notModified(ctx);
      return;
    }
  }

  let stream, representationLength = Infinity;

  if (ctx.body instanceof Stream.Readable) {
    if (ctx.body.path) {
      representationLength = stats.size;
    } else if (ctx.body.length) {
      representationLength = ctx.body.length;
    } else {
      // can't determine the length of this readable stream, just stream the body like a normal non-range request
      ctx.status = 200;
      return;
    }
    stream = ctx.body;
  } else if (!Buffer.isBuffer(ctx.body)) {
    stream = (typeof ctx.body === 'string') ? Buffer.from(ctx.body) : Buffer.from(JSON.stringify(ctx.body));
  } else {
    stream = ctx.body;
  }

  if (Buffer.isBuffer(stream)) {
    representationLength = stream.length;
    stream = sbuff(stream);
  }

  let ranges = parseRange(representationLength, ctx.header.range, { combine: false });

  if (representationLength === Infinity && (ranges.length > 0) && (ranges[0].start === Infinity)) {
    // we've encountered a byte range that looks like:
    //   -500         <- this means give us the last 500 bytes of the representation
    // but because this is a stream of unknown length, we don't know what the last 500 bytes are.
    ranges = -1; 
  }

  if (representationLength < Infinity)
    ctx.set('Content-Length', representationLength);

  if (ranges === -2) {
    ctx.body = null;
    ctx.status = 416;
    return; // malformed range
  }

  const len = (representationLength === Infinity) ? '*' : representationLength;

  if (ranges === -1) {
    // unsatisfiable range
    ctx.set('Content-Range', 'bytes */' + len);
    ctx.body = null;
    ctx.status = 416;
    return;
  }

  if (!ranges || ranges.length === 0) {
    ctx.body = null;
    ctx.status = 416;
    return;
  }

  // TODO: handle multiple ranges (for now we just always use the first one)
  const start = ranges[0].start;
  const end = ranges[0].end;

  // Adjust infinite end
  if (end === Infinity) {
    if (representationLength < Infinity)
      end = representationLength - 1;
    else
      // if we don't know how much to return, just assume a 16kb chunk is what we want. because sure why not :)
      end = start + 16384 - 1;
  }

  ctx.set('Content-Range', util.format('bytes %d-%d/%s', start, end, len));
  ctx.status = 206;

  ctx.body = pump(
    stream,
    rangeStream(start, end)
  )

  //ctx.length = end - start+1;
  ctx.set('Content-Length', end - start+1);
};
