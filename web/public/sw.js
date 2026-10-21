/* Orbit service worker: lets the app open offline and install as a web app.
   It only touches this site's own files. Supabase and every other origin go straight to the network. */
const SHELL_CACHE = "orbit-shell-v1";
const ASSET_CACHE = "orbit-assets-v1";
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icon.svg", "/icon-192.png"];
const MAX_ASSETS = 80;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ASSETS)).map((k) => cache.delete(k)));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Pages: always try the network first so a new deploy shows up, and fall back to the saved app shell offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(SHELL_CACHE).then((c) => c.put("/index.html", copy)); } return res; })
        .catch(() => caches.match("/index.html").then((r) => r || caches.match("/")).then((r) => r || Response.error())),
    );
    return;
  }

  // Built files have a hash in their name, so a saved copy is never out of date.
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) { cache.put(req, res.clone()); trim(cache); }
        return res;
      }),
    );
    return;
  }

  // Icons and the manifest: show the saved copy now, refresh it in the background.
  event.respondWith(
    caches.open(SHELL_CACHE).then(async (cache) => {
      const hit = await cache.match(req);
      const fresh = fetch(req).then((res) => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit || Response.error());
      return hit || fresh;
    }),
  );
});

/* Web push. Nothing sends pushes yet (that needs a server, see the README), but when one does, these show the alert and open the right page. */
self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { /* plain text pushes are ignored */ }
  event.waitUntil(self.registration.showNotification(data.title || "Orbit", {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag,
    data: { url: data.url || "/app" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/app";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) { if ("navigate" in c) c.navigate(url).catch(() => {}); return c.focus(); }
      }
      return self.clients.openWindow(url);
    }),
  );
});
