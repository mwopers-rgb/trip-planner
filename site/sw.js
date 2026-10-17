// Service worker: keeps the itinerary working with no signal.
//  - Pages and scripts: network first (so edits arrive whenever the phone is online), saved copy when offline.
//  - Map tiles: saved copy first (they don't change), and every tile viewed online is kept for later.
//  - PDFs and fonts: saved copy first, refreshed in the background.
// Cache names: trip-core-<version> is replaced on every deploy; trip-tiles-v1 and trip-fonts-v1 are kept.
importScripts("config.js");
const CFG = self.TRIP_CONFIG;
const CORE = "trip-core-" + CFG.version;
const TILES = "trip-tiles-v1";
const FONTS = "trip-fonts-v1";
const TILE_HOST = new URL(CFG.tileUrl.replace(/\{[a-z]\}/g, "0")).host;
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", e => {
  // cache: "reload" skips the browser's HTTP cache, so a new version never saves stale files
  e.waitUntil(caches.open(CORE)
    .then(c => c.addAll(CFG.coreFiles.map(f => new Request(f, { cache: "reload" }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("trip-core-") && k !== CORE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.host === TILE_HOST) return e.respondWith(cacheFirst(req, TILES, true));
  if (FONT_HOSTS.includes(url.host)) return e.respondWith(cacheFirst(req, FONTS, false));
  if (url.origin !== location.origin) return;                 // Google Maps links etc. go straight out
  if (url.pathname.endsWith(".pdf")) return e.respondWith(cacheFirst(req, CORE, false));
  e.respondWith(networkFirst(req));
});

// Pages and scripts: try the network for a few seconds, else the saved copy.
// The query string is ignored when looking up saved copies (?lang=zh is the same page).
async function networkFirst(req) {
  const cache = await caches.open(CORE);
  try {
    const res = await withTimeout(fetch(req), 4000);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req, { ignoreSearch: true })
             || (req.mode === "navigate" && await cache.match("index.html"));
    return hit || Response.error();
  }
}

// Tiles, fonts and PDFs: saved copy if there is one, else fetch and keep it.
async function cacheFirst(req, name, keepOnly) {
  const cache = await caches.open(name);
  const hit = await cache.match(req, { ignoreVary: true });
  if (hit && keepOnly) return hit;
  const net = fetch(req).then(res => {
    if (res.ok || res.type === "opaque") cache.put(req, res.clone());
    return res;
  });
  if (hit) { net.catch(() => {}); return hit; }               // refresh in the background
  return net.catch(() => Response.error());
}

function withTimeout(p, ms) {
  return new Promise((ok, fail) => { const t = setTimeout(() => fail(new Error("timeout")), ms);
    p.then(v => { clearTimeout(t); ok(v); }, err => { clearTimeout(t); fail(err); }); });
}
