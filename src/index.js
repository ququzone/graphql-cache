const http = require('http');
const crypto = require('crypto');
const connect = require('connect');
const httpProxy = require('http-proxy');

var app = connect();

const cache = {};

var bodyParser = require('body-parser');
app.use(bodyParser.json({extended: true}));

app.use((req, res, next) => {
  if (req.method === 'POST') {
    const hash = crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex');
    req.hash = hash;
    if (cache.hasOwnProperty(hash)) {
      return res.end(cache[hash]);
    }
  }
  next();
});

app.use((req, res, next) => {
  proxy.web(req, res);
});

var proxy = httpProxy.createProxyServer({
  target: 'http://35.226.135.52:8000'
});
proxy.on('proxyReq', (proxyReq, req, res) => {
  if (!req.body || !Object.keys(req.body).length) {
    return;
  }
  const contentType = proxyReq.getHeader('Content-Type');
  const writeBody = (bodyData) => {
    proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
    proxyReq.write(bodyData);
  };

  if (contentType === 'application/json') {
    writeBody(JSON.stringify(req.body));
  }

  if (contentType === 'application/x-www-form-urlencoded') {
    writeBody(querystring.stringify(req.body));
  }
});
proxy.on('proxyRes', function (proxyRes, req, res) {
  if (req.hash) {
    let body = [];
    proxyRes.on('data', function (chunk) {
      body.push(chunk);
    });
    proxyRes.on('end', function () {
      body = Buffer.concat(body).toString();
      cache[req.hash] = body;
    });
  }
});

console.log("listening on port 3000");
http.createServer(app).listen(3000);
