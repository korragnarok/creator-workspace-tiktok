// ─── Take24 Meta Service Worker (scoped to /meta/) ─────────────────────────
const CACHE = 'take24-meta-v17';
const PRECACHE = ['/meta/', '/meta/index.html', '/meta/meta-supabase.js', '/meta/connect.html'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k.startsWith('take24-meta-') && k !== CACHE).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/meta/')) return;
  e.respondWith(fetch(e.request).then(r => {
    if (e.request.method === 'GET' && r.status === 200) { const c = r.clone(); caches.open(CACHE).then(x => x.put(e.request, c)); }
    return r;
  }).catch(() => caches.match(e.request)));
});
