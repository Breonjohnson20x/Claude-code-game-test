// Service worker for the production build (template; scripts/pwa/plugin.mjs fills in the
// precache list and version and emits it as dist/sw.js).
//
//   - Precaches the app shell and every built asset on install, so the game plays offline.
//   - Navigations: network first (3 s), falling back to the cached index.html.
//   - Same-origin assets: cache first (file names are content-hashed).
//   - Google Fonts: stale-while-revalidate in their own cache.
//   - Everything else, including the optional Claude narrator's API calls, goes straight to the
//     network and is never cached.

const VERSION = self.__ELVIA_VERSION__ ?? 'dev';
const PRECACHE = self.__ELVIA_PRECACHE__ ?? [];
const CACHE = `elvia-${VERSION}`;
const FONT_CACHE = 'elvia-fonts';
const scoped = (path) => new URL(path, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map(scoped)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('elvia-') && k !== CACHE && k !== FONT_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

async function navigate(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await withTimeout(fetch(request), 3000);
    if (response.ok) cache.put(scoped('index.html'), response.clone());
    return response;
  } catch {
    return (await cache.match(scoped('index.html'))) ?? (await cache.match(scoped('./'))) ?? Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(event) {
  const { request } = event;
  const cache = await caches.open(FONT_CACHE);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
      return response;
    })
    .catch(() => hit ?? Response.error());
  event.waitUntil(refresh);
  return hit ?? refresh;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    if (!url.href.startsWith(self.registration.scope)) return;
    event.respondWith(request.mode === 'navigate' ? navigate(request) : cacheFirst(request));
  } else if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(event));
  }
});
