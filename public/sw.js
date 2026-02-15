/* Minimal Service Worker for installability.
 * No runtime caching is implemented on purpose to avoid stale assets. */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

