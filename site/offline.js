// Offline support for the pages: registers sw.js, shows an "Offline" badge, and runs "Save for offline"
// (pages, PDFs, fonts and the map tiles along each day's route) with a size estimate and progress bar.
// Also usable from the console: TripOffline.tileList({ days: [4] }), TripOffline.save({ days: [4] }).
(() => {
  const CFG = self.TRIP_CONFIG;
  const CORE = "trip-core-" + CFG.version, TILES = "trip-tiles-v1", FONTS = "trip-fonts-v1";
  const SAVED_KEY = "tripOfflineSaved";

  const TEXT = {
    en: { offline: "Offline · showing the saved copy", title: "Use this trip with no signal",
          intro: "Saves the itinerary, PDFs and the map along every day's route on this phone, so they open with no internet. Do it on Wi-Fi before you fly.",
          size: (mb, n) => `About ${mb} MB (${n.toLocaleString()} map tiles).`,
          ios: "On iPhone, add it to your Home Screen first (Share → Add to Home Screen), open it from there, then save. Saving in Safari doesn't carry over to the Home Screen app.",
          install: "Install app", save: "Save now", again: "Save again", close: "Close",
          saving: "Saving…", pages: "Saving pages and PDFs…", tiles: (a, b) => `Saving map tiles ${a.toLocaleString()} / ${b.toLocaleString()}`,
          done: "Saved. The itinerary and maps now work with no signal.",
          partial: n => `Saved, but ${n.toLocaleString()} map tiles failed. Try again on a better connection; already-saved tiles are skipped.`,
          last: (d, stale) => `Last saved ${d}.` + (stale ? " The itinerary has changed since, so save again." : ""),
          noSpace: "The phone refused to store more. Free up some space and try again.",
          needOnline: "You're offline. Connect to Wi-Fi to save." },
    zh: { offline: "離線中 · 顯示已儲存版本", title: "冇網絡都可以用",
          intro: "將行程、PDF 同每日路線沿途嘅地圖儲存喺部手機度，冇網絡都打得開。出發前用 Wi-Fi 做一次。",
          size: (mb, n) => `大約 ${mb} MB（${n.toLocaleString()} 格地圖）。`,
          ios: "iPhone：先加到主畫面（分享 → 加至主畫面），再由主畫面打開，然後先儲存。喺 Safari 儲存嘅內容唔會帶去主畫面 App。",
          install: "安裝 App", save: "立即儲存", again: "再儲存一次", close: "關閉",
          saving: "儲存中…", pages: "儲存頁面同 PDF…", tiles: (a, b) => `儲存地圖 ${a.toLocaleString()} / ${b.toLocaleString()}`,
          done: "已儲存。行程同地圖冇網絡都用得。",
          partial: n => `已儲存，但有 ${n.toLocaleString()} 格地圖失敗。網絡好啲再試；已儲存嘅會自動略過。`,
          last: (d, stale) => `上次儲存：${d}。` + (stale ? "之後行程有改動，請再儲存一次。" : ""),
          noSpace: "手機唔俾再儲存。清啲空間再試。",
          needOnline: "而家離線。請連接 Wi-Fi 先儲存。" },
  };
  const lang = () => (document.documentElement.lang || "en").startsWith("zh") ? "zh" : "en";
  const t = k => TEXT[lang()][k];
  const store = { get: k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
                  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };

  // ----- Service worker -----
  if ("serviceWorker" in navigator && window.isSecureContext)
    navigator.serviceWorker.register("sw.js").catch(err => console.warn("Service worker not registered:", err));

  // ----- Offline badge -----
  function badge() {
    let b = document.querySelector(".offline-badge");
    if (navigator.onLine) { b?.remove(); return; }
    if (!b) { b = document.createElement("div"); b.className = "offline-badge"; b.setAttribute("role", "status"); document.body.append(b); }
    b.textContent = t("offline");
  }
  addEventListener("online", badge);
  addEventListener("offline", badge);
  badge();

  // ----- Which tiles to save -----
  const tx = (lng, z) => (lng + 180) / 360 * 2 ** z;
  const ty = (lat, z) => { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z; };

  function ensureMapData() {
    if (self.TRIP_MAP) return Promise.resolve(self.TRIP_MAP);
    return new Promise((ok, fail) => {
      const s = Object.assign(document.createElement("script"), { src: "map-data.js" });
      s.onload = () => ok(self.TRIP_MAP);
      s.onerror = () => fail(new Error("map-data.js did not load"));
      document.head.append(s);
    });
  }

  // Routes: every tile the line passes through at each route zoom. Stops: the 2 x 2 block nearest the
  // pin (a pin near a tile edge still gets its surroundings). Hotels: the 3 x 3 block around the pin.
  function tileList(opts = {}) {
    const o = { ...CFG.offlineTiles, ...opts };
    const days = (self.TRIP_MAP?.days || []).filter(d => !o.days || o.days.includes(+d.tab.split(" ")[1]));
    const keys = new Set();
    const add = (z, x, y) => keys.add(`${z}/${x}/${y}`);
    for (const d of days) {
      for (const z of o.routeZooms) {
        const step = 360 / 2 ** z / 4;                   // a quarter tile, so no tile along the line is skipped
        d.line.forEach((p, i) => {
          const q = d.line[i + 1] || p;
          const n = Math.max(1, Math.ceil(Math.max(Math.abs(q[0] - p[0]), Math.abs(q[1] - p[1])) / step));
          for (let k = 0; k <= n; k++) {
            const lat = p[0] + (q[0] - p[0]) * k / n, lng = p[1] + (q[1] - p[1]) * k / n;
            add(z, Math.floor(tx(lng, z)), Math.floor(ty(lat, z)));
          }
        });
      }
      for (const s of d.stops) {
        const [lat, lng] = s.ll;
        for (const z of s.hotel ? o.hotelZooms : o.stopZooms) {
          const fx = tx(lng, z), fy = ty(lat, z), x = Math.floor(fx), y = Math.floor(fy);
          if (s.hotel) { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) add(z, x + dx, y + dy); }
          else {
            const nx = fx - x < .5 ? x - 1 : x + 1, ny = fy - y < .5 ? y - 1 : y + 1;
            add(z, x, y); add(z, nx, y); add(z, x, ny); add(z, nx, ny);
          }
        }
      }
    }
    return [...keys].map(k => { const [z, x, y] = k.split("/");
      return CFG.tileUrl.replace("{z}", z).replace("{x}", x).replace("{y}", y).replace("{s}", "a"); });
  }

  // ----- Save everything -----
  async function save(opts = {}, progress = () => {}) {
    await ensureMapData();
    try { await navigator.storage?.persist?.(); } catch {}    // ask the browser not to clear it under pressure

    // Pages, scripts, icons and PDFs, straight from the server (not the browser's HTTP cache)
    progress({ phase: "pages" });
    const core = await caches.open(CORE);
    for (const f of [...CFG.coreFiles, ...CFG.extraFiles]) {
      try { const r = await fetch(f, { cache: "reload" }); if (r.ok) await core.put(f, r); } catch {}
    }

    // Fonts: the stylesheet, plus only the font files this page actually downloaded. Google splits
    // Japanese and Chinese fonts into hundreds of small pieces; the rest are never needed here.
    const fonts = await caches.open(FONTS);
    const used = [...document.querySelectorAll('link[rel="stylesheet"][href^="https://fonts.googleapis.com"]')].map(l => l.href)
      .concat(performance.getEntriesByType("resource").map(e => e.name).filter(n => n.startsWith("https://fonts.gstatic.com/")));
    for (const url of new Set(used)) {
      try {
        if (await fonts.match(url)) continue;
        const f = await fetch(url, { mode: "cors" });
        if (f.ok) await fonts.put(url, f);
      } catch {}
    }

    // Map tiles, a couple at a time; ones already saved are skipped
    const urls = tileList(opts), tiles = await caches.open(TILES);
    let done = 0, failed = 0, next = 0;
    const worker = async () => {
      while (next < urls.length) {
        const url = urls[next++];
        try {
          if (!(await tiles.match(url))) {
            const r = await fetch(url, { mode: "cors", credentials: "omit" });
            if (!r.ok) throw new Error(r.status);
            await tiles.put(url, r);
          }
        } catch (err) {
          if (err?.name === "QuotaExceededError") throw err;
          failed++;
        }
        progress({ phase: "tiles", done: ++done, total: urls.length });
      }
    };
    await Promise.all(Array.from({ length: CFG.offlineTiles.concurrency }, worker));
    const result = { at: new Date().toISOString(), version: CFG.version, tiles: urls.length, failed };
    if (!opts.days) store.set(SAVED_KEY, result);              // a partial test save doesn't count
    return result;
  }

  self.TripOffline = { tileList, save, ensureMapData };

  // ----- "Save for offline" panel (itinerary page only) -----
  const btn = document.getElementById("offline"), panel = document.getElementById("offline-panel");
  if (!btn || !panel) return;
  let installEvt = null, state = { step: "idle" };
  addEventListener("beforeinstallprompt", e => { e.preventDefault(); installEvt = e; if (!panel.hidden) draw(); });

  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  async function estimate() {
    await ensureMapData();
    const n = tileList().length;
    let bytes = n * CFG.offlineTiles.avgTileKB * 1024 + 400 * 1024;      // + pages, scripts and icons
    for (const f of CFG.extraFiles) {
      try { const r = await fetch(f, { method: "HEAD", cache: "no-store" }); if (r.ok) bytes += +r.headers.get("content-length") || 0; } catch {}
    }
    return { tiles: n, mb: Math.max(1, Math.round(bytes / 1048576)) };
  }

  function draw() {
    const last = store.get(SAVED_KEY);
    const when = last && new Date(last.at).toLocaleString(lang() === "zh" ? "zh-HK" : "en-AU", { dateStyle: "medium", timeStyle: "short" });
    let body = `<p>${esc(t("intro"))}</p>`;
    if (state.est) body += `<p><b>${esc(t("size")(state.est.mb, state.est.tiles))}</b></p>`;
    if (isIOS && !standalone) body += `<p>${esc(t("ios"))}</p>`;
    if (last && state.step === "idle") body += `<p>${esc(t("last")(when, last.version !== CFG.version))}</p>`;
    if (state.step === "saving") {
      const p = state.p || {};
      body += `<p role="status">${esc(p.phase === "tiles" ? t("tiles")(p.done, p.total) : t("pages"))}</p>
               <progress max="${p.total || 1}" value="${p.phase === "tiles" ? p.done : 0}"></progress>`;
    }
    if (state.step === "done") body += `<p role="status"><b>${esc(state.failed ? t("partial")(state.failed) : t("done"))}</b></p>`;
    if (state.step === "error") body += `<p role="alert"><b>${esc(state.msg)}</b></p>`;
    const busy = state.step === "saving";
    panel.innerHTML = `<div class="box"><h3>${esc(t("title"))}</h3>${body}
      <div class="row">
        <button type="button" class="primary" data-act="save" ${busy ? "disabled" : ""}>${esc(busy ? t("saving") : last ? t("again") : t("save"))}</button>
        ${installEvt && !standalone ? `<button type="button" data-act="install">${esc(t("install"))}</button>` : ""}
        <button type="button" data-act="close">${esc(t("close"))}</button>
      </div></div>`;
  }

  btn.addEventListener("click", async () => {
    panel.hidden = !panel.hidden;
    if (panel.hidden) return;
    if (state.step !== "saving") state = { step: "idle" };
    draw();
    state.est = await estimate().catch(() => null);
    draw();
  });

  panel.addEventListener("click", async e => {
    const act = e.target.closest("button")?.dataset.act;
    if (act === "close") { panel.hidden = true; return; }
    if (act === "install" && installEvt) { installEvt.prompt(); installEvt = null; draw(); return; }
    if (act !== "save" || state.step === "saving") return;
    if (!navigator.onLine) { state = { ...state, step: "error", msg: t("needOnline") }; draw(); return; }
    state = { ...state, step: "saving", p: null };
    draw();
    try {
      const r = await save({}, p => { state.p = p; draw(); });
      state = { ...state, step: "done", failed: r.failed };
    } catch (err) {
      state = { ...state, step: "error", msg: err?.name === "QuotaExceededError" ? t("noSpace") : String(err?.message || err) };
    }
    draw();
  });

  // The page switches language by changing <html lang>; redraw the panel and badge to match
  new MutationObserver(() => { badge(); if (!panel.hidden) draw(); })
    .observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
})();
