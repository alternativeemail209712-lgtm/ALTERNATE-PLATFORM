/* ==========================================================================
   SCORE TICKER  (update 47) - the scrolling "top scorers" news ticker, for every game.

   * Games WITHOUT their own ticker (BLINDLE, ORACLE, COLORBLINDLE, COLORDLE, STRUCTLE, TEXTLE, RANGEDLE,
     CODEDLE, SHAPEDLE, TWISTLE) get one from here. It is a normal block placed right UNDER the game's top
     bar (never position:fixed / absolute), so it pushes the page down instead of covering anything, keeps
     its own fixed height and clips its own content. The games call  ScoreTicker.update(state)  whenever
     their state changes; nothing else is needed.
   * Games that already had a ticker (FLAGLE, TRAVLE, CROSSDLE, FINDLE) keep theirs - the same settings
     below (on/off, speed, text size, profile pictures) are applied to it too.
   * Settings: every game's Settings drawer gets a "Scrolling top-scorers ticker" section (inserted above
     "Live event tools"). They are remembered on this device and shared by all games (same pattern as
     TileFit), and take effect immediately - also in other open tabs / windows of the platform.

   Settings (all optional, defaults in DEFAULTS):
     enabled, source (total | round), count, speed (px per second), size (text px), avatars, points,
     label, accent (colour), hideEmpty.   Games with their own ticker ignore source / count / points / label /
     accent (those controls are hidden there).
   ========================================================================== */
