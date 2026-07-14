// Minimal service worker — exists to satisfy PWA installability requirements
// (Chrome/Edge require a registered SW with a fetch handler to offer "Install").
//
// Scope is intentionally narrow: only static, content-hashless assets get a
// cache-first treatment. Everything else — HTML pages, /*/backlog/data,
// /*/events (SSE), any POST — MUST fall through to the network untouched.
// The board's live-update mechanism (SSE + re-fetch) depends on every
// non-static request reaching the real server every time.

// Bump this whenever a cached asset's content changes AND its URL isn't
// already versioned (e.g. dashboard.css's own `?v=N` query bust is usually
// enough — this is the backstop for assets that aren't, or for when that
// bump gets forgotten).
const CACHE_NAME = "board-static-v10";

const STATIC_PATTERN = /^\/(css|js|lib)\/[\w-]+\.(css|js)$/;
const FAVICON_PATTERN = /^\/favicon-[\w-]+\.svg$/;
const MANIFEST_PATTERN = /^\/manifest\.webmanifest$/;

function isCacheableStatic(pathname) {
  return (
    STATIC_PATTERN.test(pathname) ||
    FAVICON_PATTERN.test(pathname) ||
    MANIFEST_PATTERN.test(pathname)
  );
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return; // never touch POSTs (save, etc.)

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch CDN scripts (marked, highlight.js)
  if (!isCacheableStatic(url.pathname)) return; // let SSE, HTML pages, JSON APIs pass through untouched

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(req);
      if (cached) return cached;
      const res = await fetch(req);
      if (res && res.status === 200) cache.put(req, res.clone());
      return res;
    }),
  );
});
