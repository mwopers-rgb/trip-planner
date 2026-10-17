// Settings shared by the pages and the service worker (sw.js loads this with importScripts).
// `self` is the window on a page and the worker inside sw.js, so the same file works in both.
self.TRIP_CONFIG = {
  // Bump on every deploy: the service worker drops the old copy of the pages and fetches the new one.
  version: "v1",

  // Map tiles. One setting, so switching provider means changing only this block.
  // OpenStreetMap's tile servers ask apps not to bulk-download tiles; the offline save below
  // keeps the area and zoom small and fetches two at a time. For anything bigger, use a provider
  // whose terms allow offline caching (most need an API key in the URL).
  tileUrl: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  tileAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',

  // What "Save for offline" downloads. Zooms are tile zoom levels (13 = town, 16 = street).
  offlineTiles: {
    routeZooms: [8, 9, 10, 11, 12, 13],   // along every driving route
    stopZooms: [14, 15],                  // around each stop (2 x 2 tiles)
    hotelZooms: [14, 15, 16],             // around each hotel (3 x 3 tiles)
    concurrency: 2,                       // tiles fetched at the same time
    avgTileKB: 20                         // used only for the size estimate (OSM: ~26 KB in towns, less in the country)
  },

  // The app itself: saved when the service worker installs and again by "Save for offline".
  coreFiles: ["./", "index.html", "map.html", "config.js", "offline.js", "map-data.js", "manifest.webmanifest",
    "vendor/leaflet/leaflet.js", "vendor/leaflet/leaflet.css",
    "icons/icon.svg", "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png"],

  // Saved only by "Save for offline". PDFs are made by tools/make-pdfs.ps1; missing ones are skipped.
  extraFiles: ["trip-en.pdf", "trip-zh.pdf"]
};
