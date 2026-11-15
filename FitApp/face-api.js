const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { spawn } = require('node:child_process');

let worker;
let ready;
let nextId = 0;
const pending = new Map();

function startWorker() {
  if (ready) return ready;
  const localPython = path.resolve(__dirname, '../face-runtime', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  const python = process.env.FACE_PYTHON || (fs.existsSync(localPython) ? localPython : 'python');
  ready = new Promise((resolve, reject) => {
    const child = spawn(python, ['-u', path.join(__dirname, 'face_worker.py')], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });
    worker = child;
    let failed = false;
    const timer = setTimeout(() => fail(), 45000);
    const fail = () => {
      if (failed) return;
      failed = true;
      clearTimeout(timer);
      reject(new Error('ENGINE_UNAVAILABLE'));
      if (worker === child) {
        worker = null;
        ready = null;
        for (const request of pending.values()) request.reject(new Error('ENGINE_UNAVAILABLE'));
        pending.clear();
      }
      child.kill();
    };
    child.on('error', fail);
    child.on('exit', fail);
    child.stdin.on('error', fail);
    child.stderr.on('data', () => {}); // Never log camera data or embeddings.
    readline.createInterface({ input: child.stdout }).on('line', line => {
      let message;
      try { message = JSON.parse(line); } catch { return; }
      if (Object.hasOwn(message, 'ready')) {
        clearTimeout(timer);
        if (message.ready) resolve();
        else fail();
        return;
      }
      const request = pending.get(message.id);
      if (request) { pending.delete(message.id); request.resolve(message); }
    });
  });
  return ready;
}

async function encodeImage(image) {
  await startWorker();
  if (pending.size >= 4) throw new Error('ENGINE_BUSY');
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => stopWorker(new Error('ENCODING_TIMEOUT')), 20000);
    pending.set(id, {
      resolve: result => { clearTimeout(timer); resolve(result); },
      reject: error => { clearTimeout(timer); reject(error); }
    });
    worker.stdin.write(JSON.stringify({ id, image: image.toString('base64') }) + '\n');
  });
}

function send(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

async function handleFaceApi(req, res) {
  const url = (req.url || '').split('?')[0];
  if (!url.startsWith('/api/face/')) return false;
  const origin = req.headers.origin;
  if ((origin && origin !== `http://${req.headers.host}` && origin !== `https://${req.headers.host}`) || req.headers['sec-fetch-site'] === 'cross-site') {
    send(res, 403, { ok: false, code: 'FORBIDDEN' });
    return true;
  }
  try {
    if (url === '/api/face/status' && req.method === 'GET') {
      await startWorker();
      send(res, 200, { ok: true, model: 'dlib-hog-128-v1' });
    } else if (url === '/api/face/encode' && req.method === 'POST') {
      if (!/^image\/(jpeg|png)(;|$)/i.test(req.headers['content-type'] || '')) {
        send(res, 415, { ok: false, code: 'INVALID_IMAGE' });
        req.resume();
        return true;
      }
      const parts = [];
      let size = 0;
      for await (const part of req) {
        size += part.length;
        if (size > 1_000_000) {
          send(res, 413, { ok: false, code: 'IMAGE_TOO_LARGE' });
          return true;
        }
        parts.push(part);
      }
      const result = await encodeImage(Buffer.concat(parts));
      send(res, 200, result);
    } else {
      send(res, 404, { ok: false, code: 'NOT_FOUND' });
    }
  } catch (error) {
    if (!res.headersSent) send(res, 503, { ok: false, code: error.message || 'ENGINE_UNAVAILABLE' });
  }
  return true;
}

function stopWorker(error = new Error('ENGINE_UNAVAILABLE')) {
  const child = worker;
  worker = null;
  ready = null;
  for (const request of pending.values()) request.reject(error);
  pending.clear();
  if (child) child.kill();
}
process.on('exit', stopWorker);
module.exports = { handleFaceApi, encodeImage, stopWorker };
