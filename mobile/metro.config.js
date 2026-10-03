// Metro (the Expo dev server) also forwards /api/* to the backend on this machine, so one
// address serves both the app and its API. That is what lets `npx expo start --tunnel` work
// from any network: the tunnel only exposes Metro, and the API rides along.
const http = require('node:http');
const { getDefaultConfig } = require('expo/metro-config');

const BACKEND_PORT = Number(process.env.BACKEND_PORT ?? 4000);

const config = getDefaultConfig(__dirname);

config.server = {
  ...config.server,
  enhanceMiddleware: (metroMiddleware) => (req, res, next) => {
    if (!req.url?.startsWith('/api/')) return metroMiddleware(req, res, next);
    const upstream = http.request(
      {
        host: '127.0.0.1',
        port: BACKEND_PORT,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: `127.0.0.1:${BACKEND_PORT}` },
      },
      (up) => {
        res.writeHead(up.statusCode ?? 502, up.headers);
        up.pipe(res); // streamed, so Server-Sent Events alerts arrive immediately
      },
    );
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'The SafarSathi backend is not running on this laptop.' }));
    });
    req.pipe(upstream);
  },
};

module.exports = config;
