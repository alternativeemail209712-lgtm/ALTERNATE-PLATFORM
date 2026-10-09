/* UPDATE 35 - HOME: 35 layouts, host-made groups, search, keyboard + touch. Never edits the cards' content; works alongside home.js. */
(function () {
  "use strict";
  var hub = document.querySelector(".hub"), footer = document.querySelector(".hub-footer");
  if (!hub || !footer) return;
  document.body.classList.add("hv-on");
  var DEFAULT_VIEW = "cards"; // <- first layout new visitors see (any id below)
  var NEW_GAMES = ["shapedle"]; // ids that show a NEW tag
  var VIEWS = [["cards","🃏","Cards"],["grid","▦","Grid"],["list","☰","List"],["icons","🔳","Icons"],["swipe","👉","Swipe"],["mosaic","🧩","Mosaic"],["hero","⭐","Hero"],["pills","💊","Pills"],["fold","📂","Fold"],["bubbles","🫧","Bubbles"],["arcade","🕹️","Arcade"],["sections","🗂️","Sections"],["bands","🎽","Bands"],
    ["trio","3️⃣","Trio"],["quad","4️⃣","Quad"],["posters","🎬","Posters"],["wide","🛣️","Wide"],["masonry","🧱","Masonry"],["stripes","🦓","Stripes"],["minimal","✨","Minimal"],["stickers","🏷️","Stickers"],["glass","🪟","Glass"],["night","🌙","Night"],["terminal","💻","Terminal"],["cartridge","👾","Cartridge"],["ticket","🎟️","Ticket"],["polaroid","📷","Polaroid"],["gradient","🌈","Gradient"],["zigzag","↯","Zigzag"],["ranked","🏅","Ranked"],["table","📊","Table"],["stories","🔵","Stories"],["tabs","🗃️","Tabs"],["spotlight","🔦","Spotlight"],["folders","📁","Folders"]];
  var STAGE = { swipe:1, hero:1, sections:1, masonry:1, stories:1, tabs:1, spotlight:1, folders:1 };
  var TILE = "grid mosaic arcade glass gradient cartridge polaroid stickers".split(" ");
  var ROW = "list bands stripes night ticket table ranked minimal terminal wide".split(" ");
  var LS = "homeView.v3", GK = "homeGroups.v1", EK = "homeCards.editKey";

  function $c() { return Array.prototype.slice.call(document.querySelectorAll(".game-card[data-game]")); }
  function gid(c) { return c.getAttribute("data-game"); }
  function visible() { return $c().filter(function (c) { return !c.hidden && !c.classList.contains("hv-filtered"); }); }
  function el(t, c, txt) { var e = document.createElement(t); if (c) e.className = c; if (txt != null) e.textContent = txt; return e; }
  function vInfo(id) { for (var i = 0; i < VIEWS.length; i++) if (VIEWS[i][0] === id) return VIEWS[i]; return null; }
  function title(c) { var n = c.querySelector(".game-name"); return n ? n.textContent.trim() : gid(c); }
  function icon(c) { var n = c.querySelector(".game-icon"); return n ? n.textContent.trim() : "🎮"; }

  var view = DEFAULT_VIEW, cat = "All", tabSel = 0, spotI = 0;
  try { view = localStorage.getItem(LS) || DEFAULT_VIEW; } catch (e) {}
  try { var qv = new URLSearchParams(location.search).get("view"); if (qv) view = qv; } catch (e) {}
  if (!vInfo(view)) view = "cards";

  /* ================= host groups ================= */
  var groups = { groups: [], updatedAt: 0 };
  function cleanG(x) {
    var ids = $c().map(gid), used = {}, out = [];
    ((x && x.groups) || []).forEach(function (g) {
      if (!g || out.length >= 12) return;
      var name = String(g.name || "").replace(/\s+/g, " ").trim().slice(0, 24); if (!name) return;
      var id = String(g.id || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 20) || "g" + Math.random().toString(36).slice(2, 8);
      var games = [];
      (g.games || []).forEach(function (k) { if (ids.indexOf(k) > -1 && !used[k]) { used[k] = 1; games.push(k); } });
      out.push({ id: id, name: name, games: games });
    });
    return { groups: out, updatedAt: Number(x && x.updatedAt) || 0 };
  }
  try { groups = cleanG(JSON.parse(localStorage.getItem(GK) || "{}")); } catch (e) {}
  function saveLocal() { try { localStorage.setItem(GK, JSON.stringify(groups)); } catch (e) {} }
  function groupOf(id) { for (var i = 0; i < groups.groups.length; i++) if (groups.groups[i].games.indexOf(id) > -1) return groups.groups[i]; return null; }
  var pushT = null, statusEl = null;
  function setStatus(t) { if (statusEl) statusEl.textContent = t; }
  function push() {
    var headers = { "Content-Type": "application/json" }, key = "";
    try { key = localStorage.getItem(EK) || ""; } catch (e) {}
    if (key) headers["x-edit-key"] = key;
    fetch("/api/home-groups", { method: "PUT", headers: headers, body: JSON.stringify({ groups: groups.groups }) })
      .then(function (r) {
        if (r.status === 401) {
          var k = window.prompt("This site needs the HOME edit key to save your groups for all devices:");
          if (k) { try { localStorage.setItem(EK, k); } catch (e) {} push(); } else setStatus("Saved on this device only.");
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then(function (s) { if (s) { groups.updatedAt = Number(s.updatedAt) || groups.updatedAt; saveLocal(); setStatus("Saved ✓ (all your devices)"); } })
      .catch(function () { setStatus("Saved on this device only (server not reachable)."); });
  }
  function changed() {
    groups = cleanG(groups); groups.updatedAt = Date.now(); saveLocal();
    if (cat !== "All" && cat !== "_none" && !groups.groups.some(function (g) { return g.id === cat; })) cat = "All";
    buildChips(); apply(true); setStatus("Saving...");
    clearTimeout(pushT); pushT = setTimeout(push, 400);
  }
  function adopt(s, initial) {
    if (!s) return;
    var c = cleanG(s);
    if (c.updatedAt > groups.updatedAt) { groups = c; saveLocal(); buildChips(); apply(true); }
    else if (initial && groups.groups.length && groups.updatedAt > c.updatedAt) push();
  }
  function pull() { fetch("/api/home-groups", { cache: "no-store" }).then(function (r) { return r.ok ? r.json() : null; }).then(function (s) { adopt(s, true); }).catch(function () {}); }
  try { if (typeof window.io === "function") window.io("/home-hub").on("home:groups", function (s) { adopt(s, false); }); } catch (e) {}

  /* ================= settings: every control lives behind the ⚙️ button ================= */
  var chipsBox = el("div", "hv-chips"), pickBtn = el("span");
  var search = el("input", "hv-search"); search.type = "search"; search.placeholder = "Type a game name or a word...";
  var count = el("div", "hv-count"), empty = el("div", "hv-empty", "No games match. Open ⚙️ Settings to change the search."); empty.hidden = true;
  var stage = el("div", "hv-stage"), activeBar = el("div", "hv-active"); activeBar.hidden = true;
  var subEl = document.querySelector(".hub-sub");
  if (subEl && subEl.parentNode) subEl.parentNode.insertBefore(activeBar, subEl.nextSibling); else hub.insertBefore(activeBar, hub.firstChild);
  hub.insertBefore(stage, footer); hub.insertBefore(empty, footer);
  $c().forEach(function (c) { if (NEW_GAMES.indexOf(gid(c)) > -1) c.appendChild(el("span", "hv-tagnew", "NEW")); });

  function updActive(shown, total) {
    var on = search.value.trim() || cat !== "All";
    activeBar.hidden = !on;
    if (!on) return;
    activeBar.innerHTML = "";
    activeBar.appendChild(el("span", "", "Showing " + shown + " of " + total + " games"));
    var x = el("button", "", "Show all"); x.type = "button";
    x.onclick = function () { search.value = ""; cat = "All"; buildChips(); apply(true); };
    activeBar.appendChild(x);
  }
  function buildChips() {
    chipsBox.innerHTML = "";
    chipsBox.hidden = !groups.groups.length;
    if (!groups.groups.length) { cat = "All"; return; }
    function chip(id, name) {
      var b = el("button", "hv-chip" + (cat === id ? " on" : ""), name); b.type = "button";
      b.onclick = function () { cat = id; buildChips(); apply(true); };
      chipsBox.appendChild(b);
    }
    chip("All", "All");
    groups.groups.forEach(function (g) { chip(g.id, g.name); });
    if ($c().some(function (c) { return !groupOf(gid(c)); })) chip("_none", "Other");
  }

  var ov = el("div", "hv-ov"); ov.hidden = true; document.body.appendChild(ov);
  ov.addEventListener("click", function (e) { if (e.target === ov) closeOv(); });
  function closeOv() { ov.hidden = true; statusEl = null; }
  function showOv(node) { ov.innerHTML = ""; ov.appendChild(node); ov.hidden = false; }
  function mHead(t) { var h = el("div", "hv-mh"), x = el("button", "hv-x", "✕"); x.type = "button"; x.setAttribute("aria-label", "Close"); x.onclick = closeOv; h.appendChild(el("h2", "", t)); h.appendChild(x); return h; }
  function step(d) { var i = 0; VIEWS.forEach(function (v, k) { if (v[0] === view) i = k; }); setView(VIEWS[(i + d + VIEWS.length) % VIEWS.length][0]); }

  function findPanel(m) {
    m.appendChild(el("div", "hv-ah", "Search games"));
    m.appendChild(search);
    if (groups.groups.length) { m.appendChild(el("div", "hv-ah", "Show only this group")); m.appendChild(chipsBox); }
    else m.appendChild(el("p", "hv-help", "Tip: open the Groups tab to make your own groups (like Easy, Kids, Today's stream) and filter by them here."));
    m.appendChild(count);
  }
  function layoutPanel(m) {
    m.appendChild(el("p", "hv-help", "Pick how the games are shown on the home page (" + VIEWS.length + " layouts). It is remembered on this device."));
    var g = el("div", "hv-pg");
    VIEWS.forEach(function (v) {
      var b = el("button", "hv-pi" + (v[0] === view ? " on" : "")); b.type = "button";
      b.innerHTML = "<b>" + v[1] + "</b>" + v[2];
      b.onclick = function () { setView(v[0]); Array.prototype.forEach.call(g.children, function (x) { x.classList.remove("on"); }); b.classList.add("on"); };
      g.appendChild(b);
    });
    m.appendChild(g);
    m.appendChild(el("div", "hv-keys", "Keyboard: [ and ] change layout · / opens search · Esc closes"));
  }
  function groupsPanel(m) {
    function draw() {
      m.innerHTML = "";
      m.appendChild(el("p", "hv-help", "Make your own groups (for example Geography, Easy, Kids, Today's stream) and put each game in one. They become filter buttons and headings in the Sections, Hero, Tabs and Folders layouts."));
      groups.groups.forEach(function (g, i) {
        var row = el("div", "hv-gr"), inp = el("input"); inp.value = g.name; inp.maxLength = 24; inp.setAttribute("aria-label", "Group name");
        inp.onchange = function () { g.name = inp.value.trim() || g.name; changed(); draw(); };
        var up = el("button", "", "↑"), dn = el("button", "", "↓"), rm = el("button", "", "✕");
        up.type = dn.type = rm.type = "button"; up.title = "Move up"; dn.title = "Move down"; rm.title = "Delete group";
        up.onclick = function () { if (i > 0) { groups.groups.splice(i - 1, 0, groups.groups.splice(i, 1)[0]); changed(); draw(); } };
        dn.onclick = function () { if (i < groups.groups.length - 1) { groups.groups.splice(i + 1, 0, groups.groups.splice(i, 1)[0]); changed(); draw(); } };
        rm.onclick = function () { if (window.confirm("Delete the group \"" + g.name + "\"? Its games stay on the page.")) { groups.groups.splice(i, 1); changed(); draw(); } };
        row.appendChild(inp); row.appendChild(up); row.appendChild(dn); row.appendChild(rm); m.appendChild(row);
      });
      var add = el("button", "hv-add", "＋ Add a group"); add.type = "button";
      add.onclick = function () {
        if (groups.groups.length >= 12) return;
        groups.groups.push({ id: "g" + Date.now().toString(36), name: "New group", games: [] }); changed(); draw();
        var ins = m.querySelectorAll(".hv-gr input"); if (ins.length) { ins[ins.length - 1].focus(); ins[ins.length - 1].select(); }
      };
      m.appendChild(add);
      if (groups.groups.length) {
        m.appendChild(el("div", "hv-ah", "Put each game in a group:"));
        $c().forEach(function (c) {
          var row = el("div", "hv-ag"), sel = el("select"), cur = groupOf(gid(c));
          row.appendChild(el("span", "", icon(c) + "  " + title(c)));
          var o0 = el("option", "", "— no group —"); o0.value = ""; sel.appendChild(o0);
          groups.groups.forEach(function (g) { var o = el("option", "", g.name); o.value = g.id; if (cur && cur.id === g.id) o.selected = true; sel.appendChild(o); });
          sel.setAttribute("aria-label", "Group for " + title(c));
          sel.onchange = function () {
            groups.groups.forEach(function (g) { g.games = g.games.filter(function (k) { return k !== gid(c); }); });
            groups.groups.forEach(function (g) { if (g.id === sel.value) g.games.push(gid(c)); });
            changed();
          };
          row.appendChild(sel); m.appendChild(row);
        });
      }
      statusEl = el("div", "hv-status"); m.appendChild(statusEl);
    }
    draw();
  }

  var settingsTab = "mode"; // update 38: Mode is the first tab (Offline / Test / Live + connection), Cards = Customize Game Cards
  function openSettings(tab) {
    if (tab) settingsTab = tab;
    var m = el("div", "hv-modal"), tb = el("div", "hv-st"), body = el("div", "hv-sbody");
    m.appendChild(mHead("⚙️ Home settings"));
    var tabs = [["mode", "📡 Mode"], ["cards", "🎴 Cards"], ["find", "🔎 Find"], ["layout", "🎛 Layout"], ["groups", "🗂️ Groups"]];
    function show() {
      body.innerHTML = ""; statusEl = null;
      Array.prototype.forEach.call(tb.children, function (b, i) { b.classList.toggle("on", tabs[i][0] === settingsTab); });
      if (settingsTab === "mode") { if (window.PlatformHome) window.PlatformHome.renderModePanel(body); else body.appendChild(el("p", "hv-help", "Loading...")); }
      else if (settingsTab === "cards") { if (window.PlatformHome) window.PlatformHome.renderCardsPanel(body); else body.appendChild(el("p", "hv-help", "Loading...")); }
      else if (settingsTab === "find") findPanel(body); else if (settingsTab === "layout") layoutPanel(body); else groupsPanel(body);
    }
    tabs.forEach(function (t) { var b = el("button", "hv-stb", t[1]); b.type = "button"; b.onclick = function () { settingsTab = t[0]; show(); }; tb.appendChild(b); });
    var done = el("button", "hv-done", "Show games"); done.type = "button"; done.onclick = closeOv;
    m.appendChild(tb); m.appendChild(body); m.appendChild(done);
    showOv(m); show();
    if (settingsTab === "find") setTimeout(function () { try { search.focus(); } catch (e) {} }, 60);
  }
  var gear = el("button", "cu-open hv-gear", "⚙️"); gear.type = "button"; gear.title = "Home settings: mode, cards, layout, groups, search"; gear.setAttribute("aria-label", "Home settings");
  gear.onclick = function () { openSettings(); };
  window.HomeSettings = { open: openSettings, close: closeOv }; // used by platform-home.js (mode panel, status pill)
  var cuBtn = document.getElementById("cuOpen");
  if (cuBtn && cuBtn.parentNode) cuBtn.parentNode.insertBefore(gear, cuBtn.nextSibling);
  else { gear.classList.add("hv-float"); document.body.appendChild(gear); }

  /* ================= views ================= */
  function setView(v) {
    view = v;
    try { localStorage.setItem(LS, v); } catch (e) {}
    var k = TILE.indexOf(v) > -1 ? " k-tile" : ROW.indexOf(v) > -1 ? " k-row" : "";
    hub.className = "hub " + (STAGE[v] ? "hv-s" : "hv-g") + " v-" + v + k;
    document.body.setAttribute("data-hv", v);
    var i = vInfo(v); pickBtn.innerHTML = i[1] + " " + i[2] + "<small>layout ▾</small>";
    $c().forEach(function (c) { c.classList.remove("hv-open"); });
    renderStage(true);
  }
  var lastSig = "", car = null, dots = null;
  function sig() { return visible().map(function (c) { return gid(c) + c.getAttribute("style") + c.textContent.length; }).join("|") + view + tabSel + spotI; }
  function clone(c, cls) {
    var n = c.cloneNode(true); n.removeAttribute("data-game");
    n.classList.remove("hv-first", "hv-odd", "hv-filtered", "hv-open"); n.classList.add("hv-clone", cls); return n;
  }
  function buckets(list) {
    var out = [];
    groups.groups.forEach(function (g) {
      var it = list.filter(function (c) { return g.games.indexOf(gid(c)) > -1; });
      if (it.length) out.push([g.name, it]);
    });
    var rest = list.filter(function (c) { return !groupOf(gid(c)); });
    if (rest.length) out.push([groups.groups.length ? "Other games" : "All games", rest]);
    return out;
  }
  function grid(items, cls, kind) {
    var g = el("div", "hv-gc " + (kind || "")); items.forEach(function (c) { g.appendChild(clone(c, cls)); }); return g;
  }
  function updDots() {
    if (!car || !dots) return;
    var m = car.scrollLeft + car.clientWidth / 2, best = 0, bd = 1e9;
    Array.prototype.forEach.call(car.children, function (c, i) { var d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - m); if (d < bd) { bd = d; best = i; } });
    Array.prototype.forEach.call(dots.children, function (d, i) { d.className = i === best ? "on" : ""; });
  }
  function renderStage(force) {
    if (!STAGE[view]) { stage.innerHTML = ""; lastSig = ""; return; }
    var s = sig(); if (!force && s === lastSig) return; lastSig = s;
    var list = visible(); stage.innerHTML = ""; car = dots = null;
    if (!list.length) return;
    var bk = buckets(list);
    if (view === "swipe") {
      var w = el("div", "hv-carwrap"); car = el("div", "hv-car"); dots = el("div", "hv-dots");
      list.forEach(function (c) { car.appendChild(clone(c, "hv-slide")); dots.appendChild(el("i")); });
      var L = el("button", "hv-nb l", "‹"), R = el("button", "hv-nb r", "›"); L.type = R.type = "button";
      L.onclick = function () { car.scrollBy({ left: -car.clientWidth * .8, behavior: "smooth" }); };
      R.onclick = function () { car.scrollBy({ left: car.clientWidth * .8, behavior: "smooth" }); };
      w.appendChild(car); w.appendChild(L); w.appendChild(R); stage.appendChild(w); stage.appendChild(dots);
      car.addEventListener("scroll", updDots); setTimeout(updDots, 50);
    } else if (view === "hero") {
      var h = clone(list[0], "hv-hero"), nm = h.querySelector(".game-name");
      if (nm) nm.appendChild(el("span", "hv-herobadge", "⭐ FEATURED"));
      stage.appendChild(h);
      buckets(list.slice(1)).forEach(function (b) {
        stage.appendChild(el("h3", "hv-sec", b[0] + " · " + b[1].length));
        var row = el("div", "hv-rowx"); b[1].forEach(function (c) { row.appendChild(clone(c, "hv-poster")); }); stage.appendChild(row);
      });
    } else if (view === "sections") {
      bk.forEach(function (b) { stage.appendChild(el("h3", "hv-sec", b[0] + " · " + b[1].length)); stage.appendChild(grid(b[1], "hv-mini")); });
    } else if (view === "masonry") {
      stage.appendChild(grid(list, "hv-mas", "mas"));
    } else if (view === "stories") {
      var st = el("div", "hv-stories");
      list.forEach(function (c) {
        var cs = getComputedStyle(c), a = el("a", "hv-story"); a.href = c.getAttribute("href");
        a.style.setProperty("--c", cs.getPropertyValue("--accent") || "#999"); a.style.setProperty("--d", cs.getPropertyValue("--accent-deep") || "#555");
        a.appendChild(el("i", "", icon(c))); a.appendChild(el("span", "", title(c))); st.appendChild(a);
      });
      stage.appendChild(st); stage.appendChild(grid(list, "hv-listrow", "rows"));
    } else if (view === "tabs") {
      if (tabSel >= bk.length) tabSel = 0;
      if (bk.length > 1) {
        var tb = el("div", "hv-tabs");
        bk.forEach(function (b, i) {
          var t = el("button", "hv-tab" + (i === tabSel ? " on" : ""), b[0] + " (" + b[1].length + ")"); t.type = "button";
          t.onclick = function () { tabSel = i; renderStage(true); }; tb.appendChild(t);
        });
        stage.appendChild(tb);
      }
      stage.appendChild(grid(bk[tabSel][1], "hv-mini"));
    } else if (view === "spotlight") {
      if (spotI >= list.length) spotI = 0;
      var sp = el("div", "hv-spot"), main = el("div", "hv-spotmain"), pv = el("button", "hv-sn", "‹"), nx = el("button", "hv-sn", "›");
      pv.type = nx.type = "button"; pv.onclick = function () { spotI = (spotI - 1 + list.length) % list.length; renderStage(true); };
      nx.onclick = function () { spotI = (spotI + 1) % list.length; renderStage(true); };
      main.appendChild(pv); main.appendChild(clone(list[spotI], "hv-hero")); main.appendChild(nx);
      var th = el("div", "hv-thumbs");
      list.forEach(function (c, i) {
        var b = el("button", "hv-th" + (i === spotI ? " on" : "")); b.type = "button";
        b.innerHTML = "<b></b><span></span>"; b.firstChild.textContent = icon(c); b.lastChild.textContent = title(c);
        b.onclick = function () { spotI = i; renderStage(true); }; th.appendChild(b);
      });
      sp.appendChild(main); sp.appendChild(th); stage.appendChild(sp);
    } else if (view === "folders") {
      bk.forEach(function (b) {
        var d = el("details", "hv-fd"); d.open = true; d.appendChild(el("summary", "", b[0] + " · " + b[1].length));
        d.appendChild(grid(b[1], "hv-mini")); stage.appendChild(d);
      });
    }
  }

  function apply(force) {
    var q = search.value.trim().toLowerCase(), shown = 0, total = 0, first = null, idx = 0;
    $c().forEach(function (c) {
      var g = groupOf(gid(c));
      var inCat = cat === "All" || (cat === "_none" ? !g : g && g.id === cat);
      var good = inCat && (!q || c.textContent.toLowerCase().indexOf(q) > -1);
      c.classList.toggle("hv-filtered", !good); c.classList.remove("hv-first", "hv-odd");
      if (!c.hidden) { total++; if (good) { shown++; if (!first) first = c; if (idx++ % 2) c.classList.add("hv-odd"); } }
    });
    if (first) first.classList.add("hv-first");
    count.textContent = shown + " of " + total + " games";
    updActive(shown, total);
    empty.hidden = shown > 0;
    renderStage(!!force);
  }
  search.addEventListener("input", function () { apply(true); });

  /* icons: details sheet / fold: expand in place */
  hub.addEventListener("click", function (e) {
    var c = e.target.closest && e.target.closest(".game-card[data-game]");
    if (!c) return;
    if (view === "icons") {
      e.preventDefault();
      var cs = getComputedStyle(c), s = el("div", "hv-sheet");
      s.style.setProperty("--hv-c", cs.getPropertyValue("--accent") || "#999"); s.style.setProperty("--hv-d", cs.getPropertyValue("--accent-deep") || "#555");
      var h = el("div", "hv-mh"), x = el("button", "hv-x", "✕"); x.type = "button"; x.onclick = closeOv;
      h.appendChild(el("h2", "", icon(c) + " " + title(c))); h.appendChild(x); s.appendChild(h);
      s.appendChild(el("p", "", c.querySelector(".game-desc").textContent));
      var tg = el("div", "tags");
      Array.prototype.forEach.call(c.querySelectorAll(".tag"), function (t) { tg.appendChild(el("span", "", t.textContent)); });
      s.appendChild(tg);
      var a = el("a", "go", c.querySelector(".play-cta").textContent); a.href = c.getAttribute("href"); s.appendChild(a);
      showOv(s);
    } else if (view === "fold") {
      if (c.classList.contains("hv-open") && e.target.closest(".play-cta")) return;
      e.preventDefault();
      var was = c.classList.contains("hv-open");
      $c().forEach(function (k) { k.classList.remove("hv-open"); });
      if (!was) c.classList.add("hv-open");
    }
  });

  /* keyboard (desktop) */
  document.addEventListener("keydown", function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "");
    if (e.key === "Escape") { if (!ov.hidden) closeOv(); else if (e.target === search && search.value) { search.value = ""; apply(true); } return; }
    if (typing || e.ctrlKey || e.metaKey || e.altKey || !ov.hidden) return;
    if (e.key === "/") { e.preventDefault(); openSettings("find"); }
    else if (e.key === "[") step(-1);
    else if (e.key === "]") step(1);
    else if (view === "spotlight" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      var n = visible().length; if (n) { spotI = (spotI + (e.key === "ArrowRight" ? 1 : -1) + n) % n; renderStage(true); }
    }
  });

  /* stay in sync with the card customizer (hide / recolor / reorder) */
  var t = null;
  function later() { clearTimeout(t); t = setTimeout(function () { apply(false); }, 150); }
  if (window.MutationObserver) {
    var mo = new MutationObserver(later);
    $c().forEach(function (c) { mo.observe(c, { attributes: true, attributeFilter: ["style", "hidden"] }); });
    mo.observe(hub, { childList: true });
  }

  buildChips(); setView(view); apply(true); pull();
  setTimeout(function () { apply(false); }, 600); setTimeout(function () { apply(false); }, 2500);
})();
