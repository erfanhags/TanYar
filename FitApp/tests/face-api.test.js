const assert = require('node:assert/strict');
const http = require('node:http');
const { test, before, after } = require('node:test');
const { handleFaceApi } = require('../face-api');

let server;
let base;
before(async () => {
  server = http.createServer(async (req, res) => {
    if (!await handleFaceApi(req, res)) { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));

test('face API rejects cross-site requests before starting the encoder', async () => {
  const response = await fetch(base + '/api/face/status', { headers: { Origin: 'https://another-site.example' } });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, 'FORBIDDEN');
});

test('face API rejects non-image bodies and never caches results', async () => {
  const response = await fetch(base + '/api/face/encode', { method: 'POST', body: 'not an image' });
  assert.equal(response.status, 415);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('face API rejects oversized streamed image data', async () => {
  const response = await fetch(base + '/api/face/encode', {
    method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: Buffer.alloc(1_000_001)
  });
  assert.equal(response.status, 413);
});

test('unknown face endpoints return JSON rather than an app shell', async () => {
  const response = await fetch(base + '/api/face/unknown');
  assert.equal(response.status, 404);
  assert.equal((await response.json()).code, 'NOT_FOUND');
});
