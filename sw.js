// Network first, so updates show up straight away; falls back to the cache when offline.
const CACHE = 'gambit-v6';
const SOUNDS = ['move', 'move-opp', 'capture', 'castle', 'check', 'promote', 'illegal'].map(n => `./sounds/${n}.wav`);
const FILES = ['./', './index.html', './app.js', './openings.js', './notes.js', './chess.js',
  './puzzles.js', './endgames.js', './engine.js', './engine/stockfish.wasm.js', './engine/stockfish.wasm', './pieces.css', './manifest.webmanifest', './icon-180.png', './icon-192.png',
  './fonts/barlow-latin-400-normal.woff2', './fonts/barlow-latin-500-normal.woff2', './fonts/barlow-latin-600-normal.woff2',
  './fonts/barlow-condensed-latin-600-normal.woff2', './fonts/barlow-condensed-latin-700-normal.woff2'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll([...FILES, ...SOUNDS])).catch(() => {}));
});
// Drop caches from older versions, so offline use never mixes old and new files.
self.addEventListener('activate', e => e.waitUntil(
  caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; })
      .catch(() => caches.open(CACHE).then(c => c.match(e.request, { ignoreSearch: true })
        .then(r => r || (e.request.mode === 'navigate' ? c.match('./index.html') : Response.error()))))
  );
});
