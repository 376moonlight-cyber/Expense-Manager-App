/* Expense Tracker — simple app-shell service worker */
const CACHE_NAME = "expense-tracker-shell-v2";

const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icon.png",
  "/logo-mark.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

function shouldCache(pathname) {
  return (
    pathname === "/" ||
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/icons/") ||
    pathname === "/manifest.webmanifest"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Always hit the network for API calls (auth + live data).
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);

      const networkFetch = fetch(request)
        .then((response) => {
          if (response.ok && shouldCache(url.pathname)) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached);

      // Serve cached shell immediately when available; refresh in the background.
      if (cached) {
        void networkFetch;
        return cached;
      }

      return networkFetch;
    }),
  );
});
