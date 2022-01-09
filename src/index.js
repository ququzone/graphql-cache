const http = require('http');
const crypto = require('crypto');
const connect = require('connect');
const httpProxy = require('http-proxy');
const redis = require('redis');
require('dotenv').config();

const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
});

var app = connect();

var bodyParser = require('body-parser');
app.use(bodyParser.json({extended: true}));

app.use(async (req, res, next) => {
  if (req.method === 'POST') {
    const hash = crypto.createHash('sha256').update(JSON.stringify(req.body)).digest('hex');
    req.hash = hash;
    const data = await redisClient.get(process.env.CACHE_PREFIX + hash);
    if (data) {
      return res.end(data);
    }
  }
  next();
});

app.use((req, res, next) => {
  proxy.web(req, res);
});

var proxy = httpProxy.createProxyServer({
  target: process.env.TARGET
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
proxy.on('proxyRes', async (proxyRes, req, res) => {
  if (req.hash) {
    let body = [];
    proxyRes.on('data', (chunk) => {
      body.push(chunk);
    });
    proxyRes.on('end', async () => {
      body = Buffer.concat(body).toString();
      await redisClient.set(process.env.CACHE_PREFIX + req.hash, body, {
        EX: process.env.CACHE_TTL,
      });
    });
  }
});

http.createServer(app).listen(3000, async () => {
  await redisClient.connect();
  console.log("listening on port 3000");
});
