// ─── Creator Hub Service Worker ───────────────────────────────────────────────
const CACHE = 'creator-hub-v9';

// Core files to cache for offline shell
const PRECACHE = [
  '/creator-workspace-tiktok/',
  '/creator-workspace-tiktok/index.html',
  '/creator-workspace-tiktok/auth.html',
  '/creator-workspace-tiktok/daily-todo.html',
  '/creator-workspace-tiktok/hooks.html',
  '/creator-workspace-tiktok/products.html',
  '/creator-workspace-tiktok/sales-calendar.html',
  '/creator-workspace-tiktok/scripts.html',
  '/creator-workspace-tiktok/settings.html',
  '/creator-workspace-tiktok/video-tracker.html',
  '/creator-workspace-tiktok/theme-init.js',
  '/creator-workspace-tiktok/supabase.js',
  '/creator-workspace-tiktok/layout.js',
  '/creator-workspace-tiktok/manifest.json',
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
      url.hostname.includes('jsdelivr.net')) {
    return; // let browser handle it normally
  }

  const isAppFile = url.origin === self.location.origin &&
    url.pathname.startsWith('/creator-workspace-tiktok/');

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
        // Cache successful GET responses
        // Offline fallback — return index for navigation requests
        if (e.request.mode === 'navigate') {
          return caches.match('/creator-workspace-tiktok/index.html');
        }
      });
    })
  );
});
