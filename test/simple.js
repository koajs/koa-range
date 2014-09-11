
var fs = require('fs');
var request = require('supertest');
var assert = require('assert');
var route = require('koa-route');
var range = require('../');
var koa = require('koa');
var app = koa();

var rawbody = new Buffer(1024);
var rawFileBuffer = fs.readFileSync('./README.md') + '';

app.use(range);
app.use(route.get('/', function * () {
  this.body = rawbody;
}));
app.use(route.get('/stream', function * () {
  this.body = fs.createReadStream('./README.md');
}));

app.on('error', function(err) {
  throw err;
});

describe('normal requests', function() {

  it('should return 200 without range', function(done) {
    request(app.listen())
    .get('/')
    .expect('Accept-Ranges', 'bytes')
    .expect(200)
    .end(done);
  });

});

describe('range requests', function() {

  it('should return 206 with partial content', function(done) {
    request(app.listen())
    .get('/')
    .set('range', 'bytes=0-300')
    .expect('Content-Length', '300')
    .expect('Accept-Ranges', 'bytes')
    .expect('Content-Range', 'bytes 0-300/1024')
    .expect(206)
    .end(done);
  });

  it('should return 400 with PUT', function(done) {
    request(app.listen())
    .put('/')
    .set('range', 'bytes=0-300')
    .expect('Accept-Ranges', 'bytes')
    .expect(400)
    .end(done);
  });

  it('should return 416 with invalid range', function(done) {
    request(app.listen())
    .get('/')
    .set('range', 'bytes=400-300')
    .expect('Accept-Ranges', 'bytes')
    .expect(416)
    .end(done);
  });

});

describe('range requests with stream', function() {

  it('should return 206 with partial content', function(done) {
    request(app.listen())
    .get('/stream')
    .set('range', 'bytes=0-100')
    .expect('Transfer-Encoding', 'chunked')
    .expect('Accept-Ranges', 'bytes')
    .expect('Content-Range', 'bytes 0-100/*')
    .expect(206)
    .end(function(err, res) {
      res.text.should.equal(rawFileBuffer.slice(0, 100));
      done();
    });
  });

});
