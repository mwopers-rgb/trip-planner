# Offline mode (installable web app)

The original trip used a saved single-file copy of the page for places with no signal. It worked, but it
was a snapshot: any later edit never reached the phones, and it had no map. This repo replaces it with an
installable web app (a PWA) that updates itself whenever the phone is online and keeps everything,
including the map, for when it isn't.

## For travellers

1. **Before the trip, on Wi-Fi:** open the link.
   - **iPhone (Safari):** Share → **Add to Home Screen**, then open the app **from the Home Screen**.
   - **Android (Chrome):** tap **📲 Save for offline → Install app**, or use the browser menu → Install.
2. In the app, tap **📲 Save for offline → Save now**. It shows the size first (about 19 MB for the example
   trip) and a progress bar. Wait for "Saved".
3. That's it. With no signal the itinerary, PDFs and map still open, and a small **Offline** badge appears.
   When the phone is online again, the latest itinerary loads by itself.

> **iPhone:** a Home Screen app keeps its own storage, separate from Safari. Saving in Safari and then
> adding to the Home Screen means saving again inside the app, and the panel says so on iPhone.

## How it works

| Piece | Job |
|---|---|
| `manifest.webmanifest` + `icons/` | Makes the site installable (name, colours, icons; one icon doubles as maskable). |
| `sw.js` | The service worker. It sits between the page and the network. |
| `offline.js` | Registers the worker, shows the Offline badge, runs the **Save for offline** panel. |
| `config.js` | One place for the version, the tile server and how much map to save. Pages *and* the worker load it. |
| `vendor/leaflet/` | Leaflet served from the site itself, because a CDN copy wouldn't load offline. |

How the service worker handles each kind of request:

| Request | Strategy | Why |
|---|---|---|
| Pages, scripts, `map-data.js` | **Network first** (4 s timeout) → saved copy | Edits arrive whenever there's signal. The saved copy covers the rest. `?lang=zh` is matched to the same saved page. |
| Map tiles | **Saved copy first**, and every tile viewed online is kept | Tiles don't change, and anything looked at once is there later. |
| PDFs, Google Fonts | Saved copy first, refreshed in the background | Big, rarely changing. |
| Anything else off-site (Google Maps links) | Not touched | Those need a connection anyway. |

**Caches:**
- **`trip-core-<version>`:** the app. It's saved when the worker installs, and replaced on deploy when you
  bump `version` in `config.js`.
- **`trip-tiles-v1` and `trip-fonts-v1`:** kept across versions, so a deploy doesn't re-download the map.
- **Storage protection:** the save also calls `navigator.storage.persist()`, so the browser doesn't clear
  the data when space runs low.

### Which map tiles get saved

`offline.js` works the list out from the route data (`map-data.js`), using the `offlineTiles` settings
in `config.js`:

- **Along every route:** each tile the line passes through, at zooms 8–13 (country to town level). The line is
  sampled every quarter-tile, so no tile it crosses is missed.
- **Around each stop:** the 2 × 2 block of tiles nearest the pin at zooms 14–15, so a pin near a tile edge
  still gets its surroundings.
- **Around each hotel:** a 3 × 3 block at zooms 14–16 (street level), since that's where you walk from.

For the example trip that's **956 tiles**: 543 along routes and 413 around stops and hotels. OpenStreetMap
tiles averaged 26 KB in town, so the panel estimates ~20 KB each and shows **about 19 MB**. Tiles already
saved are skipped, so "Save again" after an edit only fetches what's new.

**Tile terms.** The default tiles come from OpenStreetMap's own servers, whose usage policy **discourages
bulk downloading** for offline use. The save is kept small (one trip's routes, not whole regions), fetches
only two tiles at a time, and never re-fetches saved tiles. For a bigger trip or a larger group, change
`tileUrl` (and `tileAttribution`) in `config.js` to a provider whose terms allow offline caching. Most need
an API key in the URL. Nothing else needs to change.

**Fonts.** Google splits Japanese and Chinese fonts into hundreds of small pieces. Saving them all came to
245 files and 7.5 MB, so the save keeps only the pieces the page actually used (about 11).

## Hosting notes

- A service worker needs **HTTPS** (or `localhost` for testing).
- Serve `sw.js` and `config.js` with `Cache-Control: no-cache`, or phones keep the old worker. The Caddy
  example does this.
- **Passwords:** basic auth and Home Screen apps don't mix well. The installed iPhone app has its own storage
  and may ask again, and the browser fetches the manifest and icons without credentials. Easiest is no
  password and a hard-to-guess address. If you need one, leave `sw.js`, `config.js`, the manifest and
  `icons/` outside it (commented example in `deploy/Caddyfile.example`).

## Before-you-fly checklist

- [ ] `version` bumped in `config.js` after the last edit, and deployed.
- [ ] Every traveller has installed it **and** pressed **Save now** inside the installed app, on Wi-Fi, in
      the last few days.
- [ ] Opened it once in aeroplane mode to check the itinerary, a PDF and the map all show.
- [ ] Google Maps' own offline area downloaded for the region. The "Open in Google Maps" and route buttons
      hand over to Google Maps, which needs that or a connection.
- [ ] iPhone: opened the app at least once in the week before leaving. Safari can clear storage for sites
      that go unused, and installed apps with persistent storage are much safer, but not guaranteed.

## What was tested

Tested on a desktop Chromium browser against `localhost`:

- **Service worker:** installs, takes control and saves all 13 app files. The "Save for offline" panel
  shows the estimate (956 tiles, about 19 MB).
- **Small real save:** Day 4 only, reduced zoom range. 22 tiles were saved with 0 failures, along with
  the fonts (11 files after the fix).
- **Offline:** with the local web server stopped, the map page opened from the saved copy, in Chinese, on
  Day 4, with its tiles.

**Not yet tested:**
- A real iPhone: Home Screen install, separate storage, storage clearing.
- The Android install prompt.
- A full 956-tile save, held back to keep load on OpenStreetMap's servers low.
