// ─── Creator Hub Service Worker ───────────────────────────────────────────────
const CACHE = 'creator-hub-v100';

// Core files to cache for offline shell
const PRECACHE = [
  '/',
  '/index.html',
  '/auth.html',
  '/daily-todo.html',
  '/brand-deals.html',
  '/hooks.html',
  '/products.html',
  '/sales-calendar.html',
  '/script-workshop.html',
  '/scripts.html',
  '/settings.html',
  '/video-tracker.html',
  '/ctas.html',
  '/theme-init.js',
  '/supabase.js',
  '/gemini-ai.js',
  '/layout.js',
  '/layout.css',
  '/manifest.json',
  '/apple-touch-icon.png',
  '/icons/pwa/apple-touch-icon.png',
  '/icons/pwa/icon-192.png',
  '/icons/pwa/icon-512.png',
];

// Install — cache core files
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

// Activate — clean up old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — network first for app files so Chrome does not keep stale UI code.
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always go network-only for Supabase and external APIs
  if (url.hostname.includes('supabase.co') ||
      url.hostname.includes('googleapis.com') ||
      url.hostname.includes('esm.run') ||
      url.hostname.includes('esm.sh') ||
      url.hostname.includes('jsdelivr.net')) {
    return; // let browser handle it normally
  }

  const isAppFile = url.origin === self.location.origin;

  e.respondWith(
    fetch(e.request).then(response => {
      if (isAppFile && e.request.method === 'GET' && response.status === 200) {
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(e.request, clone));
      }
      return response;
    }).catch(() => {
      return caches.match(e.request).then(cached => {
        if (cached) return cached;
        if (e.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
