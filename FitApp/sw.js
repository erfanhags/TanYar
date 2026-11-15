const CACHE_NAME = 'tanyar-v4-face-login';
const CORE_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './assets/fonts/Vazirmatn-Variable.woff2',
  './vendor/ort/ort.wasm.min.js',
  './vendor/ort/ort-wasm-simd-threaded.mjs',
  './vendor/ort/ort-wasm-simd-threaded.wasm',
  './js/data.js',
  './js/food_embeddings.js',
  './js/metrics.js',
  './js/charts.js',
  './js/detector.js',
  './js/face-matcher.js',
  './js/face-login.js',
  './js/app.js',
  './models/food_vision_fp16.onnx',
  './manifest.json',
  './assets/icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Live face processing must never return a cached result or the HTML shell.
  if (new URL(event.request.url).pathname.startsWith('/api/')) return;
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(resp => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return resp;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