(function () {
  "use strict";
  if (window.ScoreTicker) return;

  var KEY = "platform.scoreTicker.v1";
  var DEFAULTS = {
    enabled: true,
    source: "total",      // "total" = all-time leaderboard, "round" = this round's leaderboard
    count: 10,
    speed: 60,            // px per second
    size: 14,             // text size in px
    avatars: true,
    points: true,
    label: "🏆 Top scorers",
    accent: "",           // "" = built-in gold
    hideEmpty: false
  };
  // For games that already own a ticker: only apply a value if the host actually changed it.
  var EXISTING_SELECTORS = "#ticker-wrap, #tickerBar, #leaderboardTicker, .ticker-wrap";

  function load() {
    var s = {}, k;
    try { s = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { s = {}; }
    var out = {};
    for (k in DEFAULTS) out[k] = DEFAULTS[k];
    for (k in s) if (k in DEFAULTS && typeof s[k] === typeof DEFAULTS[k]) out[k] = s[k];
    out.touched = {};
    for (k in s) if (k in DEFAULTS) out.touched[k] = true;
    out.count = clampInt(out.count, 3, 10);
    out.speed = clampInt(out.speed, 20, 200);
    out.size = clampInt(out.size, 10, 24);
    out.label = String(out.label).slice(0, 40);
    out.source = out.source === "round" ? "round" : "total";
    if (!/^#[0-9a-fA-F]{6}$/.test(out.accent)) out.accent = "";
    return out;
  }
  function clampInt(v, lo, hi) { v = Math.round(Number(v)); if (!isFinite(v)) v = lo; return Math.min(hi, Math.max(lo, v)); }
  function save(patch) {
    var cur = {};
    try { cur = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { cur = {}; }
    for (var k in patch) cur[k] = patch[k];
    try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch (e) { /* storage blocked: still works for this page view */ memo = cur; }
    settings = load();
    if (memo) { for (var m in memo) if (m in DEFAULTS) { settings[m] = memo[m]; settings.touched[m] = true; } }
  }
  var memo = null;
  var settings = load();

  var state = { total: [], round: [] };
  var bar = null, labelEl = null, viewport = null, track = null;
  var lastSig = "", lastBarH = -1, existing = false, resizeTimer = null;

  /* ---------------- styles ---------------- */
  var STYLE_ID = "score-ticker-style";
  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent =
      "@keyframes stk-scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}" +
      ".stk-bar{position:relative;display:flex;align-items:center;gap:10px;flex:0 0 auto;width:100%;max-width:100%;" +
      "box-sizing:border-box;margin:0;padding:5px 0 5px 12px;overflow:hidden;z-index:auto;contain:layout paint;" +
      "background:rgba(127,127,127,.16);border-bottom:1px solid rgba(127,127,127,.38);color:inherit;" +
      "font-family:inherit;font-size:var(--stk-fs,14px);line-height:1.25;white-space:nowrap}" +
      ".stk-bar[hidden]{display:none!important}" +
      ".stk-label{flex:0 0 auto;font-weight:800;font-size:.8em;letter-spacing:.4px;color:var(--stk-accent,#d99a00);" +
      "padding-right:10px;border-right:1px solid rgba(127,127,127,.4);max-width:45%;overflow:hidden;text-overflow:ellipsis}" +
      ".stk-label:empty{display:none}" +
      ".stk-viewport{flex:1 1 auto;min-width:0;overflow:hidden;white-space:nowrap}" +
      ".stk-track{display:inline-flex;width:max-content;align-items:center;will-change:transform}" +
      ".stk-bar:hover .stk-track,.stk-bar:active .stk-track{animation-play-state:paused!important}" +
      ".stk-item{display:inline-flex;align-items:center;gap:.4em;margin-right:2.2em;font-weight:700;white-space:nowrap}" +
      ".stk-rank{color:var(--stk-accent,#d99a00);font-weight:800}" +
      ".stk-pts{opacity:.8;font-weight:700;margin-left:.15em}" +
      ".stk-empty{font-weight:600;opacity:.75}" +
      ".stk-av{flex:none;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;overflow:hidden;" +
      "color:#fff;font-weight:800;font-size:.7em;text-transform:uppercase;vertical-align:middle}" +
      ".stk-av img{width:100%;height:100%;object-fit:cover;display:block}" +
      ".stk-bar.stk-noav .stk-av{display:none}" +
      "@media (prefers-reduced-motion:reduce){.stk-track{animation:none!important}.stk-viewport{overflow-x:auto}}" +
      /* games that keep their own ticker */
      "html.stk-off #ticker-wrap,html.stk-off #tickerBar,html.stk-off #leaderboardTicker,html.stk-off .ticker-wrap{display:none!important}" +
      "html.stk-fs .ticker-track,html.stk-fs .ticker-item,html.stk-fs .ticker-entry{font-size:var(--stk-fs)!important}" +
      "html.stk-noav .ticker-track .avatarChip,html.stk-noav .ticker-item .avatarChip,html.stk-noav .ticker-entry .avatarChip{display:none!important}" +
      /* settings block */
      ".stk-set{display:flex;flex-direction:column;gap:10px;margin:14px 0;padding-top:12px;border-top:2px dashed rgba(127,127,127,.4);color:inherit;font-family:inherit}" +
      ".stk-set h4{margin:0;font-size:13px;letter-spacing:.04em;text-transform:uppercase;opacity:.85}" +
      ".stk-set .stk-note{margin:0;font-size:11.5px;line-height:1.5;opacity:.7;font-weight:500}" +
      ".stk-row{display:flex;flex-direction:column;gap:5px}" +
      ".stk-row>label,.stk-check{font-size:13px;font-weight:600}" +
      ".stk-check{display:flex;align-items:center;gap:8px;cursor:pointer}" +
      ".stk-check input{width:18px;height:18px;flex:none}" +
      ".stk-set select,.stk-set input[type=text]{font:inherit;font-size:14px;color:inherit;background:rgba(127,127,127,.15);" +
      "border:1px solid rgba(127,127,127,.5);border-radius:10px;padding:8px 10px;outline:none;width:100%;box-sizing:border-box}" +
      ".stk-set select option{color:#222;background:#fff}" +
      ".stk-set input[type=range]{width:100%}" +
      ".stk-set input[type=color]{width:46px;height:34px;padding:0;border:1px solid rgba(127,127,127,.5);border-radius:8px;background:none;cursor:pointer}" +
      ".stk-inline{display:flex;align-items:center;gap:10px}" +
      ".stk-btn{font:inherit;font-size:13px;font-weight:700;color:inherit;background:rgba(127,127,127,.18);border:1px solid rgba(127,127,127,.5);" +
      "border-radius:10px;padding:8px 12px;cursor:pointer}" +
      ".stk-val{font-weight:700;opacity:.85}";
    document.head.appendChild(st);
  }

  /* ---------------- helpers ---------------- */
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  var PALETTE = ["#e0699c", "#4fa0c4", "#6faa5c", "#e0a934", "#9c6fd1", "#e0724a", "#3aa6a6", "#c4577a"];
  function hash(str) { var h = 0; for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h; }
  function avatarHtml(name, url, px) {
    var ini = esc((String(name || "").trim()[0] || "?").toUpperCase());
    var col = PALETTE[hash(String(name || "?")) % PALETTE.length];
    var style = "width:" + px + "px;height:" + px + "px;background:" + col;
    var u = url ? String(url) : "";
    if (u && (/^(https?:)?\/\//.test(u) || u.charAt(0) === "/")) {
      return '<span class="stk-av" style="' + style + '"><img alt="" referrerpolicy="no-referrer" src="' + esc(url) + '" ' +
        "onerror=\"this.remove()\"/>" + "</span>";
    }
    return '<span class="stk-av" style="' + style + '">' + ini + "</span>";
  }
  var MEDALS = ["🥇", "🥈", "🥉"];

  /* ---------------- the ticker bar (games without their own) ---------------- */
  function findHeader() {
    return document.querySelector("header.topbar") || document.querySelector("header.app-header") ||
      document.querySelector("header") || document.querySelector(".topbar");
  }

  function build() {
    if (document.querySelector(EXISTING_SELECTORS)) { existing = true; return; }
    var header = findHeader();
    if (!header || !header.parentNode) return;
    bar = document.createElement("div");
    bar.className = "stk-bar";
    bar.id = "scoreTickerBar";
    bar.setAttribute("role", "marquee");
    bar.setAttribute("aria-label", "Top scorers");
    bar.hidden = true;
    bar.innerHTML = '<span class="stk-label"></span><div class="stk-viewport"><div class="stk-track"></div></div>';
    header.insertAdjacentElement("afterend", bar);
    labelEl = bar.querySelector(".stk-label");
    viewport = bar.querySelector(".stk-viewport");
    track = bar.querySelector(".stk-track");
    if (window.ResizeObserver) {
      var lastW = 0;
      new ResizeObserver(function () {
        var w = viewport.clientWidth;
        if (Math.abs(w - lastW) < 2) return;
        lastW = w; lastSig = ""; render();
      }).observe(viewport);
    }
  }

  function pokeLayout() {
    // Games size their boards from the space that is left, so tell them when the bar appears / disappears / grows.
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      try { window.dispatchEvent(new Event("resize")); } catch (e) {}
    }, 30);
  }

  function render() {
    var root = document.documentElement;
    /* page-level classes for games that keep their own ticker */
    root.classList.toggle("stk-off", !settings.enabled);
    root.classList.toggle("stk-noav", !settings.avatars);
    var fsOn = existing && settings.touched.size;
    root.classList.toggle("stk-fs", !!fsOn);
    root.style.setProperty("--stk-fs", settings.size + "px");
    if (existing) { applyExistingSpeed(); return; }
    if (!bar) return;

    bar.style.setProperty("--stk-fs", settings.size + "px");
    if (settings.accent) bar.style.setProperty("--stk-accent", settings.accent); else bar.style.removeProperty("--stk-accent");
    bar.classList.toggle("stk-noav", !settings.avatars);

    var list = (settings.source === "round" ? state.round : state.total) || [];
    list = list.slice(0, settings.count);

    var shouldShow = settings.enabled && !(settings.hideEmpty && list.length === 0);
    if (bar.hidden === shouldShow) { bar.hidden = !shouldShow; }
    if (!shouldShow) { afterChange(); return; }

    labelEl.textContent = settings.label;

    var sig = JSON.stringify([list.map(function (e) { return [e.username, e.score, e.avatarUrl || ""]; }),
      settings.size, settings.avatars, settings.points, settings.label, settings.source, settings.count, viewport.clientWidth]);
    if (sig === lastSig) { setDuration(); afterChange(); return; }
    lastSig = sig;

    if (!list.length) {
      track.style.animation = "none";
      track.innerHTML = '<span class="stk-item stk-empty">Waiting for the first score…</span>';
      afterChange();
      return;
    }
    var av = Math.round(settings.size * 1.35);
    var unit = list.map(function (e, i) {
      var pts = settings.points ? '<span class="stk-pts">' + esc(e.score) + (e.score === 1 ? " pt" : " pts") + "</span>" : "";
      return '<span class="stk-item"><span class="stk-rank">' + (MEDALS[i] || (i + 1) + ".") + "</span>" +
        avatarHtml(e.username, e.avatarUrl, av) + "<span>" + esc(e.username) + "</span>" + pts + "</span>";
    }).join("");
    // measure one copy, then repeat it until a copy is at least as wide as the bar (so there is never a gap)
    track.style.animation = "none";
    track.innerHTML = unit;
    var w1 = track.scrollWidth || 1;
    var vw = viewport.clientWidth || 0;
    var k = Math.max(1, Math.ceil(vw / w1));
    var copy = new Array(k + 1).join(unit);
    track.innerHTML = copy + copy;
    setDuration();
    afterChange();
  }

  function setDuration() {
    if (!track || !track.firstChild || track.querySelector(".stk-empty")) return;
    var dist = track.scrollWidth / 2;
    if (!dist) return;
    var secs = Math.max(4, dist / settings.speed);
    track.style.animation = "stk-scroll " + secs.toFixed(2) + "s linear infinite";
  }

  function afterChange() {
    var h = bar && !bar.hidden ? bar.offsetHeight : 0;
    if (h !== lastBarH) { lastBarH = h; pokeLayout(); }
  }

  /* ---------------- speed for games that keep their own ticker ---------------- */
  var existingObs = [];
  function applyExistingSpeed() {
    var tracks = document.querySelectorAll(".ticker-track");
    for (var i = 0; i < tracks.length; i++) {
      (function (t) {
        if (!t.__stkObs && window.MutationObserver) {
          t.__stkObs = new MutationObserver(function () { setExistingDuration(t); });
          t.__stkObs.observe(t, { childList: true, characterData: true, subtree: true });
          existingObs.push(t.__stkObs);
        }
        setExistingDuration(t);
      })(tracks[i]);
    }
  }
  function setExistingDuration(t) {
    if (!settings.touched.speed) { t.style.removeProperty("animation-duration"); return; }
    var single = t.id === "ticker-track"; // FLAGLE scrolls one copy; the others scroll two copies (-50%)
    var w = single ? t.offsetWidth : t.scrollWidth / 2;
    if (!w) return;
    var secs = Math.max(4, w / settings.speed);
    t.style.setProperty("animation-duration", secs.toFixed(2) + "s", "important");
  }

  /* ---------------- settings section (inserted in every game's Settings drawer) ---------------- */
  function buildSettings() {
    var tools = document.querySelector("[data-engagement-tools]");
    if (!tools || document.getElementById("stkSettings")) return;
    var ref = tools.closest(".drawerSection") || tools;
    while (ref.previousElementSibling && ref.previousElementSibling.matches("h1,h2,h3,h4,hr,.settings-subhead,.settings-divider")) {
      ref = ref.previousElementSibling;
    }
    var box = document.createElement("div");
    box.className = "stk-set";
    box.id = "stkSettings";
    var own = !existing;
    box.innerHTML =
      "<h4>Scrolling top-scorers ticker</h4>" +
      '<p class="stk-note">' + (own
        ? "The strip under the top bar that scrolls the best players. Changes apply right away and are remembered on this device, for all games."
        : "This game's scrolling top-scorers strip. Changes apply right away and are remembered on this device, for all games.") + "</p>" +
      '<label class="stk-check"><input type="checkbox" data-k="enabled"> Show the scrolling ticker</label>' +
      (own ? '<div class="stk-row"><label>Who it shows</label><select data-k="source">' +
        '<option value="total">All-time leaders</option><option value="round">This round\'s leaders</option></select></div>' : "") +
      (own ? '<div class="stk-row"><label>Number of players</label><select data-k="count">' +
        '<option value="3">Top 3</option><option value="5">Top 5</option><option value="10">Top 10</option></select></div>' : "") +
      '<div class="stk-row"><label>Scroll speed: <span class="stk-val" data-v="speed"></span></label>' +
        '<input type="range" data-k="speed" min="20" max="200" step="5"></div>' +
      '<div class="stk-row"><label>Text size: <span class="stk-val" data-v="size"></span></label>' +
        '<input type="range" data-k="size" min="10" max="24" step="1"></div>' +
      '<label class="stk-check"><input type="checkbox" data-k="avatars"> Show profile pictures</label>' +
      (own ? '<label class="stk-check"><input type="checkbox" data-k="points"> Show points</label>' : "") +
      (own ? '<label class="stk-check"><input type="checkbox" data-k="hideEmpty"> Hide the ticker until someone has scored</label>' : "") +
      (own ? '<div class="stk-row"><label>Label</label><input type="text" data-k="label" maxlength="40" placeholder="🏆 Top scorers"></div>' : "") +
      (own ? '<div class="stk-row"><label>Accent colour (label and ranks)</label><div class="stk-inline">' +
        '<input type="color" data-k="accent"><button type="button" class="stk-btn" data-act="accent-reset">Default</button></div></div>' : "") +
      '<div><button type="button" class="stk-btn" data-act="reset">Reset ticker settings</button></div>';
    ref.parentNode.insertBefore(box, ref);

    function sync() {
      var inputs = box.querySelectorAll("[data-k]");
      for (var i = 0; i < inputs.length; i++) {
        var el = inputs[i], k = el.getAttribute("data-k");
        if (el.type === "checkbox") el.checked = !!settings[k];
        else if (k === "accent") el.value = settings.accent || "#d99a00";
        else if (document.activeElement !== el) el.value = String(settings[k]);
      }
      var vs = box.querySelectorAll("[data-v]");
      for (var j = 0; j < vs.length; j++) {
        var kk = vs[j].getAttribute("data-v");
        vs[j].textContent = kk === "speed" ? settings.speed + " px/s" : settings.size + " px";
      }
    }
    box.addEventListener("input", function (e) { onEdit(e.target); });
    box.addEventListener("change", function (e) { onEdit(e.target); });
    function onEdit(el) {
      var k = el.getAttribute && el.getAttribute("data-k");
      if (!k) return;
      var v;
      if (el.type === "checkbox") v = el.checked;
      else if (k === "count" || k === "speed" || k === "size") v = Number(el.value);
      else v = el.value;
      var patch = {}; patch[k] = v;
      save(patch);
      lastSig = "";
      render(); sync();
    }
    box.addEventListener("click", function (e) {
      var act = e.target.getAttribute && e.target.getAttribute("data-act");
      if (act === "reset") { try { localStorage.removeItem(KEY); } catch (x) {} memo = null; settings = load(); }
      else if (act === "accent-reset") { save({ accent: "" }); }
      else return;
      lastSig = ""; render(); sync();
    });
    window.addEventListener("storage", function (e) {
      if (e.key !== KEY) return;
      settings = load(); lastSig = ""; render(); sync();
    });
    sync();
  }

  /* ---------------- public API ---------------- */
  function normalise(list) {
    if (!Array.isArray(list)) return null;
    return list.map(function (r) {
      return { username: String((r && (r.username || r.name)) || "viewer"), score: Number((r && (r.score != null ? r.score : r.points)) || 0), avatarUrl: (r && r.avatarUrl) || null };
    });
  }
  function update(s) {
    if (!s || typeof s !== "object") return;
    var t = normalise(s.totalLeaderboard), r = normalise(s.roundLeaderboard);
    var changed = false;
    if (t) { state.total = t; changed = true; }
    if (r) { state.round = r; changed = true; }
    if (changed) { try { render(); } catch (e) {} }
  }

  function init() {
    injectStyle();
    build();
    buildSettings();
    render();
    // storage events from other tabs even when the settings drawer is not on this page
    window.addEventListener("storage", function (e) {
      if (e.key === KEY) { settings = load(); lastSig = ""; render(); }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

  window.ScoreTicker = { update: update, settings: function () { return settings; } };
})();
