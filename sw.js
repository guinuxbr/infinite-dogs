/**
 * @fileoverview Infinite Dogs - Progressive Web App Service Worker
 * =================================================================
 * Provides offline caching and network routing strategies for the Infinite Dogs application:
 *
 * Caching Strategies:
 * -------------------
 * 1. Static Assets (HTML, CSS, JS, Favicons, Fonts, CDN Icons):
 *    Cache-First with background cache revalidation. If found in cache, return
 *    cached copy immediately and re-fetch from network in background to keep cache fresh.
 *
 * 2. Dog API Requests (https://dog.ceo/*):
 *    Network-First with offline JSON fallback. Tries live network first; if offline
 *    or unreachable, checks local cache or returns a friendly offline message.
 *
 * @author Guilherme Marques (https://guinuxbr.com)
 * @license GNU GPLv3
 */

/**
 * Identifier for the current service worker cache version.
 * Increment this string (e.g., 'infinite-dogs-v2') when updating cached shell assets.
 * @constant {string}
 */
const CACHE_NAME = "infinite-dogs-v1";

/**
 * List of static shell assets to pre-cache upon service worker installation.
 * @constant {string[]}
 */
const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./css/style.css",
  "./js/script.js",
  "./favicon.png",
  "./manifest.json",
  "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap",
  "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
];

/**
 * Service Worker 'install' event.
 * Pre-caches all core shell assets and immediately forces activation.
 */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

/**
 * Service Worker 'activate' event.
 * Purges obsolete cache versions from prior releases and claims control of all open client tabs.
 */
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

/**
 * Service Worker 'fetch' event.
 * Intercepts HTTP GET requests and applies tailored caching strategies:
 * - Network-First for Dog CEO API requests (with offline fallback message)
 * - Cache-First (with background revalidation) for static assets
 */
self.addEventListener("fetch", (event) => {
  // Only handle standard HTTP GET requests
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);

  // 1. Network-First Strategy for Dog CEO API requests
  if (requestUrl.hostname === "dog.ceo") {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          // Fallback offline payload if neither network nor cache has the response
          return new Response(
            JSON.stringify({
              status: "error",
              message: "You are currently offline. Connect to the internet to load more dog pictures!"
            }),
            { headers: { "Content-Type": "application/json" } }
          );
        });
      })
    );
    return;
  }

  // 2. Cache-First with Background Revalidation Strategy for Static Assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to update cache for subsequent visits
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {
          // Suppress background revalidation errors while offline
        });
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});
