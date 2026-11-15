const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { handleFaceApi } = require('./face-api');

const BASE_PORT = Number(process.env.PORT) || 5173;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.onnx': 'application/octet-stream'
};

const server = http.createServer(async (req, res) => {
  if (await handleFaceApi(req, res)) return;
  const safeUrl = decodeURIComponent((req.url || '/').split('?')[0]);
  const relPath = safeUrl === '/' ? 'index.html' : safeUrl.replace(/^\/+/, '');
  const filePath = path.resolve(ROOT, relPath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stat.size,
      'Cache-Control': ext === '.onnx' || ext === '.wasm' || ext === '.woff2'
        ? 'public, max-age=86400'
        : 'no-cache',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'same-origin'
    });

    fs.createReadStream(filePath).pipe(res);
  });
});

function getLanIp() {
  const nets = os.networkInterfaces();
  for (const list of Object.values(nets)) {
    for (const iface of list || []) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return null;
}

function startOnPort(port) {
  server.once('error', err => {
    if (err.code === 'EADDRINUSE' && port < BASE_PORT + 15) {
      startOnPort(port + 1);
    } else {
      console.error('Server error:', err.message);
      process.exit(1);
    }
  });

  server.listen(port, '0.0.0.0', () => {
    const localUrl = `http://localhost:${port}`;
    const lanIp = getLanIp();
    console.log('====================================================');
    console.log(`  TanYar (100% Offline Vision AI) is running!`);
    console.log(`  Desktop : ${localUrl}`);
    if (lanIp) {
      console.log(`  Mobile  : http://${lanIp}:${port} (Same Wi-Fi)`);
    }
    console.log('====================================================');
    if (process.platform === 'win32' && !process.env.NO_OPEN) {
      exec(`start "" "${localUrl}"`);
    }
  });
}

startOnPort(BASE_PORT);
