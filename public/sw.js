const STATIC_CACHE_NAME = "teetangart-static-v6";
const RUNTIME_CACHE_NAME = "teetangart-runtime-v1";
const TILE_CACHE_NAME = "teetangart-tiles-v2";
const CACHE_PREFIX = "teetangart-";
const INDEX_FALLBACK = "/index.html";
const TILE_MAX_ENTRIES = 200;
const TILE_ORIGINS = ["https://tiles.openfreemap.org"];
const STATIC_DESTINATIONS = new Set(["font", "image", "script", "style"]);
const APP_SHELL_ASSETS = ["/", INDEX_FALLBACK, "/site.webmanifest", "/assets/logo.svg"];

async function putInCache(cacheName, request, response) {
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response);
  } catch {
    // Cache storage can be unavailable or full; the network response is still usable.
  }
}

async function trimCache(cacheName, maxEntries) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    const excess = keys.length - maxEntries;
    await Promise.all(keys.slice(0, Math.max(0, excess)).map((key) => cache.delete(key)));
  } catch {
    // A failed cleanup must not interfere with tile delivery.
  }
}

async function handleNavigation(request, event) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      event.waitUntil(putInCache(STATIC_CACHE_NAME, INDEX_FALLBACK, response.clone()));
    }
    return response;
  } catch (networkError) {
    try {
      const cachedIndex = await caches.match(INDEX_FALLBACK);
      if (cachedIndex) {
        return cachedIndex;
      }
    } catch {
      // Preserve the original network failure when cache storage is unavailable.
    }
    throw networkError;
  }
}

async function handleStaticAsset(request, event) {
  try {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
  } catch {
    // Fall through to the network if cache lookup fails.
  }

  const response = await fetch(request);
  if (response.ok) {
    event.waitUntil(putInCache(RUNTIME_CACHE_NAME, request, response.clone()));
  }
  return response;
}

async function handleTile(request, event) {
  let cache;
  try {
    cache = await caches.open(TILE_CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) {
      return cached;
    }
  } catch {
    // Fall through to the network if tile cache access fails.
  }

  const response = await fetch(request);
  if (cache && (response.ok || response.type === "opaque")) {
    event.waitUntil(
      cache
        .put(request, response.clone())
        .then(() => trimCache(TILE_CACHE_NAME, TILE_MAX_ENTRIES))
        .catch(() => undefined),
    );
  }
  return response;
}

function isStaticAsset(request, url) {
  return (
    STATIC_DESTINATIONS.has(request.destination) ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/fonts/") ||
    url.pathname === "/site.webmanifest"
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(STATIC_CACHE_NAME);
        await Promise.allSettled(
          APP_SHELL_ASSETS.map(async (asset) => {
            const response = await fetch(asset, { cache: "no-cache" });
            if (response.ok) {
              await cache.put(asset, response);
            }
          }),
        );
      } catch {
        // Installation can continue without precaching when storage is unavailable.
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const activeCaches = new Set([STATIC_CACHE_NAME, RUNTIME_CACHE_NAME, TILE_CACHE_NAME]);
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && !activeCaches.has(key))
            .map((key) => caches.delete(key)),
        );
      } catch {
        // Claim clients even if stale-cache cleanup fails.
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (TILE_ORIGINS.includes(url.origin)) {
    event.respondWith(handleTile(request, event));
    return;
  }

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request, event));
    return;
  }

  if (url.pathname.startsWith("/api/") || !isStaticAsset(request, url)) {
    return;
  }

  event.respondWith(handleStaticAsset(request, event));
});
