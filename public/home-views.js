/* UPDATE 34 - HOME layouts (13), search, category chips, Surprise me. Never edits the cards' content; works alongside home.js. */
(function () {
  "use strict";
  var hub = document.querySelector(".hub"), strip = document.querySelector(".feature-strip"), footer = document.querySelector(".hub-footer");
  if (!hub || !strip || !footer) return;
  var DEFAULT_VIEW = "cards"; // <- change to make another layout the first one new visitors see (id from VIEWS below)
  var cats = {
    Geography: ["flagle", "travle"],
    "Word clues": ["blindle", "oracle", "rangedle", "structle", "codedle"],
    "Colour & symbols": ["colorblindle", "colordle", "shapedle", "twistle"],
    Puzzles: ["findle", "crossdle", "textle"]
  };
  var NEW_GAMES = ["shapedle"]; // ids that show a NEW tag
  var VIEWS = [["cards","🃏","Cards"],["grid","▦","Grid"],["list","☰","List"],["icons","🔳","Icons"],["swipe","👉","Swipe"],["mosaic","🧩","Mosaic"],["hero","⭐","Hero"],["pills","💊","Pills"],["fold","📂","Fold"],["bubbles","🫧","Bubbles"],["arcade","🕹️","Arcade"],["sections","🗂️","Sections"],["bands","🎽","Bands"]];
  var STAGE = { swipe: 1, hero: 1, sections: 1 };
  var LS = "homeView.v2";
  function cards() { return Array.prototype.slice.call(document.querySelectorAll(".game-card[data-game]")); }
  function visible() { return cards().filter(function (c) { return !c.hidden && !c.classList.contains("hv-filtered"); }); }
  function catOf(id) { for (var k in cats) if (cats[k].indexOf(id) > -1) return k; return "Other"; }
  function el(t, c, txt) { var e = document.createElement(t); if (c) e.className = c; if (txt) e.textContent = txt; return e; }
  function ok(v) { return VIEWS.some(function (x) { return x[0] === v; }); }

  var view = DEFAULT_VIEW, cat = "All";
  try { view = localStorage.getItem(LS) || DEFAULT_VIEW; } catch (e) {}
  try { var qv = new URLSearchParams(location.search).get("view"); if (qv) view = qv; } catch (e) {}
  if (!ok(view)) view = "cards";

  var bar = el("div", "hv-bar"), views = el("div", "hv-views"), chipsBox = el("div", "hv-chips");
  var search = el("input", "hv-search"); search.type = "search"; search.placeholder = "🔎 Search games...";
  var count = el("div", "hv-count"), empty = el("div", "hv-empty", "No games match. Try another word."); empty.hidden = true;
  var rnd = el("button", "hv-random", "🎲 Surprise me"); rnd.type = "button";
  var stage = el("div", "hv-stage");

  VIEWS.forEach(function (v) {
    var b = el("button", "hv-view"); b.type = "button"; b.dataset.v = v[0];
    b.innerHTML = "<b>" + v[1] + "</b><small>" + v[2] + "</small>";
    b.onclick = function () { setView(v[0]); };
    views.appendChild(b);
  });
  ["All"].concat(Object.keys(cats)).forEach(function (c) {
    var b = el("button", "hv-chip", c); b.type = "button";
    b.onclick = function () { cat = c; apply(); };
    chipsBox.appendChild(b);
  });
  bar.appendChild(views); bar.appendChild(search); bar.appendChild(chipsBox); bar.appendChild(count);
  strip.parentNode.insertBefore(bar, strip.nextSibling);
  bar.parentNode.insertBefore(rnd, bar.nextSibling);
  hub.insertBefore(stage, footer);
  hub.insertBefore(empty, footer);

  cards().forEach(function (c) {
    if (NEW_GAMES.indexOf(c.getAttribute("data-game")) > -1) c.appendChild(el("span", "hv-tagnew", "NEW"));
  });

  function setView(v) {
    view = v;
    try { localStorage.setItem(LS, v); } catch (e) {}
    hub.className = hub.className.replace(/\bv-\w+/g, "").trim() + " v-" + v;
    document.body.classList.toggle("hv-arcade", v === "arcade");
    Array.prototype.forEach.call(views.children, function (b) {
      var on = b.dataset.v === v; b.classList.toggle("on", on);
      if (on && b.scrollIntoView) { try { views.scrollTo({ left: b.offsetLeft - 20, behavior: "smooth" }); } catch (e) {} }
    });
    cards().forEach(function (c) { c.classList.remove("hv-open"); });
    renderStage(true);
  }

  /* ---- stage layouts: built from clones of the visible cards (originals stay for the customizer) ---- */
  var lastSig = "", car = null, dots = null;
  function sig() { return visible().map(function (c) { return c.getAttribute("data-game") + c.getAttribute("style") + c.textContent.length; }).join("|"); }
  function clone(c, cls) {
    var n = c.cloneNode(true); n.removeAttribute("data-game"); n.classList.add("hv-clone", cls); return n;
  }
  function groups(list) {
    var order = Object.keys(cats).concat("Other"), out = [];
    order.forEach(function (k) {
      var items = list.filter(function (c) { return catOf(c.getAttribute("data-game")) === k; });
      if (items.length) out.push([k, items]);
    });
    return out;
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
    if (view === "swipe") {
      car = el("div", "hv-car"); dots = el("div", "hv-dots");
      list.forEach(function (c) { car.appendChild(clone(c, "hv-slide")); dots.appendChild(el("i")); });
      stage.appendChild(car); stage.appendChild(dots);
      car.addEventListener("scroll", updDots); setTimeout(updDots, 50);
    } else if (view === "hero") {
      var h = clone(list[0], "hv-hero"), nm = h.querySelector(".game-name");
      if (nm) nm.appendChild(el("span", "hv-herobadge", "⭐ FEATURED"));
      stage.appendChild(h);
      groups(list.slice(1)).forEach(function (g) {
        stage.appendChild(el("h3", "hv-sec", g[0] + " · " + g[1].length));
        var row = el("div", "hv-row");
        g[1].forEach(function (c) { row.appendChild(clone(c, "hv-poster")); });
        stage.appendChild(row);
      });
    } else if (view === "sections") {
      groups(list).forEach(function (g) {
        stage.appendChild(el("h3", "hv-sec", g[0] + " · " + g[1].length));
        var grid = el("div", "hv-secgrid");
        g[1].forEach(function (c) { grid.appendChild(clone(c, "hv-mini")); });
        stage.appendChild(grid);
      });
    }
  }

  function apply() {
    var q = search.value.trim().toLowerCase(), shown = 0, total = 0, first = null;
    cards().forEach(function (c) {
      var id = c.getAttribute("data-game");
      var good = (cat === "All" || catOf(id) === cat) && (!q || c.textContent.toLowerCase().indexOf(q) > -1);
      c.classList.toggle("hv-filtered", !good);
      c.classList.remove("hv-first");
      if (!c.hidden) { total++; if (good) { shown++; if (!first) first = c; } }
    });
    if (first) first.classList.add("hv-first");
    Array.prototype.forEach.call(chipsBox.children, function (b) { b.classList.toggle("on", b.textContent === cat); });
    count.textContent = shown + " of " + total + " games";
    empty.hidden = shown > 0;
    renderStage(false);
  }
  search.addEventListener("input", apply);
  rnd.onclick = function () {
    var list = visible();
    if (list.length) location.href = list[Math.floor(Math.random() * list.length)].getAttribute("href");
  };

  /* ---- icons: details sheet / fold: expand in place ---- */
  var ov = el("div", "hv-sheet-o"); ov.hidden = true; document.body.appendChild(ov);
  ov.addEventListener("click", function (e) { if (e.target === ov) ov.hidden = true; });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") ov.hidden = true; });
  function openSheet(c) {
    var cs = getComputedStyle(c), s = el("div", "hv-sheet");
    s.style.setProperty("--hv-c", cs.getPropertyValue("--accent") || "#999");
    s.style.setProperty("--hv-d", cs.getPropertyValue("--accent-deep") || "#555");
    s.appendChild(el("h2", "", c.querySelector(".game-icon").textContent + " " + c.querySelector(".game-name").textContent));
    s.appendChild(el("p", "", c.querySelector(".game-desc").textContent));
    var tg = el("div", "tags");
    Array.prototype.forEach.call(c.querySelectorAll(".tag"), function (t) { tg.appendChild(el("span", "", t.textContent)); });
    s.appendChild(tg);
    var a = el("a", "go", c.querySelector(".play-cta").textContent); a.href = c.getAttribute("href");
    s.appendChild(a);
    ov.innerHTML = ""; ov.appendChild(s); ov.hidden = false;
  }
  hub.addEventListener("click", function (e) {
    var c = e.target.closest && e.target.closest(".game-card[data-game]");
    if (!c) return;
    if (view === "icons") { e.preventDefault(); openSheet(c); }
    else if (view === "fold") {
      if (c.classList.contains("hv-open") && e.target.closest(".play-cta")) return;
      e.preventDefault();
      var was = c.classList.contains("hv-open");
      cards().forEach(function (x) { x.classList.remove("hv-open"); });
      if (!was) c.classList.add("hv-open");
    }
  });

  /* ---- keep in sync when the customizer hides / recolors / reorders cards ---- */
  var t = null;
  function later() { clearTimeout(t); t = setTimeout(apply, 150); }
  if (window.MutationObserver) {
    var mo = new MutationObserver(later);
    cards().forEach(function (c) { mo.observe(c, { attributes: true, attributeFilter: ["style", "hidden"] }); });
    mo.observe(hub, { childList: true });
  }

  setView(view); apply();
  setTimeout(apply, 600); setTimeout(apply, 2500);
})();
