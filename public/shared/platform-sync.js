/* ==========================================================================
   PLATFORM SYNC  (update 38)
   Loaded in the <head> of every game page. It makes each game follow the HOME page:

     * the platform MODE (Offline / Test / Live) chosen on HOME is applied to the game the moment it opens;
     * in Live mode, once HOME's ONE shared TikTok connection is up, the game is told to connect to it
       automatically - no typing the username, no pressing Connect inside each game. (The server hands the
       game a link to the shared connection; no second TikTok connection is opened.)

   It does this with the SAME messages the game's own buttons send (captured from the game's own socket),
   and only when the platform mode / connection changes - so a host can still override a game by hand
   and nothing here fights them. A small pill at the bottom-left shows the state for a few seconds
   (add ?nobadge to the page address to hide it).

   Nothing here touches TikTok directly; state comes from GET /api/platform (+ /api/platform/stream).
   ========================================================================== */
(function () {
  "use strict";
  if (window.__platformSync) return;
  window.__platformSync = true;

  var GAME = (location.pathname.split("/")[1] || "").toLowerCase();
  var FAMILY = { blindle: 1, oracle: 1, colorblindle: 1, colordle: 1, structle: 1, textle: 1, rangedle: 1, codedle: 1, shapedle: 1 };
  var KNOWN = { flagle: 1, travle: 1, crossdle: 1, twistle: 1, findle: 1 };
  for (var k in FAMILY) KNOWN[k] = 1;
  if (!KNOWN[GAME]) return;

  var cap = { sock: null, ws: null, gs: null, testActive: null, born: Date.now() };

  /* ---------- capture the game's own socket (Socket.IO or the Blindle WebSocket) ---------- */
  function onGameEvent(name, payload) {
    if (name === "state" || name === "state:full") cap.gs = payload;
    else if (name === "testMode:status") cap.testActive = !!(payload && payload.active);
    else if (name === "diagnostics:update" && payload && payload.connection && cap.gs) cap.gs.tiktokStatus = payload.connection;
  }
  function hookSocket(s, ns) {
    if (cap.sock || !s || typeof s.on !== "function") return;
    if (String(ns || "").toLowerCase().indexOf(GAME) === -1) return;
    cap.sock = s;
    ["state", "state:full", "testMode:status", "diagnostics:update"].forEach(function (ev) {
      s.on(ev, function (p) { try { onGameEvent(ev, p); } catch (e) {} });
    });
  }
  (function wrapIo() {
    var real, wrapped;
    function wrap(f) {
      if (typeof f !== "function") return f;
      var w = function () {
        var s = f.apply(this, arguments);
        try { hookSocket(s, arguments[0]); } catch (e) {}
        return s;
      };
      Object.getOwnPropertyNames(f).forEach(function (p) {
        if (p === "length" || p === "name" || p === "prototype") return;
        try { w[p] = f[p]; } catch (e) {}
      });
      w.prototype = f.prototype;
      return w;
    }
    try {
      if ("io" in window && typeof window.io === "function") { real = window.io; wrapped = wrap(real); }
      Object.defineProperty(window, "io", {
        configurable: true,
        get: function () { return wrapped || real; },
        set: function (v) { real = v; wrapped = wrap(v); }
      });
    } catch (e) { /* the game still works; it just will not be driven automatically */ }
  })();
  (function wrapWebSocket() {
    var Native = window.WebSocket;
    if (!Native) return;
    try {
      var W = class extends Native {
        constructor(url, protocols) {
          if (protocols === undefined) super(url); else super(url, protocols);
          try {
            if (/blindle-ws/.test(String(url))) {
              cap.ws = this;
              this.addEventListener("message", function (e) {
                try { var m = JSON.parse(e.data); if (m && m.type === "state") cap.gs = m.payload; } catch (x) {}
              });
            }
          } catch (x) {}
        }
      };
      window.WebSocket = W;
    } catch (e) { /* leave the native WebSocket alone */ }
  })();

  /* ---------- helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function sockReady() { return !!(cap.sock && cap.sock.connected); }
  function emit(ev, data) { try { cap.sock.emit(ev, data); } catch (e) {} }
  function same(a, b) { return String(a || "").replace(/^@/, "").toLowerCase() === String(b || "").replace(/^@/, "").toLowerCase(); }
  function gotState(wait) { return cap.gs != null || Date.now() - cap.born > (wait || 2500); }

  /* ---------- one small adapter per game: what to send for Offline / Test / Live ---------- */
  function famSend(type, payload) {
    if (cap.ws && cap.ws.readyState === 1) cap.ws.send(JSON.stringify({ type: type, payload: payload }));
    else if (sockReady()) emit("action", { type: type, payload: payload });
  }
  var familyAdapter = {
    ready: function () { return ((cap.ws && cap.ws.readyState === 1) || sockReady()) && gotState(); },
    apply: function (mode, user) {
      var gs = cap.gs || {}, gm = gs.game && gs.game.mode, d = gs.diagnostics || {}, cs = d.connectionStatus;
      if (mode === "live") {
        if (gm !== "live") famSend("apply_settings", { mode: "live" });
        var linked = gm === "live" && (cs === "live" || cs === "connecting" || cs === "retrying") && (!d.tiktokUsername || same(d.tiktokUsername, user));
        if (!linked) famSend("connect_tiktok", { username: user });
      } else if (gm !== mode) {
        famSend("apply_settings", { mode: mode });
      }
    }
  };
  var ADAPTERS = {
    flagle: { // each browser tab has its own session on the server, so it is always (re)started
      ready: sockReady,
      apply: function (mode, user) {
        if (mode === "live") emit("connect-tiktok", { username: user });
        else emit("start-local-mode", { mode: mode });
      }
    },
    travle: { // Travle keeps its mode in the page, so drive the same controls the host would press
      ready: function () { return sockReady() && $("modeSelect") && $("tiktokConnectBtn") && $("applySettingsBtn"); },
      apply: function (mode, user) {
        var ms = $("modeSelect"), u = $("tiktokUsername");
        if (mode === "live") {
          ms.value = "live";
          if (u) u.value = user;
          $("tiktokConnectBtn").click();
        } else {
          ms.value = mode;
          $("applySettingsBtn").click();
        }
      }
    },
    crossdle: {
      ready: function () { return sockReady() && gotState(); },
      apply: function (mode, user) {
        var gs = cap.gs || {}, ts = gs.tiktokStatus || {};
        var test = cap.testActive != null ? cap.testActive : !!gs.testModeActive;
        if (mode === "live") {
          if (!(ts.state === "connected" && same(ts.username, user))) emit("tiktok:connect", { username: user });
        } else {
          if (ts.state === "connected" || ts.state === "connecting") emit("tiktok:disconnect");
          if (mode === "test" && !test) emit("testMode:start");
          if (mode === "offline" && test) emit("testMode:stop");
        }
      }
    },
    twistle: {
      ready: function () { return sockReady() && gotState(); },
      apply: function (mode, user) {
        var gs = cap.gs || {}, gm = gs.game && gs.game.mode;
        if (mode === "live") {
          if (gm !== "live") emit("host:applySettings", { mode: "live" });
          emit("host:connectTikTok", { username: user });
        } else if (gm !== mode) {
          emit("host:applySettings", { mode: mode });
        }
      }
    },
    findle: { // Findle has no Offline mode: Offline = stopped (idle)
      ready: function () { return sockReady() && gotState(); },
      apply: function (mode, user) {
        var c = (cap.gs && cap.gs.connection) || {};
        if (mode === "live") {
          if (!(c.mode === "live" && same(c.tiktokUsername, user))) emit("host:connectTikTok", { username: user });
        } else if (mode === "test") {
          if (c.mode !== "test") emit("host:toggleTestMode");
        } else {
          if (c.mode === "test") emit("host:toggleTestMode");
          else if (c.mode === "live" || c.mode === "connecting") emit("host:disconnectTikTok");
        }
      }
    }
  };
  var adapter = FAMILY[GAME] ? familyAdapter : ADAPTERS[GAME];

  /* ---------- the HOME hub state ---------- */
  var hub = null, appliedKey = null, badgeEl = null, badgeTimer = null, lastBadge = "";

  function applyIfNeeded() {
    if (!hub || !adapter) return;
    var want = hub.mode;
    if (want === "live" && hub.status !== "connected") return; // wait until the shared connection exists
    var key = want + (want === "live" ? "|" + (hub.details && hub.details.connectedAt || 0) + "|" + hub.username : "");
    if (key === appliedKey) return;
    var ok = false;
    try { ok = adapter.ready(); } catch (e) { ok = false; }
    if (!ok) return;
    try { adapter.apply(want, hub.username); } catch (e) { return; }
    appliedKey = key;
  }

  function prefill() {
    if (!hub || !hub.username) return;
    ["tiktokUsername", "tiktokUsernameBottom", "tiktok-username", "tiktokUsernameInput", "usernameInput"].forEach(function (id) {
      var el = $(id);
      if (el && !el.value) { try { el.value = hub.username; } catch (e) {} }
    });
  }

  /* ---------- tiny status pill ---------- */
  function badgeText() {
    if (!hub) return "";
    if (hub.mode === "offline") return ["📴 Offline mode · set on HOME", "off"];
    if (hub.mode === "test") return ["🧪 Test mode · set on HOME", "off"];
    if (hub.status === "connected") return ["🟢 LIVE @" + hub.username + " · shared connection", hub.health === "warn" ? "warn" : "ok"];
    if (hub.status === "connecting") return ["🟡 Connecting @" + hub.username + "…", "warn"];
    if (hub.status === "reconnecting") return ["🟠 Reconnecting @" + hub.username + "…", "warn"];
    return ["🔴 Live mode, not connected · open HOME", "bad"];
  }
  function showBadge() {
    try {
      if (/[?&]nobadge\b/.test(location.search)) return;
      try { if (localStorage.getItem("platformBadge") === "off") return; } catch (e) {}
      var t = badgeText();
      if (!t) return;
      var sig = t[0];
      if (!badgeEl) {
        badgeEl = document.createElement("a");
        badgeEl.href = "/";
        badgeEl.setAttribute("aria-label", "Platform connection - open HOME");
        badgeEl.style.cssText = "position:fixed;left:8px;bottom:8px;z-index:2147483000;font:600 12px/1.2 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;" +
          "padding:6px 11px;border-radius:999px;color:#fff;text-decoration:none;box-shadow:0 2px 8px rgba(0,0,0,.35);opacity:0;transition:opacity .4s;max-width:80vw;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
        (document.body || document.documentElement).appendChild(badgeEl);
      }
      badgeEl.textContent = sig;
      badgeEl.style.background = t[1] === "ok" ? "#2e8b4f" : t[1] === "warn" ? "#b8860b" : t[1] === "bad" ? "#b3382c" : "#5a5a66";
      if (sig === lastBadge) return;
      lastBadge = sig;
      badgeEl.style.opacity = "0.95";
      clearTimeout(badgeTimer);
      badgeTimer = setTimeout(function () { if (badgeEl) badgeEl.style.opacity = "0"; }, t[1] === "bad" ? 14000 : 6000);
    } catch (e) {}
  }

  function onHub(st) {
    if (!st || typeof st !== "object") return;
    hub = st;
    prefill();
    applyIfNeeded();
    showBadge();
    try { window.PlatformSync.state = st; } catch (e) {}
  }

  /* ---------- listen to the hub: Server-Sent Events, with polling as a safety net ---------- */
  var lastPush = 0;
  function poll() {
    if (Date.now() - lastPush < 9000) return;
    fetch("/api/platform", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (s) { if (s) onHub(s); }).catch(function () {});
  }
  function startFeed() {
    try {
      var es = new EventSource("/api/platform/stream");
      es.onmessage = function (e) { lastPush = Date.now(); try { onHub(JSON.parse(e.data)); } catch (x) {} };
    } catch (e) { /* polling below covers it */ }
    poll();
    setInterval(poll, 4000);
    setInterval(applyIfNeeded, 1000); // the game's own socket may open after the hub answered
  }
  window.PlatformSync = { state: null, game: GAME };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", startFeed); else startFeed();
})();
