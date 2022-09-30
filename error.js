'use strict';

module.exports = error;


// common http error status handler
// @param Object err an object of http headers to set
function error (ctx, status, err) {

  const keys = Object.keys(ctx.response.headers);

  for (let i=0; i < keys.length; i++)
    ctx.remove(keys[i]);
  
  if (err && err.headers)
    setHeaders(ctx, err.headers);

  ctx.set('Accept-Ranges', 'bytes');
  ctx.status = status;
}


/**
 * Set an object of headers on a response.
 *
 * @param {object} res
 * @param {object} headers
 * @private
 */

function setHeaders (ctx, headers) {
  const keys = Object.keys(headers);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    ctx.set(key, headers[key]);
  }
}
