/* ==========================================================================
   LEGENDS SETTINGS / COLOR LEGEND  (update 24, extended in update 31) - shared by every word game.

   What it does
     - Builds a small "what the colors mean" legend for the game named in
       <body data-game="..."> and puts it in the page flow: by default directly UNDER the floating
       message window (the guess-rejection toast) and ABOVE the keyboard and the guess board.
       It is a normal block element - never absolutely positioned - so it can never overlap the
       floating window, the keyboard or the board. The games measure the space left and shrink the
       board to fit; this script also shrinks the legend itself (Auto-fit) if it ever gets too tall.
     - Adds a "Color legend" section to the game's settings panel (right after "Color shades") where
       the host can change: show/hide, position, alignment, title, text of every entry, the
       chip text, the order of the entries, extra custom entries, any entry's color, overall size,
       chip size, spacing, font, chip shape, number of columns and rows, panel background, label text.
     - Settings are applied instantly, cached in this browser (no flash on reload) and shared by every
       screen connected to the same game through the Socket.IO namespace /legends
       (see server/shared/legend-hub.js), exactly like Color shades.

   Colors always come from the game's own CSS variables (the same ones the tiles and keyboard use),
   so changing "Color shades" recolors the legend too.
   ========================================================================== */
(function () {
  "use strict";

  var script = document.currentScript;
  var game = (script && script.getAttribute("data-game")) ||
    (document.body && document.body.getAttribute("data-game")) || "";

  /* ------------------------------------------------------------------ defaults */
  function V(v, bg, fg, bd) {
    return { bg: "var(" + v + "," + bg + ")", fg: "var(" + v + "-ink," + fg + ")", bd: "var(" + v + "-dark," + (bd || "rgba(0,0,0,.35)") + ")" };
  }
  var ICON_LINE = '<svg viewBox="0 0 24 24"><path d="M4 12h16"/></svg>';
  var ICON_CURVE = '<svg viewBox="0 0 24 24"><path d="M3 15c0-8 6-9 6-3s6 5 6-3"/></svg>';

  var STRONG = {
    green: V("--strong-green", "#0E9F45", "#fff", "#087A32"),
    yellow: V("--strong-yellow", "#FFC400", "#241a00", "#D9A100"),
    red: V("--strong-red", "#E11D2E", "#fff", "#B3101F")
  };
  var CB = {
    red: V("--cb-red", "#E11D2E", "#fff"),
    blue: V("--cb-blue", "#1E73E8", "#fff"),
    yellow: V("--cb-yellow", "#FFC400", "#241a00"),
    purple: V("--cb-purple", "#7B3FE4", "#fff"),
    hit: V("--cb-hit", "#0E9F45", "#fff"),
    miss: V("--cb-miss", "#8B8F9E", "#fff")
  };

  var DEFAULTS = {
    blindle: {
      title: "What the numbers' colors mean",
      items: [
        { id: "green", glyph: "#", label: "Green — letters in the right spot", c: STRONG.green },
        { id: "yellow", glyph: "#", label: "Yellow — right letter, wrong spot", c: STRONG.yellow },
        { id: "red", glyph: "#", label: "Red — letters not in the word", c: STRONG.red }
      ]
    },
    oracle: {
      title: "What the three columns mean",
      items: [
        { id: "green", glyph: "#", label: "Green — right letter & spot", c: STRONG.green },
        { id: "yellow", glyph: "#", label: "Yellow — right letter, wrong spot", c: STRONG.yellow },
        { id: "red", glyph: "#", label: "Red — not in the word", c: STRONG.red }
      ]
    },
    colorblindle: {
      title: "What the colors mean",
      items: [
        { id: "red", glyph: "", label: "Red — how many red letters", c: CB.red },
        { id: "blue", glyph: "", label: "Blue — how many blue letters", c: CB.blue },
        { id: "yellow", glyph: "", label: "Yellow — how many yellow letters", c: CB.yellow },
        { id: "purple", glyph: "", label: "Purple — how many purple letters", c: CB.purple },
        { id: "hit", glyph: "A", label: "Green — correct letter", c: CB.hit },
        { id: "miss", glyph: "A", label: "Gray — incorrect letter", c: CB.miss }
      ]
    },
    colordle: {
      title: "What the colors mean",
      items: [
        { id: "red", glyph: "", label: "Red — a red-key letter", c: CB.red },
        { id: "blue", glyph: "", label: "Blue — a blue-key letter", c: CB.blue },
        { id: "yellow", glyph: "", label: "Yellow — a yellow-key letter", c: CB.yellow },
        { id: "purple", glyph: "", label: "Purple — a purple-key letter", c: CB.purple },
        { id: "hit", glyph: "A", label: "Green — correct letter", c: CB.hit },
        { id: "miss", glyph: "A", label: "Gray — incorrect letter", c: CB.miss }
      ]
    },
    structle: {
      title: "What the two numbers mean",
      items: [
        { id: "lines", glyph: "", icon: ICON_LINE, label: "Straight-lines difference", c: { bg: "var(--chip, rgba(127,127,160,.35))", fg: "var(--text, #fff)", bd: "rgba(127,127,160,.55)" } },
        { id: "curves", glyph: "", icon: ICON_CURVE, label: "Curves difference", c: { bg: "var(--chip, rgba(127,127,160,.35))", fg: "var(--text, #fff)", bd: "rgba(127,127,160,.55)" } },
        { id: "zero", glyph: "0", label: "Green — a clue of 0 is a match", c: V("--st-zero", "#0E9F45", "#fff", "#087A32") }
      ]
    },
    textle: {
      title: "What the colors mean",
      items: [
        { id: "green", glyph: "A", label: "Green — right place", c: V("--tx-green", "#0E9F45", "#fff", "#087A32") },
        { id: "yellow", glyph: "A", label: "Yellow — needs rearranging", c: V("--tx-yellow", "#FFC400", "#241a00", "#D9A100") },
        { id: "gray", glyph: "A", label: "Gray — not in the word", c: V("--tx-gray", "#7B8092", "#fff", "#5A5F70") }
      ]
    },
    rangedle: {
      title: "Distance from the hidden letter",
      items: [
        { id: "d1", glyph: "1–5", label: "Red — 1–5 away", c: V("--rg-d1", "#E11D2E", "#fff", "#B3101F") },
        { id: "d2", glyph: "6–10", label: "Orange — 6–10 away", c: V("--rg-d2", "#F57C00", "#fff", "#BF5F00") },
        { id: "d3", glyph: "11–15", label: "Yellow — 11–15 away", c: V("--rg-d3", "#E5B400", "#241a00", "#B38C00") },
        { id: "d4", glyph: "16–20", label: "Blue — 16–20 away", c: V("--rg-d4", "#1E73E8", "#fff", "#1456B0") },
        { id: "d5", glyph: "21–25", label: "Purple — 21–25 away", c: V("--rg-d5", "#7B3FE4", "#fff", "#5A25B8") },
        { id: "hit", glyph: "✓", label: "Green — correct letter", c: V("--rg-hit", "#0E9F45", "#fff", "#087A32") }
      ]
    },
    shapedle: {
      title: "What the colors mean",
      items: [
        { id: "green", glyph: "A", label: "Green — right spot", c: V("--sp-green", "#0E9F45", "#fff", "#087A32") },
        { id: "yellow", glyph: "A", label: "Yellow — wrong spot", c: V("--sp-yellow", "#E5B400", "#241a00", "#B38C00") },
        { id: "gray", glyph: "A", label: "Gray — not in word", c: V("--sp-gray", "#7B8092", "#fff", "#5A5F70") }
      ]
    },
    codedle: {
      title: "What the colors mean",
      items: [
        { id: "hit", glyph: "A", label: "Green — right spot", c: V("--cd-hit", "#0E9F45", "#fff", "#087A32") },
        { id: "yellow", glyph: "A", label: "Yellow — wrong spot", c: V("--cd-yellow", "#E5B400", "#241a00", "#B38C00") },
        { id: "blue", glyph: "A", label: "Blue — within 3 letters", c: V("--cd-blue", "#5FB4FF", "#06223d", "#2F86D6") },
        { id: "pink", glyph: "A", label: "Pink — yellow + blue", c: V("--cd-pink", "#FF8FC8", "#3d0a25", "#D9569B") },
        { id: "gray", glyph: "A", label: "Gray — not in word", c: V("--cd-gray", "#7B8092", "#fff", "#5A5F70") }
      ]
    },
    twistle: {
      title: "What the tiles mean",
      items: [
        { id: "mint", glyph: "◆", label: "Lit symbol — the letter is in your guess", c: { bg: "rgba(53,230,171,.22)", fg: "var(--mint, #35e6ab)", bd: "var(--mint, #35e6ab)" } },
        { id: "dark", glyph: "◇", label: "Dark symbol — not in your guess", c: { bg: "#0b0c1e", fg: "#8a8fc9", bd: "#2b2e5c" } },
        { id: "hidden", glyph: "?", label: "Meanings are revealed when the round ends", c: { bg: "rgba(127,127,160,.25)", fg: "var(--text, #fff)", bd: "rgba(127,127,160,.5)" } }
      ]
    },
    crossdle: {
      title: "What the colors mean",
      items: [
        { id: "green", glyph: "A", label: "Green — right spot", c: { bg: "var(--green, #3fd67a)", fg: "#06210f", bd: "rgba(0,0,0,.25)" } },
        { id: "yellow", glyph: "A", label: "Yellow — wrong spot", c: { bg: "var(--yellow, #ffcf52)", fg: "#3a2a06", bd: "rgba(0,0,0,.25)" } },
        { id: "grey", glyph: "A", label: "Gray — not in the word", c: { bg: "var(--grey, #5a5f8c)", fg: "#fff", bd: "rgba(0,0,0,.3)" } },
        { id: "decoy", glyph: "A", label: "Blue — decoy word", c: { bg: "var(--decoy, #4aa3ff)", fg: "#06223d", bd: "rgba(0,0,0,.25)" } }
      ]
    }
  };

  var DEF = DEFAULTS[game];
  if (!DEF) return; // not a game with a legend

  var MAX_ITEMS = 16;
  var POSITIONS = [
    ["top", "Top - under the floating message window"],
    ["aboveKeyboard", "Directly above the keyboard"],
    ["belowKeyboard", "Directly below the keyboard"],
    ["aboveBoard", "Just above the guess board"],
    ["belowBoard", "Below the guess board"]
  ];
  var FLOWS = [["row", "Across - fill row by row"], ["column", "Down - fill column by column"]];
  var OVERFLOWS = [["grow", "Add extra rows / columns so every entry shows"], ["hide", "Hide the entries that do not fit"]];
  var ITEM_LAYOUTS = [["side", "Color chip, then text"], ["rev", "Text, then color chip"], ["stack", "Color chip above the text"]];
  var CELL_FITS = [["equal", "Equal-width cells"], ["content", "Fit to each entry (compact)"]];
  var CELL_ALIGNS = [["auto", "Same as Alignment"], ["start", "Left"], ["center", "Center"], ["end", "Right"]];
  var MAX_GRID = 12;
  // Quick layouts shown as buttons: [label, columns, rows]  (0 = Auto)
  var PRESETS = [
    ["Auto", 0, 0], ["1 row", 0, 1], ["1 column", 1, 0], ["2 rows", 0, 2], ["2 columns", 2, 0],
    ["2 × 2", 2, 2], ["2 × 3", 3, 2], ["3 × 2", 2, 3], ["3 × 3", 3, 3], ["2 × 4", 4, 2], ["4 × 2", 2, 4]
  ];
  var ALIGNS = [["left", "Left"], ["center", "Center"], ["right", "Right"]];
  var SHAPES = [["rounded", "Rounded square"], ["square", "Square"], ["circle", "Circle"], ["bar", "Wide bar"]];
  var FONTS = [
    { id: "default", name: "Game default" },
    { id: "inter", name: "Inter", css: "Inter", fam: "Inter:wght@500;700;800" },
    { id: "spacegrotesk", name: "Space Grotesk", css: "Space Grotesk", fam: "Space+Grotesk:wght@500;700" },
    { id: "quicksand", name: "Quicksand", css: "Quicksand", fam: "Quicksand:wght@500;700" },
    { id: "poppins", name: "Poppins", css: "Poppins", fam: "Poppins:wght@500;700;800" },
    { id: "oswald", name: "Oswald", css: "Oswald", fam: "Oswald:wght@500;700" },
    { id: "fredoka", name: "Fredoka", css: "Fredoka", fam: "Fredoka:wght@500;700" },
    { id: "baloo", name: "Baloo 2", css: "Baloo 2", fam: "Baloo+2:wght@600;800" },
    { id: "pacifico", name: "Pacifico", css: "Pacifico", fam: "Pacifico" },
    { id: "lobster", name: "Lobster", css: "Lobster", fam: "Lobster" },
    { id: "bangers", name: "Bangers", css: "Bangers", fam: "Bangers" },
    { id: "bungee", name: "Bungee", css: "Bungee", fam: "Bungee" },
    { id: "chewy", name: "Chewy", css: "Chewy", fam: "Chewy" },
    { id: "righteous", name: "Righteous", css: "Righteous", fam: "Righteous" },
    { id: "titan", name: "Titan One", css: "Titan One", fam: "Titan+One" },
    { id: "robotomono", name: "Roboto Mono", css: "Roboto Mono", fam: "Roboto+Mono:wght@500;700" },
    { id: "marker", name: "Permanent Marker", css: "Permanent Marker", fam: "Permanent+Marker" },
    { id: "pixel", name: "Press Start 2P", css: "Press Start 2P", fam: "Press+Start+2P" },
    { id: "arial", name: "Arial (system)", css: "Arial, Helvetica, sans-serif" },
    { id: "georgia", name: "Georgia (system)", css: "Georgia, serif" },
    { id: "trebuchet", name: "Trebuchet (system)", css: "'Trebuchet MS', sans-serif" },
    { id: "verdana", name: "Verdana (system)", css: "Verdana, sans-serif" },
    { id: "impact", name: "Impact (system)", css: "Impact, 'Arial Black', sans-serif" },
    { id: "courier", name: "Courier (system)", css: "'Courier New', monospace" }
  ];

  /* ------------------------------------------------------------------ state */
  var S = null;            // current settings (always a complete, normalized object)
  var socket = null;
  var storageKey = "gameLegend:" + game;
  var el = null;           // the legend section element
  var panelRoot = null;    // the settings UI
  var lastHeight = -1;
  var selfResize = false;
  var applyingRemote = false;
  var sendTimer = null;
  var pending = false;     // my edits that have not been sent to the server yet
  var cid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);   // this screen's id

  function defMap() {
    var m = {};
    DEF.items.forEach(function (d) { m[d.id] = d; });
    return m;
  }
  function defaultSettings() {
    return {
      visible: true, position: "top", align: "center",
      showTitle: true, title: DEF.title, showText: true, panel: true, autoFit: true,
      shape: "rounded", scale: 100, chipScale: 100, rowGap: 6, colGap: 10, maxWidth: 640,
      columns: 0, rows: 0, flow: "row", overflow: "grow", itemLayout: "side", cellFit: "equal", cellAlign: "auto",
      font: "default",
      items: DEF.items.map(function (d) { return { id: d.id, enabled: true, label: d.label, glyph: d.glyph }; })
    };
  }
  function inList(list, v, fb) {
    for (var i = 0; i < list.length; i++) { var k = Array.isArray(list[i]) ? list[i][0] : list[i]; if (k === v) return v; }
    return fb;
  }
  function clampNum(v, lo, hi, fb) {
    var n = Number(v);
    return isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fb;
  }
  // Turns whatever was stored/received into a complete valid settings object.
  function normalize(raw) {
    var d = defaultSettings();
    if (!raw || typeof raw !== "object") return d;
    var o = {
      visible: raw.visible !== false,
      position: inList(POSITIONS, raw.position, "top"),
      align: inList(ALIGNS, raw.align, "center"),
      showTitle: raw.showTitle !== false,
      title: typeof raw.title === "string" ? raw.title : d.title,
      showText: raw.showText !== false,
      panel: raw.panel !== false,
      autoFit: raw.autoFit !== false,
      shape: inList(SHAPES, raw.shape, "rounded"),
      scale: clampNum(raw.scale, 50, 220, 100),
      chipScale: clampNum(raw.chipScale, 50, 220, 100),
      rowGap: clampNum(raw.rowGap !== undefined ? raw.rowGap : raw.gap, 0, 60, 6),
      colGap: clampNum(raw.colGap !== undefined ? raw.colGap : (isFinite(Number(raw.gap)) ? Number(raw.gap) * 1.6 : 10), 0, 60, 10),
      maxWidth: clampNum(raw.maxWidth, 200, 1200, 640),
      columns: clampNum(raw.columns, 0, MAX_GRID, 0),
      rows: clampNum(raw.rows, 0, MAX_GRID, 0),
      flow: inList(FLOWS, raw.flow, (Number(raw.rows) > 0 && !(Number(raw.columns) > 0)) ? "column" : "row"),
      overflow: inList(OVERFLOWS, raw.overflow, "grow"),
      itemLayout: inList(ITEM_LAYOUTS, raw.itemLayout, "side"),
      cellFit: inList(CELL_FITS, raw.cellFit, "equal"),
      cellAlign: inList(CELL_ALIGNS, raw.cellAlign, "auto"),
      font: inList(FONTS.map(function (f) { return f.id; }), raw.font, "default"),
      items: []
    };
    var dm = defMap(), seen = {};
    (Array.isArray(raw.items) ? raw.items : []).forEach(function (it) {
      if (!it || typeof it.id !== "string" || seen[it.id] || o.items.length >= MAX_ITEMS) return;
      var isDefault = !!dm[it.id];
      if (!isDefault && !/^x[a-z0-9]{1,10}$/.test(it.id)) return; // unknown ids from an old version are dropped
      seen[it.id] = 1;
      var n = {
        id: it.id,
        enabled: it.enabled !== false,
        label: typeof it.label === "string" ? it.label : (isDefault ? dm[it.id].label : ""),
        glyph: typeof it.glyph === "string" ? it.glyph : (isDefault ? dm[it.id].glyph : "")
      };
      if (typeof it.color === "string" && /^#[0-9a-fA-F]{6}$/.test(it.color)) n.color = it.color;
      o.items.push(n);
    });
    // Entries the game has but the saved settings don't know about yet are appended.
    DEF.items.forEach(function (x) {
      if (!seen[x.id]) o.items.push({ id: x.id, enabled: true, label: x.label, glyph: x.glyph });
    });
    return o;
  }

  function readCache() {
    try { var t = localStorage.getItem(storageKey); S = normalize(t ? JSON.parse(t) : null); }
    catch (e) { S = defaultSettings(); }
  }
  function writeCache() {
    try { localStorage.setItem(storageKey, JSON.stringify(S)); } catch (e) { /* private mode: still works this session */ }
  }

  /* ------------------------------------------------------------------ helpers */
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function hexToRgb(hex) { var n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function inkFor(hex) {
    var c = hexToRgb(hex);
    function lin(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    var lum = 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
    return lum > 0.4 ? "#1f2230" : "#ffffff";
  }
  function darker(hex) {
    var c = hexToRgb(hex);
    return "rgb(" + Math.round(c[0] * 0.68) + "," + Math.round(c[1] * 0.68) + "," + Math.round(c[2] * 0.68) + ")";
  }
  function rgbStringToHex(s) {
    var m = /rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/.exec(s || "");
    if (!m) return "#888888";
    function h(v) { v = Number(v); return (v < 16 ? "0" : "") + v.toString(16); }
    return "#" + h(m[1]) + h(m[2]) + h(m[3]);
  }
  function fontById(id) {
    for (var i = 0; i < FONTS.length; i++) if (FONTS[i].id === id) return FONTS[i];
    return FONTS[0];
  }
  function ensureFont(f) {
    if (!f || !f.fam) return;
    var id = "legendFont-" + f.id;
    if (document.getElementById(id)) return;
    var l = document.createElement("link");
    l.id = id; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=" + f.fam + "&display=swap";
    document.head.appendChild(l);
  }
  function labelHtml(label) {
    var i = label.indexOf(" — ");
    if (i > 0) return "<b>" + esc(label.slice(0, i)) + "</b> — " + esc(label.slice(i + 3));
    return esc(label);
  }

  /* ------------------------------------------------------------------ DOM placement */
  // The on-screen keyboard block (most games: #keyboardSection, CROSSDLE: .keyboard-section). STRUCTLE has none.
  function keyboardEl() {
    return document.getElementById("keyboardSection") || document.querySelector(".keyboard-section");
  }
  function findParts() {
    var container = document.querySelector(".round-card") || document.querySelector(".board-section");
    if (!container) return null;
    var toast = container.querySelector(".toast-slot");       // CROSSDLE keeps its floating slot inside the card
    var board = document.getElementById("tilesWrap") || document.getElementById("grid") || document.getElementById("board");
    var code = document.getElementById("codeSection");
    return { container: container, toast: toast, board: board, code: code };
  }
  function place() {
    if (!el) return;
    var p = findParts();
    if (!p) return;
    var pos = S.position;
    var board = p.board;
    var kb = keyboardEl();
    if (pos === "aboveKeyboard" && kb && kb.parentNode) {
      kb.parentNode.insertBefore(el, kb);                          // directly above the keyboard
    } else if (pos === "belowKeyboard" && kb && kb.parentNode) {
      kb.parentNode.insertBefore(el, kb.nextSibling);              // directly below the keyboard
    } else if (pos === "belowKeyboard" && board && board.parentNode) {
      var a2 = p.code && p.code.parentNode === board.parentNode ? p.code : board;   // game has no keyboard
      a2.parentNode.insertBefore(el, a2);
    } else if (pos === "belowBoard" && board && board.parentNode) {
      board.parentNode.insertBefore(el, board.nextSibling);
    } else if (pos === "aboveBoard" && board && board.parentNode) {
      var anchor = p.code && p.code.parentNode === board.parentNode ? p.code : board;
      anchor.parentNode.insertBefore(el, anchor);
    } else if (p.toast && p.toast.parentNode) {
      p.toast.parentNode.insertBefore(el, p.toast.nextSibling);   // right under the floating message window
    } else {
      p.container.insertBefore(el, p.container.firstChild);
    }
  }

  /* ------------------------------------------------------------------ rendering */
  function itemColors(it, d) {
    if (it.color) return { bg: it.color, fg: inkFor(it.color), bd: darker(it.color) };
    return d ? d.c : { bg: "#888", fg: "#fff", bd: "rgba(0,0,0,.35)" };
  }
  function buildSection() {
    var p = findParts();
    if (!p) return false;
    el = document.getElementById("legendSection");
    if (!el) {
      el = document.createElement("section");
      el.id = "legendSection";
    }
    el.className = "lgSection";
    el.setAttribute("aria-label", "Color legend");
    place();
    return true;
  }

  // Works out the exact grid for the number of entries that will show.
  //   Columns only -> that many columns, rows follow.   Rows only -> that many rows, columns follow.
  //   Both set     -> exactly rows x columns cells; if there are more entries than cells the host chooses to
  //                   add extra rows/columns ("grow") or to hide the entries that do not fit ("hide").
  function layoutInfo(n) {
    var C = S.columns, R = S.rows;
    var L = { mode: "auto", cols: 0, rows: 0, cells: 0, shown: n, hidden: 0, grown: false, empty: 0 };
    if (!C && !R) return L;
    if (C && R) {
      L.mode = "grid"; L.cols = C; L.rows = R; L.cells = C * R;
      if (n > L.cells) {
        if (S.overflow === "hide") { L.shown = L.cells; L.hidden = n - L.cells; }
        else {
          L.grown = true;
          if (S.flow === "column") L.cols = Math.ceil(n / R); else L.rows = Math.ceil(n / C);
        }
      }
    } else if (C) {
      L.mode = "columns"; L.cols = C; L.rows = Math.max(1, Math.ceil(n / C));
    } else {
      L.mode = "rows"; L.rows = R; L.cols = Math.max(1, Math.ceil(n / R));
    }
    L.empty = Math.max(0, L.cols * L.rows - L.shown);
    return L;
  }
  function updateLayoutInfo(L) {
    if (!panelRoot) return;
    var box = panelRoot.querySelector("#lgInfo");
    if (!box) return;
    var txt;
    if (L.mode === "auto") {
      txt = "Automatic layout: " + L.shown + " entries, the number of columns adapts to the available width.";
    } else {
      txt = L.shown + " entries shown in " + L.rows + " row" + (L.rows === 1 ? "" : "s") + " × " + L.cols + " column" + (L.cols === 1 ? "" : "s") + ".";
      if (L.mode === "grid" && L.grown) txt += " Your " + S.rows + " × " + S.columns + " grid has only " + (S.rows * S.columns) + " cells, so extra " + (S.flow === "column" ? "columns were" : "rows were") + " added.";
      else if (L.hidden > 0) txt += " " + L.hidden + " entr" + (L.hidden === 1 ? "y does" : "ies do") + " not fit and " + (L.hidden === 1 ? "is" : "are") + " hidden.";
      else if (L.empty > 0) txt += " " + L.empty + " empty cell" + (L.empty === 1 ? "" : "s") + ".";
    }
    box.textContent = txt;
  }

  function render() {
    if (!el) { if (!buildSection()) return; }
    var dm = defMap();
    var visibleItems = S.items.filter(function (it) { return it.enabled; });
    var L = layoutInfo(visibleItems.length);
    if (L.hidden > 0) visibleItems = visibleItems.slice(0, L.shown);

    el.hidden = !S.visible || visibleItems.length === 0;
    el.className = "lgSection" +
      (S.panel ? " lgPanel" : "") +
      " lgAlign" + S.align.charAt(0).toUpperCase() + S.align.slice(1) +
      " lgShape-" + S.shape +
      (L.mode === "auto" ? " lgAuto" : " lgFixed") +
      (L.mode !== "auto" && S.flow === "column" ? " lgFlowCol" : "") +
      (S.cellFit === "content" ? " lgFit-content" : "") +
      " lgIL-" + S.itemLayout +
      (S.cellAlign !== "auto" ? " lgCell-" + S.cellAlign : "");

    var font = fontById(S.font);
    ensureFont(font);
    if (font.id === "default") el.style.removeProperty("--lg-font");
    else el.style.setProperty("--lg-font", font.fam ? "'" + font.css + "', sans-serif" : font.css);
    el.style.setProperty("--lg-scale", String(S.scale / 100));
    el.style.setProperty("--lg-chip", String(S.chipScale / 100));
    el.style.setProperty("--lg-row-gap", S.rowGap + "px");
    el.style.setProperty("--lg-col-gap", S.colGap + "px");
    el.style.setProperty("--lg-cols", String(Math.max(1, L.cols)));
    el.style.setProperty("--lg-rows", String(Math.max(1, L.rows)));
    el.style.setProperty("--lg-jc", S.align === "left" ? "flex-start" : (S.align === "right" ? "flex-end" : "center"));
    el.style.maxWidth = S.maxWidth + "px";
    updateLayoutInfo(L);
    el.style.setProperty("--lg-fit", "1");

    var html = "";
    if (S.showTitle && S.title.trim()) html += '<div class="lgTitle">' + esc(S.title) + "</div>";
    html += '<ul class="lgList">';
    visibleItems.forEach(function (it) {
      var d = dm[it.id];
      var c = itemColors(it, d);
      var inner = it.glyph ? esc(it.glyph) : (d && d.icon && !it.glyph ? d.icon : "");
      html += '<li class="lgItem" title="' + esc(it.label) + '">' +
        '<span class="lgChip" style="--lg-bg:' + c.bg + ";--lg-fg:" + c.fg + ";--lg-bd:" + c.bd + '">' + inner + "</span>" +
        (S.showText && it.label ? '<span class="lgText">' + labelHtml(it.label) + "</span>" : "") +
        "</li>";
    });
    html += "</ul>";
    el.innerHTML = html;

    place();
    requestAnimationFrame(function () { fit(); });
  }

  // Keeps the legend from eating the board: shrinks it (never below 55%) until it is at most about a
  // quarter of the screen height. Then tells the game to re-measure the board if the height changed.
  function fit() {
    if (!el || el.hidden) { notifyHeight(0); return; }
    el.style.setProperty("--lg-fit", "1");
    if (S.autoFit) {
      var maxH = Math.max(64, Math.round(window.innerHeight * 0.26));
      var f = 1;
      while (el.offsetHeight > maxH && f > 0.56) {
        f = Math.round((f - 0.04) * 100) / 100;
        el.style.setProperty("--lg-fit", String(f));
      }
    }
    notifyHeight(el.offsetHeight);
  }
  function notifyHeight(h) {
    if (Math.abs(h - lastHeight) < 1) return;
    lastHeight = h;
    selfResize = true;
    try { window.dispatchEvent(new Event("resize")); } catch (e) { /* ignore */ }
    selfResize = false;
  }
  var resizeTimer = null;
  window.addEventListener("resize", function () {
    if (selfResize) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(fit, 120);
  });
  window.addEventListener("orientationchange", function () { setTimeout(fit, 250); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { fit(); });

  /* ------------------------------------------------------------------ saving / syncing */
  function commit(structural) {
    writeCache();
    render();
    if (structural) buildItemsList();
    if (applyingRemote) return;
    clearTimeout(sendTimer);
    pending = true;
    sendTimer = setTimeout(function () {
      pending = false;
      if (socket && socket.connected) socket.emit("legend:set", { game: game, settings: S, cid: cid });
    }, 250);
  }
  function resetAll() {
    S = defaultSettings();
    try { localStorage.removeItem(storageKey); } catch (e) { /* ignore */ }
    render();
    syncControls();
    buildItemsList();
    clearTimeout(sendTimer);
    pending = false;
    if (socket && socket.connected) socket.emit("legend:reset", { game: game, cid: cid });
  }

  function connect() {
    if (socket) return;
    function go() {
      if (typeof io === "undefined") return;
      socket = io("/legends");
      socket.on("connect", function () { socket.emit("legend:join", { game: game }); });
      socket.on("legend:state", function (msg) {
        if (!msg || msg.game !== game) return;
        if (msg.by && msg.by === cid) return;      // my own change coming back: S is already newer than it
        if (pending) return;                       // I still have edits waiting to be sent; they win
        if (msg.settings == null && msg.kind === "join") {
          // The server has nothing saved (e.g. its disk was wiped on a redeploy) but this browser remembers the
          // host's legend: give it back to the server instead of resetting the host's design.
          var cached = null;
          try { cached = localStorage.getItem(storageKey); } catch (e) { /* ignore */ }
          if (cached) socket.emit("legend:set", { game: game, settings: S, cid: cid });
          return;
        }
        var busy = panelRoot && panelRoot.contains(document.activeElement) &&
          /^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement.tagName);
        applyingRemote = true;
        S = normalize(msg.settings);
        writeCache();
        render();
        if (!busy) { syncControls(); buildItemsList(); }
        applyingRemote = false;
      });
    }
    if (typeof io !== "undefined") { go(); return; }
    var tag = document.createElement("script");
    tag.src = "/socket.io/socket.io.js";
    tag.onload = go;
    document.head.appendChild(tag);
  }

  /* ------------------------------------------------------------------ settings panel */
  function selectHtml(id, list, value) {
    return '<select id="' + id + '">' + list.map(function (o) {
      return '<option value="' + o[0] + '"' + (o[0] === value ? " selected" : "") + ">" + esc(o[1]) + "</option>";
    }).join("") + "</select>";
  }
  function numOptions(maxN) {
    var a = [["0", "Auto"]];
    for (var i = 1; i <= maxN; i++) a.push([String(i), String(i)]);
    return a;
  }
  function positionList() {
    // CROSSDLE/others have a keyboard; STRUCTLE has none, so the two keyboard choices are hidden there.
    return keyboardEl() ? POSITIONS : POSITIONS.filter(function (o) { return !/Keyboard$/.test(o[0]); });
  }
  function panelHtml() {
    var presets = PRESETS.map(function (pr, i) {
      return '<button type="button" class="lgBtn lgPreset" data-i="' + i + '">' + esc(pr[0]) + "</button>";
    }).join("");
    return '' +
      '<label class="lgCheck"><input type="checkbox" id="lgVisible"> <span>Show the legend</span></label>' +
      '<h5>Position</h5>' +
      '<div class="lgRow"><label for="lgPosition">Place the legend</label>' + selectHtml("lgPosition", positionList(), S.position) + "</div>" +
      '<div class="lgRow"><label for="lgAlign">Alignment</label>' + selectHtml("lgAlign", ALIGNS, S.align) + "</div>" +
      '<h5>Layout - how many rows and columns</h5>' +
      '<div class="lgPresets" id="lgPresets">' + presets + "</div>" +
      '<div class="lgRow"><label for="lgColumns">Columns</label>' + selectHtml("lgColumns", numOptions(MAX_GRID), String(S.columns)) + "</div>" +
      '<div class="lgRow"><label for="lgRows">Rows</label>' + selectHtml("lgRows", numOptions(MAX_GRID), String(S.rows)) + "</div>" +
      '<p class="lgHelp">Set only <b>Columns</b> and the rows follow; set only <b>Rows</b> and the columns follow; set <b>both</b> for an exact rows × columns grid (for example 2 rows × 3 columns = 6 cells). <b>Auto</b> lets the screen width decide.</p>' +
      '<div class="lgRow"><label for="lgFlow">Fill order</label>' + selectHtml("lgFlow", FLOWS, S.flow) + "</div>" +
      '<div class="lgRow"><label for="lgOverflow">Too many entries</label>' + selectHtml("lgOverflow", OVERFLOWS, S.overflow) + "</div>" +
      '<div class="lgRow"><label for="lgItemLayout">Each entry</label>' + selectHtml("lgItemLayout", ITEM_LAYOUTS, S.itemLayout) + "</div>" +
      '<div class="lgRow"><label for="lgCellFit">Cell width</label>' + selectHtml("lgCellFit", CELL_FITS, S.cellFit) + "</div>" +
      '<div class="lgRow"><label for="lgCellAlign">Inside each cell</label>' + selectHtml("lgCellAlign", CELL_ALIGNS, S.cellAlign) + "</div>" +
      '<div class="lgRow"><label for="lgRowGap">Row spacing</label><input type="range" id="lgRowGap" min="0" max="60" step="1"><span class="lgVal" id="lgRowGapVal"></span></div>' +
      '<div class="lgRow"><label for="lgColGap">Column spacing</label><input type="range" id="lgColGap" min="0" max="60" step="1"><span class="lgVal" id="lgColGapVal"></span></div>' +
      '<div class="lgRow"><label for="lgMaxWidth">Maximum width</label><input type="range" id="lgMaxWidth" min="200" max="1200" step="10"><span class="lgVal" id="lgMaxWidthVal"></span></div>' +
      '<div class="lgInfo" id="lgInfo" aria-live="polite"></div>' +
      '<h5>Size &amp; look</h5>' +
      '<div class="lgRow"><label for="lgScale">Overall size</label><input type="range" id="lgScale" min="50" max="220" step="5"><span class="lgVal" id="lgScaleVal"></span></div>' +
      '<div class="lgRow"><label for="lgChipScale">Chip size</label><input type="range" id="lgChipScale" min="50" max="220" step="5"><span class="lgVal" id="lgChipScaleVal"></span></div>' +
      '<div class="lgRow"><label for="lgFont">Font</label>' + selectHtml("lgFont", FONTS.map(function (f) { return [f.id, f.name]; }), S.font) + "</div>" +
      '<div class="lgRow"><label for="lgShape">Chip shape</label>' + selectHtml("lgShape", SHAPES, S.shape) + "</div>" +
      '<label class="lgCheck"><input type="checkbox" id="lgShowText"> <span>Show the text next to each color</span></label>' +
      '<label class="lgCheck"><input type="checkbox" id="lgPanelBg"> <span>Show a background panel behind the legend</span></label>' +
      '<label class="lgCheck"><input type="checkbox" id="lgAutoFit"> <span>Auto-fit: shrink the legend if it would take too much screen height</span></label>' +
      '<h5>Title</h5>' +
      '<label class="lgCheck"><input type="checkbox" id="lgShowTitle"> <span>Show a title</span></label>' +
      '<div class="lgRow"><label for="lgTitle">Title text</label><input type="text" id="lgTitle" maxlength="80" autocomplete="off"></div>' +
      '<h5>Entries (order, text, colors)</h5>' +
      '<ul class="lgItems" id="lgItems"></ul>' +
      '<div class="lgRow"><button type="button" class="lgBtn" id="lgAdd">+ Add an entry</button>' +
      '<button type="button" class="lgBtn" id="lgReset">Reset legend to default</button></div>';
  }

  function syncControls() {
    if (!panelRoot) return;
    function q(id) { return panelRoot.querySelector("#" + id); }
    q("lgVisible").checked = S.visible;
    q("lgPosition").value = S.position;
    q("lgAlign").value = S.align;
    q("lgColumns").value = String(S.columns);
    q("lgRows").value = String(S.rows);
    q("lgScale").value = S.scale; q("lgScaleVal").textContent = S.scale + "%";
    q("lgChipScale").value = S.chipScale; q("lgChipScaleVal").textContent = S.chipScale + "%";
    q("lgFlow").value = S.flow;
    q("lgOverflow").value = S.overflow;
    q("lgItemLayout").value = S.itemLayout;
    q("lgCellFit").value = S.cellFit;
    q("lgCellAlign").value = S.cellAlign;
    q("lgRowGap").value = S.rowGap; q("lgRowGapVal").textContent = S.rowGap + "px";
    q("lgColGap").value = S.colGap; q("lgColGapVal").textContent = S.colGap + "px";
    q("lgMaxWidth").value = S.maxWidth; q("lgMaxWidthVal").textContent = S.maxWidth + "px";
    markPresets();
    q("lgFont").value = S.font;
    q("lgShape").value = S.shape;
    q("lgShowText").checked = S.showText;
    q("lgPanelBg").checked = S.panel;
    q("lgAutoFit").checked = S.autoFit;
    q("lgShowTitle").checked = S.showTitle;
    q("lgTitle").value = S.title;
    updateLayoutInfo(layoutInfo(S.items.filter(function (it) { return it.enabled; }).length));
  }

  function markPresets() {
    if (!panelRoot) return;
    var btns = panelRoot.querySelectorAll(".lgPreset");
    for (var i = 0; i < btns.length; i++) {
      var pr = PRESETS[Number(btns[i].getAttribute("data-i"))];
      btns[i].classList.toggle("on", !!pr && pr[1] === S.columns && pr[2] === S.rows);
    }
  }

  function resolveHex(expr) {
    var probe = document.createElement("span");
    probe.style.cssText = "position:absolute;left:-9999px;width:1px;height:1px;background:" + expr;
    document.body.appendChild(probe);
    var hex = rgbStringToHex(getComputedStyle(probe).backgroundColor);
    document.body.removeChild(probe);
    return hex;
  }

  function buildItemsList() {
    if (!panelRoot) return;
    var ul = panelRoot.querySelector("#lgItems");
    if (!ul) return;
    var dm = defMap();
    ul.innerHTML = "";
    S.items.forEach(function (it, idx) {
      var d = dm[it.id];
      var li = document.createElement("li");
      li.className = "lgEdit" + (it.enabled ? "" : " off");
      var colorValue = it.color || (d ? resolveHex(d.c.bg) : "#888888");
      li.innerHTML =
        '<button type="button" class="lgMini lgUp" title="Move up"' + (idx === 0 ? " disabled" : "") + ">↑</button>" +
        '<button type="button" class="lgMini lgDn" title="Move down"' + (idx === S.items.length - 1 ? " disabled" : "") + ">↓</button>" +
        '<input type="checkbox" class="lgOn" title="Show this entry"' + (it.enabled ? " checked" : "") + ">" +
        '<input type="text" class="lgGlyph" maxlength="6" title="Text inside the colored chip" placeholder="chip" value="' + esc(it.glyph) + '">' +
        '<input type="text" class="lgLabel" maxlength="80" title="Text next to the chip" placeholder="Meaning" value="' + esc(it.label) + '">' +
        '<input type="color" class="lgColor" title="Chip color" value="' + colorValue + '">' +
        (d
          ? '<button type="button" class="lgMini lgRst" title="Back to the game\'s own color"' + (it.color ? "" : " disabled") + ">↺</button>"
          : '<button type="button" class="lgMini lgDel" title="Delete this entry">✕</button>');
      ul.appendChild(li);

      // Always edit the CURRENT entry (looked up by id), never a captured object: if the settings object is
      // replaced meanwhile (another screen changed the legend) an edit must still land and show.
      function live() {
        for (var k = 0; k < S.items.length; k++) if (S.items[k].id === it.id) return S.items[k];
        return null;
      }
      function reorder(delta) {
        var at = -1;
        for (var k = 0; k < S.items.length; k++) if (S.items[k].id === it.id) { at = k; break; }
        var j = at + delta;
        if (at < 0 || j < 0 || j >= S.items.length) return;
        var t = S.items[at]; S.items[at] = S.items[j]; S.items[j] = t;
        commit(true);
      }
      li.querySelector(".lgUp").addEventListener("click", function () { reorder(-1); });
      li.querySelector(".lgDn").addEventListener("click", function () { reorder(1); });
      li.querySelector(".lgOn").addEventListener("change", function (e) { var c = live(); if (!c) return; c.enabled = e.target.checked; li.classList.toggle("off", !c.enabled); commit(false); });
      li.querySelector(".lgGlyph").addEventListener("input", function (e) { var c = live(); if (!c) return; c.glyph = e.target.value; commit(false); });
      li.querySelector(".lgLabel").addEventListener("input", function (e) { var c = live(); if (!c) return; c.label = e.target.value; commit(false); });
      li.querySelector(".lgColor").addEventListener("input", function (e) { var c = live(); if (!c) return; c.color = e.target.value; commit(false); var r = li.querySelector(".lgRst"); if (r) r.disabled = false; });
      var rst = li.querySelector(".lgRst");
      if (rst) rst.addEventListener("click", function () { var c = live(); if (!c) return; delete c.color; commit(true); });
      var del = li.querySelector(".lgDel");
      if (del) del.addEventListener("click", function () {
        for (var k = 0; k < S.items.length; k++) if (S.items[k].id === it.id) { S.items.splice(k, 1); break; }
        commit(true);
      });
    });
    var add = panelRoot.querySelector("#lgAdd");
    if (add) add.disabled = S.items.length >= MAX_ITEMS;
  }

  function wirePanel() {
    function q(id) { return panelRoot.querySelector("#" + id); }
    function on(id, evt, fn) { q(id).addEventListener(evt, fn); }
    on("lgVisible", "change", function (e) { S.visible = e.target.checked; commit(false); });
    on("lgPosition", "change", function (e) { S.position = e.target.value; commit(false); });
    on("lgAlign", "change", function (e) { S.align = e.target.value; commit(false); });
    on("lgColumns", "change", function (e) { S.columns = Number(e.target.value); markPresets(); commit(false); });
    on("lgRows", "change", function (e) { S.rows = Number(e.target.value); markPresets(); commit(false); });
    on("lgFlow", "change", function (e) { S.flow = e.target.value; commit(false); });
    on("lgOverflow", "change", function (e) { S.overflow = e.target.value; commit(false); });
    on("lgItemLayout", "change", function (e) { S.itemLayout = e.target.value; commit(false); });
    on("lgCellFit", "change", function (e) { S.cellFit = e.target.value; commit(false); });
    on("lgCellAlign", "change", function (e) { S.cellAlign = e.target.value; commit(false); });
    on("lgRowGap", "input", function (e) { S.rowGap = Number(e.target.value); q("lgRowGapVal").textContent = S.rowGap + "px"; commit(false); });
    on("lgColGap", "input", function (e) { S.colGap = Number(e.target.value); q("lgColGapVal").textContent = S.colGap + "px"; commit(false); });
    on("lgMaxWidth", "input", function (e) { S.maxWidth = Number(e.target.value); q("lgMaxWidthVal").textContent = S.maxWidth + "px"; commit(false); });
    Array.prototype.forEach.call(panelRoot.querySelectorAll(".lgPreset"), function (b) {
      b.addEventListener("click", function () {
        var pr = PRESETS[Number(b.getAttribute("data-i"))];
        if (!pr) return;
        S.columns = pr[1]; S.rows = pr[2];
        if (S.columns > 0 && S.rows === 0) S.flow = "row";
        q("lgColumns").value = String(S.columns); q("lgRows").value = String(S.rows);
        markPresets();
        commit(false);
      });
    });
    on("lgScale", "input", function (e) { S.scale = Number(e.target.value); q("lgScaleVal").textContent = S.scale + "%"; commit(false); });
    on("lgChipScale", "input", function (e) { S.chipScale = Number(e.target.value); q("lgChipScaleVal").textContent = S.chipScale + "%"; commit(false); });
    on("lgFont", "change", function (e) { S.font = e.target.value; commit(false); });
    on("lgShape", "change", function (e) { S.shape = e.target.value; commit(false); });
    on("lgShowText", "change", function (e) { S.showText = e.target.checked; commit(false); });
    on("lgPanelBg", "change", function (e) { S.panel = e.target.checked; commit(false); });
    on("lgAutoFit", "change", function (e) { S.autoFit = e.target.checked; commit(false); });
    on("lgShowTitle", "change", function (e) { S.showTitle = e.target.checked; commit(false); });
    on("lgTitle", "input", function (e) { S.title = e.target.value; commit(false); });
    on("lgAdd", "click", function () {
      if (S.items.length >= MAX_ITEMS) return;
      var id = "x" + Math.random().toString(36).slice(2, 8);
      S.items.push({ id: id, enabled: true, label: "New meaning", glyph: "A", color: "#7B3FE4" });
      commit(true);
    });
    on("lgReset", "click", function () { resetAll(); });
  }

  function mountPanel() {
    // Same mount points the Color shades picker uses; the legend section goes right after it.
    var picker = document.getElementById("shadePicker") || document.querySelector("[data-color-shades]");
    if (!picker) return;
    var host = picker.closest(".drawerSection") || picker.closest(".host-card");
    if (!host || document.getElementById("legendSettings")) return;

    var wrap = document.createElement("div");
    wrap.id = "legendSettings";
    var intro = "Customize the legend that explains each color to your viewers: where it sits (top, above or below the keyboard, above or below the board), exactly how many rows and columns it uses, its size, font, and the order and wording of every entry. Changes apply right away and every screen connected to this game updates together.";
    if (host.classList.contains("host-card")) {
      wrap.className = "host-card";
      wrap.innerHTML = '<div class="host-card-title">🏷️ LEGENDS SETTINGS</div><p class="host-note" style="font-size:12px;opacity:.75;margin:0 0 8px">' + esc(intro) + '</p><div class="lgPanelUI"></div>';
    } else {
      wrap.className = "drawerSection";
      wrap.innerHTML = '<h4>LEGENDS SETTINGS</h4><p class="sectionNote">' + esc(intro) + '</p><div class="lgPanelUI"></div>';
    }
    host.parentNode.insertBefore(wrap, host.nextSibling);
    panelRoot = wrap.querySelector(".lgPanelUI");
    panelRoot.innerHTML = panelHtml();
    wirePanel();
    syncControls();
    buildItemsList();
  }

  /* ------------------------------------------------------------------ boot */
  readCache();
  function ready() {
    buildSection();
    render();
    mountPanel();
    connect();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
  else ready();

  window.GameLegend = {
    get: function () { return JSON.parse(JSON.stringify(S)); },
    refit: fit,
    reset: resetAll
  };
})();
