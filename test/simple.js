
var request = require('supertest');
var assert = require('assert');
var route = require('koa-route');
var range = require('../');
var koa = require('koa');
var app = koa();
var rawbody = new Buffer(1024);

app.use(range);
app.use(route.get('/', function * () {
  this.body = rawbody;
}));

describe('range requests', function() {
  
  it('should return 206 with partial content', function(done) {
    request(app.listen())
    .get('/')
    .set('range', 'bytes=0-300')
    .expect('Content-Length', '300')
    .expect('Accept-Range', 'bytes')
    .expect('Range-Content', 'bytes 0-300/1024')
    .expect(206)
    .end(done);
  });

  it('should return 400 with PUT', function(done) {
    request(app.listen())
    .put('/')
    .set('range', 'bytes=0-300')
    .expect('Accept-Range', 'bytes')
    .expect(400)
    .end(done);
  });

  it('should return 416 with invalid range', function(done) {
    request(app.listen())
    .get('/')
    .set('range', 'bytes=400-300')
    .expect('Accept-Range', 'bytes')
    .expect(416)
    .end(done);
  });

  it('should return 416 without range', function(done) {
    request(app.listen())
    .get('/')
    .expect('Accept-Range', 'bytes')
    .expect(416)
    .end(done);
  });

});
