/**
 * Keeper's service worker.
 *
 * Its job is narrow on purpose. This app reads one league's live state — who
 * owns which pick, what a keeper costs this minute — and a worker that serves
 * yesterday's answer from a cache is worse than no worker at all. So it caches
 * exactly the things that cannot go stale (the build's content-hashed assets,
 * which change name when they change) and stays out of the way of everything
 * else.
 *
 * What it buys: a cold launch from the home screen paints from disk instead of
 * the network, and Chromium will finally offer to install the app, which it
 * refuses to do for a page with no fetch handler.
 */

const VERSION = "keeper-v1";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/offline";

/** Content-hashed or otherwise immutable: safe to serve from disk forever. */
function isImmutable(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/favicon.svg" ||
    url.pathname === "/apple-touch-icon.png" ||
    url.pathname === "/manifest.webmanifest"
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // `reload` so an install never picks the offline page out of the HTTP
      // cache, which is how a worker ends up pinning a stale one for good.
      await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((name) => !name.startsWith(VERSION)).map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  // Only plain reads, only this origin. A POST is a keeper being saved and a
  // cross-origin GET is somebody else's cache to manage.
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Never the API. Every one of these is per-user and current by definition —
  // the cascade endpoint goes as far as sending no-store to say so.
  if (url.pathname.startsWith("/api/")) return;

  if (isImmutable(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // A full page load with no network gets a real screen instead of the
  // browser's error. Client-side navigations are not `navigate` requests, so
  // they fall through to the network and fail where the app can handle them.
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  // Only a clean, own-origin 200 is worth keeping; an opaque or errored
  // response cached here would be indistinguishable from the real thing.
  if (response.ok && response.type === "basic") {
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    const offline = await cache.match(OFFLINE_URL);
    return (
      offline ??
      new Response("Offline", { status: 503, headers: { "Content-Type": "text/plain" } })
    );
  }
}
