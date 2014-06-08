
koa-range
=================
range request implementation for koa

### Installation

```sh
$ npm install koa-range
```

### Usage

```js
var fs = require('fs');
var range = require('koa-range');
var route = require('koa-route');
var koa = require('koa');
var app = koa();

app.use(range);

// via buffer
app.use(route.get('/', function * () {
  this.body = new Buffer(100);
}));

// via object
app.use(route.get('/json', function * () {
  this.body = {
    'foo': 'bar'
  };
}));

// via readable stream
app.use(route.get('/stream', function * () {
  this.body = fs.createReadStream('your path');
}));

```

### License

MIT
