
koa-range
=================
range request implementation for koa

### Installation

```sh
$ npm install koa-range
```

### Usage

```js
var range = require('koa-range');
var koa = require('koa');
var app = koa();

app.use(range);
app.use(function * () {
  this.body = new Buffer(100);
});
```

### License

MIT