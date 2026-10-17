# How the Hokkaido trip site was made

A record of how a family itinerary went from conversation to a website on everyone's phone, and what
happened to it afterwards. Personal details (names, bookings, dates, home city, server and network names)
are left out on purpose.

## 1. Planning with Claude

The trip was a 12-day self-drive loop around Hokkaido: fly in via Bangkok, hire a car at New Chitose,
then Lake Toya → Hakodate → Niseko → Otaru → Sapporo → Asahikawa → Furano and back to the airport.

It was planned in conversation with Claude, and the site was built with Claude Code. For each day that meant:

- **Places:** hotels, restaurants and sights, each with real opening hours, closing days, prices and phone
  numbers, checked against the day of the week the family would be there ("closed Wednesdays, Tuesday
  is fine").
- **Drive times and tolls:** where the choice mattered there were two options, such as the coast road vs
  the expressway, each with its time and toll ("no time saved at all, ¥920" is a real example).
- **Fallbacks:** two or three dinner options on busy nights, and an optional stop when there was slack.
- **Practical notes:** where to park, when to leave the car so everyone can have a drink, ETC tolls, and
  returning the hire car with a full tank.

## 2. The site

- **One `index.html`, no framework.** The whole trip is a JavaScript object at the top of the file:
  days → stops `{ icon, time, title, notes, map }` → the night's hotel. A small renderer below it turns
  that into a tab per day with a timeline of cards. Editing the trip never touches the code.
- **Bilingual from the start.** Any string can be `{ en, zh }`. The family reads Hong Kong Traditional
  Chinese, so every title and note was written in both, and one button switches the page. The choice is
  remembered on each phone.
- **Google Maps everywhere,** using coordinates. Each stop has an "Open in Google Maps" button. One lesson
  came from this: a place name Google Maps can't match doesn't show an error. It quietly centres the map
  on wherever the viewer is standing. Route links with via-points, used to force the coast road, are
  therefore pinned with latitude and longitude, never names.
- **Small touches.** A red seal (hanko) with the day's Japanese place name, a sunset-over-Mt-Yotei header,
  and dashed travel connectors between stops showing drive times.

## 3. The map

`make-map.cjs` reads the itinerary, matches each stop to a pinned coordinate, asks the public OSRM demo
server for the driving route between them, simplifies each line (Ramer–Douglas–Peucker, about 90% fewer
points), and caches it. The map page draws every day's route in its own colour on OpenStreetMap with
Leaflet, with a day filter and stop labels that appear as you zoom in.

## 4. PDFs and the offline copy

- **PDFs:** headless Edge prints the same page to `trip-en.pdf` and `trip-zh.pdf` (`--print-to-pdf`). A print
  stylesheet shows every day at once and prints each map link's search text, since links can't be tapped on paper.
- **Offline copy:** a script built a single HTML file with the one booking voucher PDF embedded as base64,
  and family members saved it on their phones for places with no signal. It worked, but it was a snapshot.
  Anything changed after it was saved never reached them. [OFFLINE.md](OFFLINE.md) replaces it.

## 5. Hosting and sharing with the family

- **Server:** an Unraid home server running the site in a small Caddy container (`caddy:2-alpine`), with
  the site folder mounted into it and one shared password (basic auth).
- **Public access:** Unraid 7's per-container Tailscale with **Funnel** gave the container its own public HTTPS
  address, with no ports opened on the home router and no domain to buy.
- **Sharing:** family got the link and the password. Edits went live on the next page load,
  and `Cache-Control: no-cache` on the page meant nobody's phone held on to an old version.
- **Lesson learned:** the day before departure the site went down. Recreating the container had wiped
  Tailscale's state, because it lived inside the container, so the machine dropped off the tailnet.
  Fix: map Tailscale's state directory to its own persistent appdata folder, so a recreated container
  rejoins as the same machine.

## 6. Retiring it

After the trip the container, its image, its template, both appdata folders and the tailnet machine
were removed. The address stopped working and the hostname was freed. The files were kept locally as
an archive, and they became this repo.

## 7. Sharing it with strangers

To show the itinerary to someone outside the family, Claude made a de-identified copy:

- **Removed:** names (including "booked by" on every hotel), the restaurant booking codes and voucher
  link, a personal appointment, golf tee times and players, the home city, flight numbers, and every
  calendar date. Days became "Day 1-12", seasonal events lost their year, and "until 31 Oct" became
  "in season".
- **Kept:** every hotel, restaurant, sight, drive time, opening hour, price and business phone number,
  which is the useful part.
- **Checked:** the cleaning script refuses to finish if any of the original personal strings survive,
  and the result was checked again after rendering.

The copy was published as a public claude.ai artifact. A signed-out viewer sees "Content is
user-generated and unverified" and no owner name. Artifacts block external images, so the Leaflet map
couldn't load tiles there. The artifact version draws its own map instead: a Natural Earth coastline
with the routes and numbered pins as inline SVG.

## 8. What I'd do next time

Make it an installable web app with a real offline mode, not a saved snapshot. That's what this repo now
does; see [OFFLINE.md](OFFLINE.md).
