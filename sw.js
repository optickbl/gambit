// Network first, so updates show up straight away; falls back to the cache when offline.
const CACHE = 'gambit-v4';
const FILES = ['./', './index.html', './app.js', './openings.js', './notes.js', './chess.js',
  './puzzles.js', './endgames.js', './engine.js', './engine/stockfish.wasm.js', './engine/stockfish.wasm', './pieces.css', './manifest.webmanifest', './icon-180.png', './icon-192.png',
  './fonts/barlow-latin-400-normal.woff2', './fonts/barlow-latin-500-normal.woff2', './fonts/barlow-latin-600-normal.woff2',
  './fonts/barlow-condensed-latin-600-normal.woff2', './fonts/barlow-condensed-latin-700-normal.woff2'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).catch(() => {}));
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
  );
});
