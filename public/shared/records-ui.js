/* UPDATE 40 - RECORDS ARCHIVE screen (shared).
   One script, three places: the full page /records, the HOME ⚙️ settings "📜 Records" tab, and (as a button) every game's Settings.
   Usage:  RecordsUI.mount(containerElement)   - fills the element with the whole archive viewer.
   Talks to server/shared/records-store.js (GET /api/records, /summary, /meta, /viewers, /viewer/:name, /export; POST /import, /clear, /settings). */
(function () {
  "use strict";
  if (window.RecordsUI) return;

  var EK = "homeCards.editKey"; // same optional edit key as the rest of HOME (HOME_EDIT_KEY on the server)
  var ICON = { gift: "🎁", gift_milestone: "💰", like_milestone: "👍", share: "🔥", share_milestone: "📣", likes: "❤️", follow: "➕", subscribe: "⭐", room_like_milestone: "🌟", room_share_milestone: "🌟", room_gift_milestone: "🌟" };
  var GROUPS = [
    ["gift,gift_milestone,room_gift_milestone", "🎁 Gifts"],
    ["likes,like_milestone,room_like_milestone", "❤️ Likes"],
    ["like_milestone,share_milestone,gift_milestone,room_like_milestone,room_share_milestone,room_gift_milestone", "🏆 Milestones"],
    ["share,share_milestone,room_share_milestone", "🔥 Shares"],
    ["follow,subscribe", "➕ Follows & subs"]
  ];
  var GAME_NAMES = { flagle: "Flagle", travle: "TRAVLE", blindle: "Blindle", findle: "Findle", crossdle: "CROSSDLE", twistle: "TWISTLE", oracle: "Oracle", colorblindle: "Colorblindle", colordle: "Colordle", structle: "Structle", textle: "Textle", rangedle: "Rangedle", codedle: "Codedle", shapedle: "Shapedle", test: "Test button" };

  var CSS = [
    ".rx{font-family:'Quicksand','Manrope',system-ui,sans-serif;color:var(--theme-ink,#5b4636);text-align:left;font-size:14px;line-height:1.35}",
    ".rx *{box-sizing:border-box}",
    ".rx button,.rx select,.rx input{font:inherit}",
    ".rx-tabs{display:flex;gap:6px;overflow-x:auto;margin:0 0 10px;scrollbar-width:none}",
    ".rx-tab{flex:none;cursor:pointer;border:2px dashed var(--theme-line,#d9be93);background:var(--theme-card,#fffbf2);color:var(--theme-deep,#6b4423);border-radius:12px;padding:8px 14px;font-weight:800;min-height:40px}",
    ".rx-tab.on{background:var(--theme-deep,#6b4423);color:#fff;border-style:solid}",
    ".rx-bar{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 8px;align-items:center}",
    ".rx-chip{cursor:pointer;border:2px solid var(--theme-line,#d9be93);background:var(--theme-card,#fffbf2);color:var(--theme-deep,#6b4423);border-radius:999px;padding:5px 11px;font-weight:700;font-size:12.5px;min-height:34px}",
    ".rx-chip.on{background:var(--theme-deep,#6b4423);border-color:var(--theme-deep,#6b4423);color:#fff}",
    ".rx-sel,.rx-in{border:2px solid var(--theme-line,#d9be93);background:var(--theme-card,#fffbf2);color:var(--theme-ink,#5b4636);border-radius:10px;padding:6px 9px;min-height:36px;max-width:100%}",
    ".rx-in.q{flex:1 1 150px;min-width:120px}",
    ".rx-lbl{font-size:11.5px;font-weight:800;opacity:.75;margin:4px 0 2px}",
    ".rx-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin:6px 0 12px}",
    ".rx-card{background:var(--theme-surface-2,#f2e4c8);border:1px solid var(--theme-line,#d9be93);border-radius:12px;padding:9px 10px}",
    ".rx-card b{display:block;font-size:20px;font-weight:800;color:var(--theme-deep,#6b4423)}",
    ".rx-card span{font-size:11.5px;font-weight:700;opacity:.8}",
    ".rx-box{background:var(--theme-surface-2,#f2e4c8);border:1px solid var(--theme-line,#d9be93);border-radius:12px;padding:10px 12px;margin:0 0 10px}",
    ".rx-box h4{margin:0 0 6px;font-size:13px;color:var(--theme-deep,#6b4423);font-weight:800}",
    ".rx-two{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px}",
    ".rx-hour{display:flex;align-items:flex-end;gap:2px;height:72px}",
    ".rx-hour i{flex:1;background:var(--theme-deep,#6b4423);border-radius:3px 3px 0 0;min-height:2px;opacity:.85}",
    ".rx-hlab{display:flex;justify-content:space-between;font-size:10.5px;opacity:.7;font-weight:700;margin-top:2px}",
    ".rx-lrow{display:flex;gap:8px;align-items:center;padding:4px 0;border-bottom:1px dashed var(--theme-line,#d9be93);font-weight:600}",
    ".rx-lrow:last-child{border-bottom:0}",
    ".rx-lrow .n{text-align:left;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
    ".rx-lrow b{color:var(--theme-deep,#6b4423)}",
    ".rx-link{cursor:pointer;color:var(--theme-deep,#6b4423);font-weight:800;text-decoration:underline;background:none;border:0;padding:0}",
    ".rx-row{display:flex;gap:10px;align-items:flex-start;background:var(--theme-card,#fffbf2);border:1px solid var(--theme-line,#d9be93);border-radius:12px;padding:9px 10px;margin:0 0 6px}",
    ".rx-ic{flex:none;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:19px;background:linear-gradient(145deg,var(--a,#ffd76a),var(--b,#e0245e))}",
    ".rx-main{min-width:0;flex:1}",
    ".rx-t{font-weight:800}",
    ".rx-tags{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}",
    ".rx-tag{font-size:10.5px;font-weight:800;border-radius:999px;padding:2px 8px;background:var(--theme-surface-2,#f2e4c8);border:1px solid var(--theme-line,#d9be93)}",
    ".rx-tag.hot{background:#ffe9a8;border-color:#e0a409;color:#5b3d00}",
    ".rx-when{font-size:11.5px;opacity:.8;margin-top:3px;font-weight:600}",
    ".rx-btn{cursor:pointer;border:2px solid var(--theme-deep,#6b4423);background:var(--theme-deep,#6b4423);color:#fff;border-radius:12px;padding:8px 14px;font-weight:800;min-height:40px}",
    ".rx-btn.alt{background:var(--theme-card,#fffbf2);color:var(--theme-deep,#6b4423)}",
    ".rx-btn.bad{background:#b3261e;border-color:#b3261e}",
    ".rx-more{display:block;margin:8px auto}",
    ".rx-empty{text-align:center;padding:22px 10px;opacity:.75;font-weight:700}",
    ".rx-note{font-size:12px;opacity:.85;margin:0 0 8px}",
    ".rx-warn{background:#fff1cc;border:1px solid #e0a409;color:#5b3d00;border-radius:10px;padding:8px 10px;font-size:12.5px;font-weight:600;margin:0 0 10px}",
    ".rx-tbl{width:100%;border-collapse:collapse;font-size:13px}",
    ".rx-tbl th{cursor:pointer;text-align:right;font-size:11px;padding:5px 4px;color:var(--theme-deep,#6b4423);white-space:nowrap}",
    ".rx-tbl th:first-child,.rx-tbl td:first-child{text-align:left}",
    ".rx-tbl td{text-align:right;padding:6px 4px;border-top:1px dashed var(--theme-line,#d9be93);font-weight:600}",
    ".rx-tbl th.on{text-decoration:underline}",
    ".rx-scroll{overflow-x:auto}",
    ".rx-grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}"
  ].join("\n");
  function injectCss() {
    if (document.getElementById("rx-css")) return;
    var s = document.createElement("style"); s.id = "rx-css"; s.textContent = CSS; document.head.appendChild(s);
  }

  function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function nf(n) { return Number(n || 0).toLocaleString("en-US"); }
  function gname(g) { return GAME_NAMES[g] || g || "—"; }
  function dur(sec) {
    sec = Math.max(0, Math.round(sec));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return (h ? h + "h " : "") + (m || h ? m + "m " : "") + s + "s";
  }
  function dt(ts) {
    var d = new Date(ts);
    return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" }) + " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", second: "2-digit" });
  }
  function ago(ts) {
    var s = (Date.now() - ts) / 1000;
    if (s < 60) return "just now";
    if (s < 3600) return Math.round(s / 60) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + " h ago";
    return Math.round(s / 86400) + " d ago";
  }
  function qs(o) {
    var a = [];
    Object.keys(o).forEach(function (k) { if (o[k] !== "" && o[k] != null && o[k] !== 0) a.push(encodeURIComponent(k) + "=" + encodeURIComponent(o[k])); });
    return a.join("&");
  }
  function getJSON(url) { return fetch(url, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); }); }
  function post(path, body, retried) {
    var headers = { "Content-Type": "application/json" }, key = "";
    try { key = localStorage.getItem(EK) || ""; } catch (e) {}
    if (key) headers["x-edit-key"] = key;
    return fetch(path, { method: "POST", headers: headers, body: JSON.stringify(body || {}) }).then(function (r) {
      if (r.status === 401 && !retried) {
        var k = window.prompt("This site is protected. Enter the HOME edit key to change the records:");
        if (k) { try { localStorage.setItem(EK, k); } catch (e) {} return post(path, body, true); }
        throw new Error("The HOME edit key is required.");
      }
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  function describe(r) {
    if (r.type === "gift") return "@" + r.user + " sent " + (r.qty > 1 ? r.qty + "× " : "") + (r.gift || "a gift") + (r.coins ? " (" + nf(r.coins) + " coins)" : "");
    if (r.text) return r.text;
    return (TYPE_FALLBACK[r.type] || r.type) + (r.user ? " · @" + r.user : "");
  }
  var TYPE_FALLBACK = {};

  function mount(root) {
    injectCss();
    root.innerHTML = "";
    var box = el("div", "rx"); root.appendChild(box);
    var tab = "overview", meta = null, timer = null, auto = true;
    var F = { type: "", game: "", host: "", session: "", scope: "", q: "", user: "", range: "all", from: "", to: "", test: "0", sort: "new" };
    var shown = 0, rowsBox = null, moreBtn = null;
    var viewerSort = "coins", viewerQ = "";

    var tabs = el("div", "rx-tabs"), body = el("div", "rx-body");
    [["overview", "📊 Overview"], ["timeline", "🕒 Timeline"], ["audience", "👥 Audience"], ["alerts", "🔔 Alerts"], ["backup", "💾 Backup & settings"]].forEach(function (t) {
      var b = el("button", "rx-tab", t[1]); b.type = "button"; b.dataset.k = t[0];
      b.onclick = function () { tab = t[0]; draw(); };
      tabs.appendChild(b);
    });
    box.appendChild(tabs); box.appendChild(body);

    function tzOff() { return new Date().getTimezoneOffset(); }
    function range() {
      var now = Date.now(), d0 = new Date(); d0.setHours(0, 0, 0, 0);
      if (F.range === "today") return { from: d0.getTime(), to: 0 };
      if (F.range === "24h") return { from: now - 864e5, to: 0 };
      if (F.range === "7d") return { from: now - 7 * 864e5, to: 0 };
      if (F.range === "30d") return { from: now - 30 * 864e5, to: 0 };
      if (F.range === "custom") {
        var f = F.from ? new Date(F.from + "T00:00:00").getTime() : 0, t = F.to ? new Date(F.to + "T23:59:59").getTime() : 0;
        return { from: f, to: t };
      }
      return { from: 0, to: 0 };
    }
    function filt(extra) {
      var r = range();
      var o = { type: F.type, game: F.game, host: F.host, session: F.session, scope: F.scope, q: F.q, user: F.user, from: r.from, to: r.to, test: F.test, sort: F.sort };
      for (var k in extra) o[k] = extra[k];
      return o;
    }

    /* ---------- filter bar (shared by Overview + Timeline) ---------- */
    function filterBar(onChange) {
      var wrap = el("div");
      var chips = el("div", "rx-bar");
      var all = el("button", "rx-chip" + (F.type === "" ? " on" : ""), "All"); all.type = "button"; all.onclick = function () { F.type = ""; onChange(); };
      chips.appendChild(all);
      GROUPS.forEach(function (g) {
        var b = el("button", "rx-chip" + (F.type === g[0] ? " on" : ""), g[1]); b.type = "button";
        b.onclick = function () { F.type = F.type === g[0] ? "" : g[0]; onChange(); };
        chips.appendChild(b);
      });
      wrap.appendChild(chips);

      var row = el("div", "rx-bar");
      function sel(label, key, opts) {
        var s = el("select", "rx-sel"); s.setAttribute("aria-label", label);
        opts.forEach(function (o) { var op = el("option", "", o[1]); op.value = o[0]; if (String(F[key]) === String(o[0])) op.selected = true; s.appendChild(op); });
        s.onchange = function () { F[key] = s.value; onChange(); };
        row.appendChild(s); return s;
      }
      sel("Time range", "range", [["all", "All time"], ["today", "Today"], ["24h", "Last 24 hours"], ["7d", "Last 7 days"], ["30d", "Last 30 days"], ["custom", "Custom dates…"]]);
      if (F.range === "custom") {
        ["from", "to"].forEach(function (k) {
          var i = el("input", "rx-in"); i.type = "date"; i.value = F[k]; i.setAttribute("aria-label", k === "from" ? "From date" : "To date");
          i.onchange = function () { F[k] = i.value; onChange(); }; row.appendChild(i);
        });
      }
      var games = [["", "All games"]].concat(((meta && meta.games) || []).map(function (g) { return [g, gname(g)]; }));
      sel("Game", "game", games);
      if (meta && meta.hosts && meta.hosts.length > 0) sel("Host", "host", [["", "All hosts"]].concat(meta.hosts.map(function (h) { return [h, "@" + h]; })));
      sel("Audience", "scope", [["", "Everyone"], ["viewer", "Individual viewers"], ["room", "Whole room"]]);
      if (meta && meta.sessions && meta.sessions.length) {
        sel("Stream session", "session", [["", "All streams"]].concat(meta.sessions.filter(function (s) { return !s.test; }).map(function (s) {
          return [s.id, new Date(s.start).toLocaleDateString(undefined, { day: "numeric", month: "short" }) + " " + new Date(s.start).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) + (s.host ? " @" + s.host : "")];
        })));
      }
      wrap.appendChild(row);

      var row2 = el("div", "rx-bar");
      var q = el("input", "rx-in q"); q.type = "search"; q.placeholder = "Search a viewer, gift or text…"; q.value = F.q;
      var qt = null; q.oninput = function () { clearTimeout(qt); qt = setTimeout(function () { F.q = q.value.trim(); onChange(true); }, 350); };
      row2.appendChild(q);
      sel("Sort", "sort", [["new", "Newest first"], ["old", "Oldest first"], ["big", "Biggest first"]]);
      var tl = el("label", "rx-tag"); var cb = el("input"); cb.type = "checkbox"; cb.checked = F.test === "1"; cb.style.marginRight = "4px";
      cb.onchange = function () { F.test = cb.checked ? "1" : "0"; onChange(); };
      tl.appendChild(cb); tl.appendChild(document.createTextNode("Include test records")); row2.appendChild(tl);
      wrap.appendChild(row2);
      if (F.user) {
        var u = el("div", "rx-bar"); u.appendChild(el("span", "rx-tag hot", "Showing only @" + F.user));
        var x = el("button", "rx-chip", "✕ Show everyone"); x.type = "button"; x.onclick = function () { F.user = ""; onChange(); };
        u.appendChild(x); wrap.appendChild(u);
      }
      return wrap;
    }

    /* ---------- OVERVIEW ---------- */
    function drawOverview() {
      var onChange = function (keep) { drawOverview(); };
      body.innerHTML = "";
      body.appendChild(filterBar(function () { drawOverview(); }));
      var out = el("div"); body.appendChild(out);
      out.appendChild(el("div", "rx-empty", "Loading…"));
      getJSON("/api/records/summary?" + qs(filt({ tz: tzOff() }))).then(function (s) {
        if (tab !== "overview") return;
        out.innerHTML = "";
        if (!s.total) { out.appendChild(el("div", "rx-empty", "No records match yet. Gifts, likes, shares, follows and milestones are saved here automatically while you are LIVE (or when you press a fake alert in a game's Settings → Include test records).")); return; }
        var cards = el("div", "rx-cards");
        [["Records", s.total], ["Audience (people)", s.audience], ["Gifts", s.gifts], ["Coins", s.coins], ["Likes", s.likes], ["Shares", s.shares], ["Follows", s.follows], ["Milestones", s.milestones]].forEach(function (c) {
          var d = el("div", "rx-card"); d.appendChild(el("b", "", nf(c[1]))); d.appendChild(el("span", "", c[0])); cards.appendChild(d);
        });
        out.appendChild(cards);
        if (s.firstTs) out.appendChild(el("p", "rx-note", "From " + dt(s.firstTs) + " to " + dt(s.lastTs) + "."));

        var hb = el("div", "rx-box"); hb.appendChild(el("h4", "", "⏰ When the audience is most active (your local time)"));
        var hr = el("div", "rx-hour"), mx = Math.max.apply(null, s.byHour) || 1;
        s.byHour.forEach(function (n, h) { var i = el("i"); i.style.height = Math.max(3, Math.round(n / mx * 100)) + "%"; i.title = h + ":00 — " + n + " records"; hr.appendChild(i); });
        hb.appendChild(hr);
        var lab = el("div", "rx-hlab"); ["0h", "6h", "12h", "18h", "23h"].forEach(function (t) { lab.appendChild(el("span", "", t)); }); hb.appendChild(lab);
        out.appendChild(hb);

        var two = el("div", "rx-two");
        function list(title, rows, fmt) {
          var b = el("div", "rx-box"); b.appendChild(el("h4", "", title));
          if (!rows.length) b.appendChild(el("div", "rx-note", "Nothing yet."));
          rows.forEach(function (r, i) {
            var l = el("div", "rx-lrow"); l.appendChild(el("span", "", (i + 1) + "."));
            var n = el("button", "rx-link n", r.n && r.n !== r.u ? r.n + " (@" + r.u + ")" : "@" + r.u); n.type = "button";
            n.onclick = function () { F.user = r.u; tab = "timeline"; draw(); };
            l.appendChild(n); l.appendChild(el("b", "", fmt(r))); b.appendChild(l);
          });
          two.appendChild(b);
        }
        list("💰 Top gifters (coins)", s.top.coins, function (r) { return nf(r.coins); });
        list("❤️ Most likes", s.top.likes, function (r) { return nf(r.likes); });
        list("🔥 Most shares", s.top.shares, function (r) { return nf(r.shares); });
        list("🏆 Most milestones", s.top.milestones, function (r) { return nf(r.milestones); });
        out.appendChild(two);

        var two2 = el("div", "rx-two");
        var tb = el("div", "rx-box"); tb.appendChild(el("h4", "", "🧩 By kind"));
        Object.keys(s.byType).sort(function (a, b) { return s.byType[b] - s.byType[a]; }).forEach(function (k) {
          var l = el("div", "rx-lrow"); l.appendChild(el("span", "", ICON[k] || "•")); l.appendChild(el("span", "n", (meta && meta.types && meta.types[k]) || k)); l.appendChild(el("b", "", nf(s.byType[k]))); tb.appendChild(l);
        });
        two2.appendChild(tb);
        var gb = el("div", "rx-box"); gb.appendChild(el("h4", "", "🎮 By game"));
        Object.keys(s.byGame).sort(function (a, b) { return s.byGame[b] - s.byGame[a]; }).forEach(function (k) {
          var l = el("div", "rx-lrow"); l.appendChild(el("span", "n", gname(k))); l.appendChild(el("b", "", nf(s.byGame[k]))); gb.appendChild(l);
        });
        two2.appendChild(gb);
        var db = el("div", "rx-box"); db.appendChild(el("h4", "", "📅 By day (latest 14)"));
        Object.keys(s.byDay).sort().reverse().slice(0, 14).forEach(function (k) {
          var l = el("div", "rx-lrow"); l.appendChild(el("span", "n", k)); l.appendChild(el("b", "", nf(s.byDay[k]))); db.appendChild(l);
        });
        two2.appendChild(db);
        out.appendChild(two2);
      }).catch(function (e) { out.innerHTML = ""; out.appendChild(el("div", "rx-empty", "Could not load records: " + e.message)); });
    }

    /* ---------- TIMELINE ---------- */
    function rowNode(r) {
      var row = el("div", "rx-row");
      var ic = el("div", "rx-ic", ICON[r.type] || "•");
      if (r.tier) ic.title = r.tier;
      row.appendChild(ic);
      var m = el("div", "rx-main");
      m.appendChild(el("div", "rx-t", describe(r)));
      var tags = el("div", "rx-tags");
      function tag(t, hot) { tags.appendChild(el("span", "rx-tag" + (hot ? " hot" : ""), t)); }
      tag((meta && meta.types && meta.types[r.type]) || r.type);
      tag(r.scope === "room" ? "👥 Whole room" : "🙋 One viewer");
      if (r.game) tag("🎮 " + gname(r.game));
      if (r.host) tag("📡 @" + r.host);
      if (r.tier) tag("🏅 " + r.tier + " · stage " + r.stage + "/" + r.stages, true);
      if (r.type === "gift" && r.big) tag("Big gift", true);
      if (r.test) tag("TEST");
      m.appendChild(tags);
      var when = r.type === "likes" && r.firstTs ? "First like " + dt(r.firstTs) + " → latest " + dt(r.ts) : dt(r.ts);
      m.appendChild(el("div", "rx-when", when + " · " + ago(r.ts) + (r.session && r.session !== "test" ? " · " + dur(r.off) + " into the stream" : "") + (r.viewers != null ? " · " + nf(r.viewers) + " watching" : "")));
      row.appendChild(m);
      if (r.user) {
        var b = el("button", "rx-link", "@" + r.user); b.type = "button"; b.title = "Show only this viewer";
        b.onclick = function () { F.user = r.user; drawTimeline(); };
        row.appendChild(b);
      }
      return row;
    }
    function drawTimeline() {
      body.innerHTML = "";
      body.appendChild(filterBar(function () { drawTimeline(); }));
      var info = el("p", "rx-note", "Loading…"); body.appendChild(info);
      rowsBox = el("div"); body.appendChild(rowsBox);
      moreBtn = el("button", "rx-btn alt rx-more", "Load more"); moreBtn.type = "button"; moreBtn.hidden = true; body.appendChild(moreBtn);
      shown = 0;
      function page() {
        getJSON("/api/records?" + qs(filt({ limit: 60, offset: shown }))).then(function (d) {
          if (tab !== "timeline") return;
          info.textContent = nf(d.total) + " record" + (d.total === 1 ? "" : "s") + " match" + (d.total === 1 ? "es" : "") + ".";
          if (!d.total) { rowsBox.appendChild(el("div", "rx-empty", "No records match these filters.")); }
          d.rows.forEach(function (r) { rowsBox.appendChild(rowNode(r)); });
          shown += d.rows.length;
          moreBtn.hidden = shown >= d.total;
        }).catch(function (e) { info.textContent = "Could not load records: " + e.message; });
      }
      moreBtn.onclick = page;
      page();
    }

    /* ---------- AUDIENCE ---------- */
    function drawAudience() {
      body.innerHTML = "";
      body.appendChild(el("p", "rx-note", "Everyone who gifted, liked, shared, followed or reached a milestone — with lifetime totals across all streams. Tap a name to see all of their records."));
      var bar = el("div", "rx-bar"), q = el("input", "rx-in q"); q.type = "search"; q.placeholder = "Find a viewer…"; q.value = viewerQ;
      var qt = null; q.oninput = function () { clearTimeout(qt); qt = setTimeout(function () { viewerQ = q.value.trim(); load(); }, 300); };
      bar.appendChild(q); body.appendChild(bar);
      var out = el("div", "rx-scroll"); body.appendChild(out);
      function load() {
        getJSON("/api/records/viewers?" + qs({ q: viewerQ, sort: viewerSort, limit: 200 })).then(function (d) {
          if (tab !== "audience") return;
          out.innerHTML = "";
          if (!d.rows.length) { out.appendChild(el("div", "rx-empty", "No viewers saved yet.")); return; }
          var t = el("table", "rx-tbl"), h = el("tr");
          [["u", "Viewer"], ["coins", "Coins"], ["gifts", "Gifts"], ["likes", "Likes"], ["shares", "Shares"], ["milestones", "Miles."], ["last", "Last seen"]].forEach(function (c) {
            var th = el("th", c[0] === viewerSort ? "on" : "", c[1]);
            if (c[0] !== "u") th.onclick = function () { viewerSort = c[0]; load(); };
            h.appendChild(th);
          });
          t.appendChild(h);
          d.rows.forEach(function (v) {
            var tr = el("tr"), td = el("td"), b = el("button", "rx-link", v.n && v.n !== v.u ? v.n + " (@" + v.u + ")" : "@" + v.u); b.type = "button";
            b.onclick = function () { F.user = v.u; F.test = "0"; tab = "timeline"; draw(); };
            td.appendChild(b); tr.appendChild(td);
            [v.coins, v.gifts, v.likes, v.shares, v.milestones].forEach(function (n) { tr.appendChild(el("td", "", nf(n))); });
            var l = el("td", "", ago(v.last)); l.title = "First seen " + dt(v.first) + "\nLast seen " + dt(v.last); tr.appendChild(l);
            t.appendChild(tr);
          });
          out.appendChild(t);
          if (d.total > d.rows.length) out.appendChild(el("p", "rx-note", "Showing " + d.rows.length + " of " + nf(d.total) + ". Use search to find others."));
        }).catch(function (e) { out.innerHTML = ""; out.appendChild(el("div", "rx-empty", "Could not load: " + e.message)); });
      }
      load();
    }

    /* ---------- BACKUP & SETTINGS ---------- */
    function drawBackup() {
      body.innerHTML = "";
      var m = meta || {};
      var b1 = el("div", "rx-box"); b1.appendChild(el("h4", "", "📦 What is saved"));
      b1.appendChild(el("p", "rx-note", nf(m.total) + " records · " + nf(m.viewersKnown) + " viewers · up to " + nf(m.max) + " records kept (oldest are dropped after that" + (m.trimmed ? "; " + nf(m.trimmed) + " already dropped" : "") + ")."));
      if (!m.persistent) {
        b1.appendChild(el("div", "rx-warn", "⚠️ On Render's free plan the server disk is wiped at every redeploy, so saved records would be lost. Press Download backup (JSON) after streams, and Restore it later. To keep records automatically, add a Render Disk and set the environment variable RECORDS_DIR to its mount path (see README, Update 40)."));
      }
      body.appendChild(b1);

      var b2 = el("div", "rx-box"); b2.appendChild(el("h4", "", "⬇️ Download (uses the filters on the Overview/Timeline tabs)"));
      var g = el("div", "rx-grid2");
      function dl(label, fmt) {
        var a = el("a", "rx-btn alt", label); a.style.textAlign = "center"; a.style.textDecoration = "none"; a.style.display = "block";
        a.href = "/api/records/export?" + qs(filt({ format: fmt, sort: "old" })); a.setAttribute("download", ""); g.appendChild(a);
      }
      dl("📄 Spreadsheet (CSV)", "csv"); dl("💾 Backup (JSON)", "json");
      b2.appendChild(g); body.appendChild(b2);

      var b3 = el("div", "rx-box"); b3.appendChild(el("h4", "", "⬆️ Restore a backup"));
      b3.appendChild(el("p", "rx-note", "Choose a JSON backup you downloaded before. Records already here are skipped, so it is safe to restore twice."));
      var file = el("input"); file.type = "file"; file.accept = "application/json,.json";
      var st = el("div", "rx-note");
      file.onchange = function () {
        var f = file.files && file.files[0]; if (!f) return;
        st.textContent = "Reading…";
        f.text().then(function (t) { return post("/api/records/import", JSON.parse(t)); }).then(function (r) {
          st.textContent = "Restored " + nf(r.added) + " new records. Now " + nf(r.total) + " in total."; refreshMeta();
        }).catch(function (e) { st.textContent = "Could not restore: " + e.message; });
      };
      b3.appendChild(file); b3.appendChild(st); body.appendChild(b3);

      var b5 = el("div", "rx-box"); b5.appendChild(el("h4", "", "🧹 Clean up"));
      var r5 = el("div", "rx-grid2");
      var c1 = el("button", "rx-btn alt", "Delete test records"); c1.type = "button";
      c1.onclick = function () { post("/api/records/clear", { scope: "test" }).then(function () { refreshMeta(); }).catch(function (e) { window.alert(e.message); }); };
      var c2 = el("button", "rx-btn bad", "Delete ALL records"); c2.type = "button";
      c2.onclick = function () {
        if (window.prompt("This permanently deletes every saved record. Download a backup first!\nType DELETE to confirm:") === "DELETE")
          post("/api/records/clear", { scope: "all" }).then(function () { refreshMeta(); }).catch(function (e) { window.alert(e.message); });
      };
      r5.appendChild(c1); r5.appendChild(c2); b5.appendChild(r5); body.appendChild(b5);

      var b6 = el("div", "rx-box"); b6.appendChild(el("h4", "", "🔗 Quick access"));
      b6.appendChild(el("p", "rx-note", "Bookmark " + location.origin + "/records — it opens this screen directly. On HOME press the 📜 button or the R key; inside any game open ⚙️ Settings → 📜 Open Records."));
      body.appendChild(b6);
    }


    /* ---------- ALERTS: which notifications show, automatic rules, display options + counting accuracy (update 43) ---------- */
    var alertsDraft = null;
    function drawAlerts() {
      body.innerHTML = "";
      var holder = el("div", "rx-empty", "Loading…"); body.appendChild(holder);
      Promise.all([getJSON("/api/records/settings"), getJSON("/api/engagement/counters").catch(function () { return null; })]).then(function (r) {
        if (tab !== "alerts") return;
        var st = r[0], cnt = r[1], cfg = alertsDraft || JSON.parse(JSON.stringify(st.alerts)), defs = st.defaults;
        alertsDraft = cfg;
        body.innerHTML = "";

        /* counting accuracy */
        var c0 = el("div", "rx-box"); c0.appendChild(el("h4", "", "🎯 Counting accuracy"));
        if (cnt && cnt.counting) {
          var k = cnt.counting, c = cnt.counters || {};
          c0.appendChild(el("p", "rx-note", "Every TikTok message is counted exactly once (even when several games are open), the count restarts from zero for each new LIVE, and test buttons never touch these numbers."));
          var g0 = el("div", "rx-cards");
          [[nf(k.platformLikes), "Likes counted here"], [k.tiktokRoomLikes != null ? nf(k.tiktokRoomLikes) : "–", "Room likes TikTok reports"], [nf(c.totalGifts), "Gifts"], [nf(c.totalCoins), "Coins"], [nf(c.totalShares), "Shares"], [nf(k.duplicatesBlocked), "Duplicates blocked"]].forEach(function (x) {
            var d = el("div", "rx-card"); d.appendChild(el("b", "", x[0])); d.appendChild(el("span", "", x[1])); g0.appendChild(d);
          });
          c0.appendChild(g0);
          c0.appendChild(el("p", "rx-note", "Counting since " + dt(k.since) + (k.sessionKey ? " · LIVE room " + k.sessionKey : "") + ". “Likes counted here” only includes likes sent after the platform connected; TikTok's own room total also includes earlier likes, and the room milestones follow TikTok's number."));
          var rb = el("button", "rx-btn alt", "Start a fresh count now"); rb.type = "button";
          rb.onclick = function () { if (window.confirm("Reset the live counters to zero? (Saved Records are not touched.)")) post("/api/engagement/reset", {}).then(function () { drawAlerts(); }).catch(function (e) { window.alert(e.message); }); };
          c0.appendChild(rb);
        } else c0.appendChild(el("p", "rx-note", "Counters are not available right now."));
        body.appendChild(c0);

        function box(title, note) { var b = el("div", "rx-box"); b.appendChild(el("h4", "", title)); if (note) b.appendChild(el("p", "rx-note", note)); body.appendChild(b); return b; }
        function toggle(parent, label, get, set) {
          var b = el("button", "rx-chip" + (get() ? " on" : ""), (get() ? "✅ " : "⬜ ") + label); b.type = "button"; b.style.margin = "0 6px 6px 0";
          b.onclick = function () { set(!get()); drawAlerts(); }; parent.appendChild(b);
        }
        function numField(parent, label, get, set, min, max, step, unit) {
          var row = el("div", "rx-bar"); row.appendChild(el("span", "rx-lbl", label));
          var inp = el("input", "rx-in"); inp.type = "number"; inp.min = min; inp.max = max; inp.step = step || 1; inp.value = get(); inp.style.width = "110px";
          inp.onchange = function () { var v = Number(inp.value); if (isFinite(v)) set(Math.min(max, Math.max(min, v))); inp.value = get(); };
          row.appendChild(inp); if (unit) row.appendChild(el("span", "rx-note", unit)); parent.appendChild(row);
        }

        /* which alerts */
        var b1 = box("🔔 Which alerts pop up on stream", "Switch each kind on or off. Everything is ALWAYS saved to Records, switched off or not.");
        Object.keys(st.kinds).forEach(function (kk) { toggle(b1, st.kinds[kk], function () { return cfg.kinds[kk] !== false; }, function (v) { cfg.kinds[kk] = v; }); });
        var mrow = el("div", "rx-bar"); mrow.appendChild(el("span", "rx-lbl", "Milestone stages:"));
        [["all", "Every stage (most alerts)"], ["major", "Only the bigger stages"]].forEach(function (o) {
          var c = el("button", "rx-chip" + (cfg.alertMode === o[0] ? " on" : ""), o[1]); c.type = "button"; c.onclick = function () { cfg.alertMode = o[0]; drawAlerts(); }; mrow.appendChild(c);
        });
        b1.appendChild(mrow);

        /* automatic rules */
        var b2 = box("🤖 Automatic rules", "These switch alerts on and off by themselves, so the stream never gets cluttered. Big gifts and room milestones always get through.");
        toggle(b2, "Busy stream: pause small alerts automatically", function () { return cfg.autoThrottle.on; }, function (v) { cfg.autoThrottle.on = v; });
        numField(b2, "…when more than", function () { return cfg.autoThrottle.maxPerMinute; }, function (v) { cfg.autoThrottle.maxPerMinute = v; }, 1, 120, 1, "alerts in the last minute");
        numField(b2, "Hide gifts worth fewer than", function () { return cfg.minGiftCoins; }, function (v) { cfg.minGiftCoins = v; }, 0, 1000000, 1, "coins (0 = announce every gift)");
        numField(b2, "A gift counts as BIG from", function () { return cfg.bigGiftCoins; }, function (v) { cfg.bigGiftCoins = v; }, 1, 10000000, 1, "coins (gets the confetti card)");
        numField(b2, "Same viewer at most once per", function () { return cfg.viewerCooldownSec; }, function (v) { cfg.viewerCooldownSec = v; }, 0, 3600, 1, "seconds (0 = no limit)");
        toggle(b2, "Only show alerts while the platform is connected LIVE", function () { return cfg.onlyWhenLive; }, function (v) { cfg.onlyWhenLive = v; });

        /* display */
        var b3 = box("🎨 How alerts look", "Applies to every game screen at once.");
        numField(b3, "Show each alert for", function () { return cfg.display.durationSec; }, function (v) { cfg.display.durationSec = v; }, 1.5, 20, 0.5, "seconds");
        numField(b3, "Size", function () { return cfg.display.scale; }, function (v) { cfg.display.scale = v; }, 50, 160, 5, "% (100 = normal)");
        numField(b3, "Waiting line holds at most", function () { return cfg.display.maxQueue; }, function (v) { cfg.display.maxQueue = v; }, 1, 60, 1, "alerts");
        var prow = el("div", "rx-bar"); prow.appendChild(el("span", "rx-lbl", "Position:"));
        [["top", "Top"], ["middle", "Middle"], ["bottom", "Bottom"]].forEach(function (o) {
          var c = el("button", "rx-chip" + (cfg.display.position === o[0] ? " on" : ""), o[1]); c.type = "button"; c.onclick = function () { cfg.display.position = o[0]; drawAlerts(); }; prow.appendChild(c);
        });
        b3.appendChild(prow);
        toggle(b3, "Confetti for big alerts", function () { return cfg.display.confetti; }, function (v) { cfg.display.confetti = v; });
        toggle(b3, "Thank-you line", function () { return cfg.display.showWish; }, function (v) { cfg.display.showWish = v; });
        toggle(b3, "Viewer picture", function () { return cfg.display.showAvatar; }, function (v) { cfg.display.showAvatar = v; });

        var save = el("div", "rx-grid2");
        var sb = el("button", "rx-btn", "💾 Save alert settings"); sb.type = "button";
        sb.onclick = function () { post("/api/records/settings", { alerts: cfg }).then(function () { alertsDraft = null; sb.textContent = "✅ Saved - live on every screen"; setTimeout(drawAlerts, 900); }).catch(function (e) { window.alert(e.message); }); };
        var db = el("button", "rx-btn alt", "↩️ Back to the defaults"); db.type = "button";
        db.onclick = function () { if (window.confirm("Put every alert setting back to its default?")) post("/api/records/settings", { reset: "alerts" }).then(function () { alertsDraft = null; drawAlerts(); }).catch(function (e) { window.alert(e.message); }); };
        save.appendChild(sb); save.appendChild(db); body.appendChild(save);
        body.appendChild(el("p", "rx-note", "Tip: use the 🧪 test buttons in any game's Settings to preview an alert after saving."));
      }).catch(function (e) { body.innerHTML = ""; body.appendChild(el("div", "rx-empty", "Could not load: " + e.message)); });
    }

    function refreshMeta() { return getJSON("/api/records/meta").then(function (m) { meta = m; if (tab === "backup") drawBackup(); return m; }).catch(function () {}); }

    function draw() {
      Array.prototype.forEach.call(tabs.children, function (b) { b.classList.toggle("on", b.dataset.k === tab); });
      if (tab === "overview") drawOverview(); else if (tab === "timeline") drawTimeline(); else if (tab === "audience") drawAudience(); else if (tab === "alerts") drawAlerts(); else drawBackup();
    }

    refreshMeta().then(draw);
    // live refresh: new records show up by themselves while the screen is open
    timer = setInterval(function () {
      if (!box.isConnected) { clearInterval(timer); return; }
      if (document.hidden || !auto) return;
      var ae = document.activeElement; if (ae && box.contains(ae) && (ae.tagName === "INPUT" || ae.tagName === "SELECT")) return; // never redraw while the host is typing / choosing
      if (tab === "overview") drawOverview();
      else if (tab === "audience") drawAudience();
      else if (tab === "timeline" && shown <= 60 && !F.q) drawTimeline();
      refreshMetaQuiet();
    }, 15000);
    function refreshMetaQuiet() { getJSON("/api/records/meta").then(function (m) { meta = m; }).catch(function () {}); }
    return { setTab: function (t) { tab = t; draw(); } };
  }

  window.RecordsUI = { mount: mount };
})();
