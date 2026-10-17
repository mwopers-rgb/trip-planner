// Builds site/map-data.js (the trip map's routes and pins) from the TRIP data in site/index.html.
// Run from the repo root:  node tools/make-map.cjs           (reuses the cached routes in tools/map-routes.json)
//                          node tools/make-map.cjs --routes  (re-fetches routes from the OSRM demo server)
// Stop names (EN + 繁中) come from index.html, so rerun this after changing the itinerary.
// Coordinates are pinned here - a Google Maps place-name search fails silently, coordinates don't.
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");

// ----- Load TRIP / HOTELS from index.html -----
const html = fs.readFileSync(path.join(root, "site", "index.html"), "utf8");
const start = html.indexOf("// ===== TRIP DATA"), end = html.indexOf("// ===== END TRIP DATA");
const { TRIP } = new Function(html.slice(start, end) + "\nreturn { TRIP, HOTELS };")();

// ----- Pinned coordinates (lat, lng). "~" = approximate, within a few hundred metres -----
const P = {
  cts: [42.78679, 141.68296], kanio: [42.4935, 141.2610 /*~*/], cowbell: [42.5505, 141.3480 /*~*/],
  usuzan: [42.53966, 140.85241], toya: [42.56582, 140.82186],
  harvester: [42.22770, 140.31664], onuma: [41.98085, 140.67008], wine: [41.8786, 140.6683 /*~*/],
  goryokaku: [41.79680, 140.75703], omo5: [41.7745, 140.7282 /*~*/],
  murakami: [41.77194, 140.72438], kanemori: [41.76618, 140.71645], ajisai: [41.79460, 140.75327],
  kamiiso: [41.82244, 140.71143], ropeway: [41.76008, 140.70955], hbeer: [41.7705, 140.7215 /*~*/],
  asaichi: [41.77224, 140.72482], milk: [42.83764, 140.67613], golf: [42.8440, 140.6720 /*~*/],
  hilton: [42.84711, 140.68484],
  shinsen: [42.90423, 140.59279], nikka: [43.18617, 140.78950], kukizen: [43.19495, 141.00131],
  orgel: [43.19058, 141.00779], canal: [43.20202, 141.00060], stays: [43.19156, 141.00491 /*~*/],
  sankaku: [43.19854, 140.99387], beer: [43.07141, 141.36900], odori: [43.05990, 141.34751],
  sumire: [43.0510, 141.3530 /*~*/], lagent: [43.03928, 141.47182],
  takino: [42.91246, 141.38137], tsukisappu: [43.02670, 141.41945], jrtower: [43.06820, 141.35259],
  kamuikotan: [43.73205, 142.20132], otokoyama: [43.79604, 142.40937], zoo: [43.76864, 142.47927],
  omo7: [43.7705, 142.3605 /*~*/],
  shikisai: [43.52809, 142.46605], bluepond: [43.49349, 142.61410], bogakudai: [43.44780, 142.64981],
  tomita: [43.41730, 142.42548], ningle: [43.32343, 142.35634], lavista: [43.3490, 142.3870 /*~*/],
  letao: [42.82084, 141.65566],
};
// Hotel name (start of) -> pin id
const HOTEL_PIN = { "THE LAKE VIEW TOYA": "toya", "OMO5 Hakodate": "omo5", "Hilton Niseko": "hilton", "Stay's OTARU": "stays",
  "La'gent Stay": "lagent", "OMO7 Asahikawa": "omo7", "La Vista Furano": "lavista", "Air Terminal Hotel": "cts" };

// Per driving day (keyed by the day's tab): the stops to pin, matched on the start of the English
// title, and the driving route. A route entry is a pin id, or [lat, lng] for a via point that only
// shapes the road taken. Flight days are left out.
const DAYS = {
  "Day 2":  { pins: [["cts", "Arrive New Chitose"], ["kanio", "Crab — Kani-O"], ["cowbell", "Lunch — Restaurant Cow Bell"], ["usuzan", "Usuzan Ropeway"]],
              route: ["cts", "kanio", "cowbell", "usuzan", "toya"] },
  "Day 3":  { pins: [["harvester", "Harvester Yakumo"], ["onuma", "Onuma Quasi"], ["wine", "Hakodate Wine"], ["goryokaku", "Goryokaku"]],
              route: ["toya", [42.51277, 140.37521], "harvester", [42.109, 140.57339], "onuma", "wine", "goryokaku", "omo5"] },
  "Day 4":  { pins: [["murakami", "Breakfast — Uni Murakami"], ["kanemori", "Kanemori"], ["ajisai", "Ajisai"], ["kamiiso", "AEON Kamiiso"],
                     ["ropeway", "Mt Hakodate"], ["hbeer", "Hakodate Beer"]],
              route: ["omo5", "ajisai", "kamiiso", "omo5"] },
  "Day 5":  { pins: [["asaichi", "Hakodate Morning Market"], ["milk", "Niseko Milk Kobo"], ["golf", "Golf —"]],
              route: ["omo5", "milk", "golf", "hilton"] },
  "Day 6":  { pins: [["shinsen", "Shinsen-numa"], ["nikka", "Nikka Whisky"], ["kukizen", "Kukizen"], ["orgel", "Otaru Music Box"], ["canal", "Evening walk along Otaru Canal"]],
              route: ["hilton", "shinsen", "nikka", "kukizen", "stays"] },
  "Day 7":  { pins: [["sankaku", "Aji-dokoro Takeda", { en: "Sankaku Market (seafood bowls)", zh: "三角市場（海鮮丼）" }],
                     ["beer", "Sapporo Beer Museum"], ["odori", "Sapporo Autumn Fest"], ["sumire", "Sapporo miso ramen"]],
              route: ["stays", "sankaku", [43.0600, 141.3540], "beer", "lagent"] },
  "Day 8":  { pins: [["takino", "Takino Suzuran"], ["tsukisappu", "Tsukisappu"], ["jrtower", "Shopping at JR Sapporo"]],
              route: ["lagent", "takino", "tsukisappu", "lagent"] },
  "Day 9":  { pins: [["kamuikotan", "Kamui Kotan"], ["otokoyama", "Otokoyama Sake Park"], ["zoo", "Asahiyama Zoo"]],
              route: ["lagent", "kamuikotan", "otokoyama", "zoo", "omo7"] },
  "Day 10": { pins: [["shikisai", "Shikisai-no-Oka"], ["bluepond", "Shirogane Blue Pond"], ["bogakudai", "Tokachidake Bogakudai"],
                     ["tomita", "Farm Tomita"], ["ningle", "Ningle Terrace"]],
              route: ["omo7", "shikisai", "bluepond", "bogakudai", "tomita", "lavista"] },
  "Day 11": { pins: [["letao", "Soufflé pancakes — Doremo LeTAO"], ["cts", "Return hire car"]],
              route: ["lavista", "letao", "cts"] },
};

