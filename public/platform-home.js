/* UPDATE 38 - HOME: platform mode (Offline / Test / Live), ONE connection for every game, floating connection window.
   Talks to server/shared/platform-hub.js:  GET /api/platform, GET /api/platform/stream (SSE), POST /api/platform/{mode,connect,disconnect,retry}.
   Works alongside home.js (cards) and home-views.js (Home settings): those call PlatformHome.renderModePanel / renderCardsPanel. */
(function () {
  "use strict";
  var EK = "homeCards.editKey"; // same optional edit key as the card designer (HOME_EDIT_KEY on the server)
  var st = null, recvAt = 0, listeners = [];
  var win = null, refs = {}, minimized = false, dragPos = null, openedForLive = false, diagText = null, diagBusy = false;

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function $(id) { return document.getElementById(id); }
  function age(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    if (s < 60) return s + " s";
    var m = Math.floor(s / 60);
    return m < 60 ? m + " min " + (s % 60) + " s" : Math.floor(m / 60) + " h " + (m % 60) + " min";
  }
  function elapsed() { return Date.now() - recvAt; }

  /* ---------- talking to the server ---------- */
  function api(path, body, retried) {
    var headers = { "Content-Type": "application/json" }, key = "";
    try { key = localStorage.getItem(EK) || ""; } catch (e) {}
    if (key) headers["x-edit-key"] = key;
    return fetch(path, { method: "POST", headers: headers, body: JSON.stringify(body || {}) }).then(function (r) {
      if (r.status === 401 && !retried) {
        var k = window.prompt("This site is protected. Enter the HOME edit key to change the platform mode / connection:");
        if (k) { try { localStorage.setItem(EK, k); } catch (e) {} return api(path, body, true); }
        throw new Error("The HOME edit key is required.");
      }
      return r.json().then(function (j) { if (!r.ok) throw new Error(j && j.error ? j.error : "Request failed"); return j; });
    }).then(function (s) { if (s && s.mode) onState(s); return s; });
  }
  function onState(s) {
    st = s; recvAt = Date.now();
    paintPill(); paintWindow();
    listeners.forEach(function (fn) { try { fn(st); } catch (e) {} });
    if (!checkedAtLoad) {
      checkedAtLoad = true;
      // Opened HOME while in Live mode with nothing connected: the host has to act, so show the window once
      // (after a moment, because the server may be resuming the connection by itself after a restart).
      setTimeout(function () {
        if (st && st.mode === "live" && st.status !== "connected" && st.status !== "connecting" && st.status !== "reconnecting" && !openedForLive) {
          openedForLive = true; openWindow();
        }
      }, 3500);
    }
  }
  var checkedAtLoad = false, lastPush = 0;
  function poll() {
    if (Date.now() - lastPush < 9000) return;
    fetch("/api/platform", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (s) { if (s) onState(s); }).catch(function () {});
  }
  function startFeed() {
    try {
      var es = new EventSource("/api/platform/stream");
      es.onmessage = function (e) { lastPush = Date.now(); try { onState(JSON.parse(e.data)); } catch (x) {} };
    } catch (e) { /* polling covers it */ }
    poll(); setInterval(poll, 4000);
    setInterval(function () { if (win && !win.hidden) paintWindow(); }, 1000); // keeps "last event 5 s ago" ticking
  }

  /* ---------- the status pill in the top bar ---------- */
  var pill = null;
  function tone() {
    if (!st) return "off";
    if (st.mode === "offline") return "off";
    if (st.mode === "test") return "test";
    if (st.health === "good") return "good";
    if (st.health === "warn") return "warn";
    if (st.health === "connecting") return "run";
    if (st.health === "bad") return "bad";
    return "bad"; // live but idle
  }
  function pillText() {
    if (!st) return "…";
    if (st.mode === "offline") return "OFFLINE";
    if (st.mode === "test") return "TEST";
    if (st.status === "connected") return "LIVE @" + st.username;
    if (st.status === "connecting") return "CONNECTING…";
    if (st.status === "reconnecting") return "RECONNECTING…";
    return "LIVE · NOT CONNECTED";
  }
  function buildPill() {
    var tools = document.querySelector(".top-tools");
    if (!tools) return;
    pill = el("button", "pf-pill");
    pill.type = "button";
    pill.appendChild(el("span", "pf-lamp"));
    pill.appendChild(el("span", "pf-t", "…"));
    pill.title = "Platform mode and TikTok connection";
    pill.onclick = function () {
      if (st && st.mode === "live") openWindow();
      else if (window.HomeSettings) window.HomeSettings.open("mode");
      else openWindow();
    };
    tools.insertBefore(pill, tools.firstChild);
    // update 40: one-tap shortcut to the Records archive (also: press R, or open /records)
    var rec = el("button", "cu-open pf-records", "📜");
    rec.type = "button"; rec.title = "Records: every gift, like, milestone and who did it (press R)"; rec.setAttribute("aria-label", "Open records");
    rec.onclick = function () { if (window.HomeSettings) window.HomeSettings.open("records"); else window.location.href = "/records.html"; };
    tools.insertBefore(rec, pill.nextSibling);
  }
  function paintPill() {
    if (!pill) return;
    pill.className = "pf-pill is-" + tone();
    pill.lastChild.textContent = pillText();
    pill.setAttribute("aria-label", "Platform mode: " + pillText());
  }

  /* ---------- the floating connection window ---------- */
  function buildWindow() {
    if (win) return;
    win = el("div", "pf-win"); win.hidden = true; win.setAttribute("role", "dialog"); win.setAttribute("aria-label", "TikTok LIVE connection");
    var head = el("div", "pf-head");
    refs.hd = el("span", "pf-hd");
    var title = el("b", "", "📡 TikTok LIVE connection");
    var min = el("button", "pf-hb", "–"); min.type = "button"; min.title = "Minimize"; min.setAttribute("aria-label", "Minimize");
    var close = el("button", "pf-hb", "✕"); close.type = "button"; close.title = "Close (does not disconnect)"; close.setAttribute("aria-label", "Close");
    head.appendChild(refs.hd); head.appendChild(title); head.appendChild(el("span", "pf-sp")); head.appendChild(min); head.appendChild(close);
    var body = el("div", "pf-body");

    refs.banner = el("div", "pf-banner"); refs.bi = el("div", "pf-bi"); var bt = el("div"); refs.bh = el("div", "pf-bh"); refs.bs = el("div", "pf-bs");
    bt.appendChild(refs.bh); bt.appendChild(refs.bs); refs.banner.appendChild(refs.bi); refs.banner.appendChild(bt);

    var lab = el("label", "pf-lab", "Your TikTok username"); lab.setAttribute("for", "pfUser");
    var row = el("div", "pf-row");
    row.appendChild(el("span", "pf-at", "@"));
    refs.user = el("input", "pf-in"); refs.user.id = "pfUser"; refs.user.type = "text"; refs.user.placeholder = "yourusername";
    refs.user.autocomplete = "off"; refs.user.autocapitalize = "off"; refs.user.spellcheck = false; refs.user.setAttribute("autocorrect", "off");
    refs.connect = el("button", "pf-btn pri", "Connect"); refs.connect.type = "button";
    row.appendChild(refs.user); row.appendChild(refs.connect);

    var btns = el("div", "pf-btns");
    refs.retry = el("button", "pf-btn", "↻ Reconnect"); refs.disc = el("button", "pf-btn", "Disconnect"); refs.diag = el("button", "pf-btn", "🔍 Run check");
    [refs.retry, refs.disc, refs.diag].forEach(function (b) { b.type = "button"; btns.appendChild(b); });

    refs.reasons = el("div"); refs.reasons.style.display = "grid"; refs.reasons.style.gap = "8px";
    refs.diagOut = el("div"); refs.diagOut.hidden = true;
    var s1 = el("div", "pf-sec", "Connection checklist"); refs.checks = el("ul", "pf-checks");
    var s2 = el("div", "pf-sec", "Details"); refs.grid = el("div", "pf-grid");
    refs.attempts = el("div", "pf-small");
    refs.copy = el("button", "pf-btn", "📋 Copy report for support"); refs.copy.type = "button";
    refs.note = el("div", "pf-small", "Closing this window never disconnects. One connection here is shared by every game - open any game and it links itself.");

    [refs.banner, lab, row, btns, refs.reasons, refs.diagOut, s1, refs.checks, s2, refs.grid, refs.attempts, refs.copy, refs.note].forEach(function (n) { body.appendChild(n); });
    win.appendChild(head); win.appendChild(body); document.body.appendChild(win);

    close.onclick = function () { win.hidden = true; };
    min.onclick = function () { minimized = !minimized; win.classList.toggle("min", minimized); min.textContent = minimized ? "▢" : "–"; };
    refs.connect.onclick = doConnect;
    refs.user.addEventListener("keydown", function (e) { if (e.key === "Enter") doConnect(); });
    refs.retry.onclick = function () { busy(refs.retry, api("/api/platform/retry", {})); };
    refs.disc.onclick = function () { busy(refs.disc, api("/api/platform/disconnect", {})); };
    refs.diag.onclick = runCheck;
    refs.copy.onclick = copyReport;
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && win && !win.hidden && !document.querySelector(".hv-ov:not([hidden])")) win.hidden = true; });

    // drag by the title bar (desktop; on phones the window is a bottom sheet)
    var sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
    head.addEventListener("pointerdown", function (e) {
      if (e.target.closest("button") || window.innerWidth <= 560) return;
      dragging = true; head.classList.add("drag");
      var r = win.getBoundingClientRect(); sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
      try { head.setPointerCapture(e.pointerId); } catch (x) {}
    });
    head.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var x = Math.min(Math.max(0, ox + e.clientX - sx), window.innerWidth - 80), y = Math.min(Math.max(0, oy + e.clientY - sy), window.innerHeight - 50);
      dragPos = { x: x, y: y }; win.style.left = x + "px"; win.style.top = y + "px"; win.style.right = "auto";
    });
    function stop() { dragging = false; head.classList.remove("drag"); }
    head.addEventListener("pointerup", stop); head.addEventListener("pointercancel", stop);
  }

  function busy(btn, promise) {
    btn.disabled = true;
    promise.catch(function (e) { toast(e && e.message ? e.message : "Something went wrong."); }).then(function () { btn.disabled = false; });
  }
  function toast(msg) {
    if (!refs.reasons) return;
    var d = el("div", "pf-reason warn"); d.appendChild(el("b", "", msg)); refs.reasons.insertBefore(d, refs.reasons.firstChild);
    setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 6000);
  }
  function cleanName(v) { return String(v || "").trim().replace(/^https?:\/\/(www\.)?tiktok\.com\//i, "").replace(/^@+/, "").replace(/[\/?#].*$/, "").toLowerCase(); }
  function doConnect() {
    var name = cleanName(refs.user.value);
    if (!name) { refs.user.focus(); toast("Type your TikTok username first."); return; }
    try { if (window.PlatformSession) window.PlatformSession.setUsername(name); } catch (e) {}
    diagText = null;
    busy(refs.connect, api("/api/platform/connect", { username: name }));
  }

  var ICON = { good: "✅", warn: "⚠️", run: "⏳", bad: "❌", off: "📴", test: "🧪", idle: "🔌" };
  function paintWindow() {
    if (!win || !st) return;
    var t = tone(), h = st.health;
    refs.hd.className = "pf-hd is-" + (t === "test" ? "warn" : t);
    refs.banner.className = "pf-banner is-" + (t === "test" ? "run" : t);
    refs.bi.textContent = st.mode === "test" ? ICON.test : st.mode === "offline" ? ICON.off : (h === "idle" ? ICON.idle : ICON[t] || "•");
    refs.bh.textContent = st.headline || "";
    refs.bs.textContent = st.summary || "";

    var live = st.mode === "live";
    if (document.activeElement !== refs.user && (!refs.user.value || refs.user.dataset.auto === "1")) {
      var saved = st.username || (window.PlatformSession && window.PlatformSession.getUsername && window.PlatformSession.getUsername()) || "";
      if (saved && refs.user.value !== saved) { refs.user.value = saved; refs.user.dataset.auto = "1"; }
    }
    refs.user.oninput = function () { refs.user.dataset.auto = "0"; };
    var working = st.status === "connecting" || st.status === "reconnecting";
    refs.connect.textContent = st.status === "connected" ? "Reconnect as this" : working ? "Connecting…" : "Connect";
    refs.connect.disabled = !live || working;
    refs.retry.disabled = !live || !st.username || working;
    refs.disc.disabled = !live || st.status === "idle";
    refs.diag.disabled = !live || diagBusy;
    refs.user.disabled = !live;

    // problems with exact reasons
    refs.reasons.innerHTML = "";
    (st.reasons || []).forEach(function (r) {
      var box = el("div", "pf-reason" + (r.level === "bad" ? "" : " warn"));
      box.appendChild(el("b", "", (r.level === "bad" ? "❌ " : "⚠️ ") + r.title));
      if (r.detail) box.appendChild(el("p", "", "Why: " + r.detail));
      if (r.fix) { var f = el("p", "pf-fix", "What to do: " + r.fix); box.appendChild(f); }
      if (r.raw) box.appendChild(el("code", "", "TikTok said: " + r.raw));
      refs.reasons.appendChild(box);
    });
    if (!live) {
      var info = el("div", "pf-reason warn"); info.appendChild(el("b", "", "Switch to Live mode to connect"));
      info.appendChild(el("p", "", "The platform is in " + st.mode.toUpperCase() + " mode, so no TikTok connection is used. Open ⚙️ Home settings → Mode and choose Live."));
      var go = el("button", "pf-btn pri", "Switch to Live mode"); go.type = "button"; go.style.marginTop = "8px";
      go.onclick = function () { busy(go, setMode("live", true)); };
      info.appendChild(go); refs.reasons.appendChild(info);
    }

    // checklist
    refs.checks.innerHTML = "";
    var mark = { ok: "✓", fail: "✕", warn: "!", run: "…", wait: "–" };
    (st.checks || []).forEach(function (c) {
      var li = el("li", c.state); var ic = el("span", "pf-ci", mark[c.state] || "–");
      var tx = el("div"); tx.appendChild(el("b", "", c.label)); tx.appendChild(el("span", "", live ? c.detail : "Not used in " + st.mode + " mode."));
      li.appendChild(ic); li.appendChild(tx); refs.checks.appendChild(li);
    });

    // details
    var d = st.details || {}, grid = [];
    grid.push(["Account", d.username ? "@" + d.username : "—"]);
    grid.push(["LIVE room", d.roomId || "—"]);
    grid.push(["Viewers", d.viewers != null ? String(d.viewers) : "—"]);
    grid.push(["Connected for", d.connectedForMs != null ? age(d.connectedForMs + elapsed()) : "—"]);
    grid.push(["Last event", d.lastEventAgoMs != null ? age(d.lastEventAgoMs + elapsed()) + " ago" : "—"]);
    grid.push(["Events / minute", d.eventsPerMinute != null ? String(d.eventsPerMinute) : "—"]);
    grid.push(["Chat messages", d.chatCount != null ? String(d.chatCount) : "—"]);
    grid.push(["Reconnects (10 min)", String(d.reconnectsLast10Min || 0)]);
    grid.push(["Games linked", d.linkedCount ? d.linkedCount + (d.linkedGames && d.linkedGames.length ? " (" + d.linkedGames.join(", ") + ")" : "") : "0"]);
    grid.push(["Signing key", st.keyConfigured ? "set" : "MISSING"]);
    refs.grid.innerHTML = "";
    grid.forEach(function (g) { var c = el("div"); c.appendChild(el("small", "", g[0])); c.appendChild(el("b", "", g[1])); refs.grid.appendChild(c); });

    refs.attempts.textContent = "";
    if (st.attemptLog && st.attemptLog.length && (st.status === "connecting" || st.status === "failed")) {
      refs.attempts.textContent = "Tries so far: " + st.attemptLog.map(function (a) { return "#" + a.n + " " + a.title; }).join("  ·  ");
    }
    // result of "Run check"
    refs.diagOut.hidden = !diagText;
    refs.diagOut.innerHTML = "";
    if (diagText) {
      refs.diagOut.className = "pf-diag";
      refs.diagOut.appendChild(el("b", "", "🔍 Check result"));
      var ul = el("ul"); diagText.forEach(function (l) { ul.appendChild(el("li", "", l)); }); refs.diagOut.appendChild(ul);
    }
  }

  function runCheck() {
    var name = cleanName(refs.user.value) || (st && st.username);
    if (!name) { toast("Type the username first."); return; }
    diagBusy = true; refs.diag.disabled = true; diagText = ["Checking what the server can see…"]; paintWindow();
    fetch("/api/tiktok-health?user=" + encodeURIComponent(name), { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
      var lines = [];
      (j.hints || []).forEach(function (h) { lines.push(h); });
      if (j.stats) lines.push("Server has made " + j.stats.lookups + " room lookups, " + j.stats.retries + " retries" + (j.stats.lastError ? "; last error: " + j.stats.lastError : "."));
      diagText = lines.length ? lines : ["Nothing to report."];
    }).catch(function () { diagText = ["Could not reach the server for the check. Is the site still running?"]; }).then(function () { diagBusy = false; paintWindow(); });
  }

  function copyReport() {
    if (!st) return;
    var lines = ["TikTok LIVE platform report", "Mode: " + st.mode, "Status: " + st.status + " (" + st.health + ")", "Headline: " + st.headline, "Account: " + (st.username || "-")];
    (st.checks || []).forEach(function (c) { lines.push(" - " + c.label + ": " + c.state + " - " + c.detail); });
    (st.reasons || []).forEach(function (r) { lines.push("PROBLEM: " + r.title + " | why: " + r.detail + " | fix: " + r.fix + (r.raw ? " | tiktok said: " + r.raw : "")); });
    var text = lines.join("\n");
    function done() { refs.copy.textContent = "✓ Copied"; setTimeout(function () { refs.copy.textContent = "📋 Copy report for support"; }, 1800); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(fallback); else fallback();
    function fallback() {
      var ta = el("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (e) { window.prompt("Copy this report:", text); }
      document.body.removeChild(ta);
    }
  }

  function openWindow() {
    buildWindow();
    win.hidden = false; minimized = false; win.classList.remove("min");
    if (dragPos && window.innerWidth > 560) { win.style.left = dragPos.x + "px"; win.style.top = dragPos.y + "px"; win.style.right = "auto"; }
    paintWindow();
    setTimeout(function () {
      try { if (st && st.mode === "live" && st.status !== "connected" && !refs.user.disabled) { refs.user.focus(); refs.user.select(); } } catch (e) {}
    }, 80);
  }

  /* ---------- mode switching ---------- */
  function setMode(mode, fromPanel) {
    return api("/api/platform/mode", { mode: mode }).then(function (s) {
      if (mode === "live") {
        if (window.HomeSettings && fromPanel) window.HomeSettings.close();
        openedForLive = true;
        openWindow(); // choosing Live opens the floating window straight away
      }
      return s;
    });
  }

  /* ---------- panels shown inside ⚙️ Home settings ---------- */
  var MODE_INFO = [
    ["offline", "📴", "Offline", "No TikTok. You type the guesses yourself on the game screen. Scores are not saved."],
    ["test", "🧪", "Test", "No TikTok. Every game simulates chat by itself so you can rehearse. Scores are not saved."],
    ["live", "🔴", "Live", "Reads your real TikTok LIVE chat. ONE connection made here is shared by every game - no connecting inside each game."]
  ];
  function renderModePanel(m) {
    m.innerHTML = "";
    var help = el("p", "hv-help", "Choose how ALL games run. Games follow this by themselves the moment you open them (you can still change one game by hand inside it).");
    m.appendChild(help);
    var box = el("div", "pf-modes"); m.appendChild(box);
    var sum = el("div", "pf-sum"); m.appendChild(sum);
    var open = el("button", "pf-bigbtn", "📡 Open the connection window"); open.type = "button";
    open.onclick = function () { if (window.HomeSettings) window.HomeSettings.close(); openWindow(); };
    m.appendChild(open);

    function paint() {
      box.innerHTML = "";
      MODE_INFO.forEach(function (i) {
        var b = el("button", "pf-mode" + (st && st.mode === i[0] ? " on" : "")); b.type = "button";
        b.appendChild(el("span", "pf-mi", i[1]));
        var tx = el("span"); tx.appendChild(el("b", "", i[2])); tx.appendChild(el("small", "", i[3])); b.appendChild(tx);
        b.onclick = function () {
          if (st && st.mode === i[0]) { if (i[0] === "live") { if (window.HomeSettings) window.HomeSettings.close(); openWindow(); } return; }
          b.disabled = true;
          setMode(i[0], true).catch(function (e) { window.alert(e && e.message ? e.message : "Could not change the mode."); }).then(function () { b.disabled = false; });
        };
        box.appendChild(b);
      });
      sum.className = "pf-sum is-" + (tone() === "test" ? "run" : tone());
      sum.textContent = st ? (ICON[tone()] || "•") + "  " + (st.headline || "") + (st.summary ? " - " + st.summary : "") : "Loading…";
      open.hidden = !(st && st.mode === "live");
    }
    paint();
    var fn = function () { if (!box.isConnected) { var i = listeners.indexOf(fn); if (i > -1) listeners.splice(i, 1); return; } paint(); };
    listeners.push(fn);
  }

  function renderCardsPanel(m) {
    m.innerHTML = "";
    m.appendChild(el("p", "hv-help", "Change how each game card looks on this page: colors, border, corners, fonts, text, order, and which cards are hidden."));
    var b = el("button", "pf-bigbtn", "🎛️ Customize Game Cards"); b.type = "button";
    b.onclick = function () {
      if (window.HomeSettings) window.HomeSettings.close();
      var old = $("cuOpen"); // the original customizer (home.js) - its own button now lives here
      if (old) old.click();
    };
    m.appendChild(b);
  }

  /* ---------- start ---------- */
  function init() {
    var old = $("cuOpen"); // the old top-bar button: its job moved into ⚙️ Home settings → Cards
    if (old) { old.style.display = "none"; old.setAttribute("aria-hidden", "true"); old.tabIndex = -1; }
    buildPill();
    startFeed();
  }
  window.PlatformHome = {
    get state() { return st; },
    openWindow: openWindow, setMode: setMode,
    renderModePanel: renderModePanel, renderCardsPanel: renderCardsPanel,
    onChange: function (fn) { listeners.push(fn); if (st) fn(st); }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
