'use strict';

const Readable = require('stream').Readable;


// Give it a Node.js Buffer and it'll give you a Node.js Readable Stream; that's all!
//
// Inspired by https://www.npmjs.com/package/simple-bufferstream but with more modern
// node stream handling
module.exports = function readableBufferStream (srcBuf) {
  let bytesRead = 0;

  return new Readable({
    read (size) {
      const remaining = srcBuf.length - bytesRead;
      if (remaining > 0) {
        const toRead = Math.min(size, remaining);
        this.push(srcBuf.slice(bytesRead, bytesRead + toRead));
        bytesRead += toRead;
      } else {
        this.push(null);
      }
    }
  });
}