// ----- Assemble the map data -----
const short = n => n.replace(/ by Hoshino Resorts| Nonokaze Resort/, "");
const days = [];
TRIP.days.forEach(d => {
  const cfg = DAYS[d.tab];
  if (!cfg) return;
  const stops = cfg.pins.map(([pin, match, label]) => {
    const s = d.stops.find(s => s.title.en.startsWith(match));
    if (!s) throw new Error(`${d.tab}: no stop starting "${match}"`);
    return { id: `${d.tab.replace(" ", "")}-${pin}`, pin, ll: P[pin], icon: s.icon, time: s.time || null,
             title: label || s.title, map: s.map || null };
  });
  if (d.hotel) {
    const pin = Object.entries(HOTEL_PIN).find(([k]) => d.hotel.name.startsWith(k))[1];
    stops.push({ id: `${d.tab.replace(" ", "")}-hotel`, pin, ll: P[pin], icon: "🛏️", hotel: true,
                 time: d.hotel.night || null, title: { en: short(d.hotel.name), zh: short(d.hotel.name) }, map: d.hotel.map });
  }
  days.push({ tab: d.tab, place: d.place, stops, route: cfg.route.map(r => typeof r === "string" ? P[r] : r) });
});

// ----- Driving routes (cached; OSRM public demo server) -----
const cacheFile = path.join(__dirname, "map-routes.json");
const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, "utf8")) : {};

// Ramer-Douglas-Peucker - keeps the road shape, drops ~90% of the points
function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  let max = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const [x, y] = pts[i], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    // A round trip starts and ends at the same point - measure from that point instead
    const dd = len ? Math.abs(dy * x - dx * y + b[0] * a[1] - b[1] * a[0]) / len : Math.hypot(x - a[0], y - a[1]);
    if (dd > max) { max = dd; idx = i; }
  }
  if (max <= tol) return [a, b];
  return [...simplify(pts.slice(0, idx + 1), tol).slice(0, -1), ...simplify(pts.slice(idx), tol)];
}

(async () => {
  const refetch = process.argv.includes("--routes");
  for (const d of days) {
    const key = JSON.stringify(d.route);
    if (!refetch && cache[d.tab]?.key === key) continue;
    const coords = d.route.map(([lat, lng]) => `${lng},${lat}`).join(";");
    const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`,
                          { headers: { "User-Agent": "trip-planner-map/1.0 (personal itinerary)" } });
    const j = await r.json();
    if (j.code !== "Ok") throw new Error(`${d.tab}: OSRM ${j.code} ${j.message || ""}`);
    const line = simplify(j.routes[0].geometry.coordinates.map(([lng, lat]) => [lat, lng]), 0.0002)
                 .map(([a, b]) => [+a.toFixed(5), +b.toFixed(5)]);
    cache[d.tab] = { key, km: Math.round(j.routes[0].distance / 1000), line };
    console.log(`${d.tab}: ${cache[d.tab].km} km, ${line.length} points`);
    await new Promise(res => setTimeout(res, 1200));   // be gentle with the free demo server
  }
  fs.writeFileSync(cacheFile, JSON.stringify(cache));

  const data = { title: TRIP.title,
                 days: days.map(d => ({ tab: d.tab, place: d.place, stops: d.stops, km: cache[d.tab].km, line: cache[d.tab].line })) };
  const out = path.join(root, "site", "map-data.js");
  fs.writeFileSync(out, "// Generated by tools/make-map.cjs - edit the itinerary in index.html, then rerun it.\n"
                      + "self.TRIP_MAP = " + JSON.stringify(data) + ";\n");
  console.log(`site/map-data.js written: ${data.days.length} driving days, ${data.days.reduce((s, d) => s + d.stops.length, 0)} pins, ~${data.days.reduce((s, d) => s + d.km, 0)} km`);
})().catch(e => { console.error(e.message); process.exit(1); });
