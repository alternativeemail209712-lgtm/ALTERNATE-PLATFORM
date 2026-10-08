/* ==========================================================================
   COLOR SHADES  (update 16) - shared by EVERY game on the platform.

   Each game lists the colors it really uses (below, in GAMES). For every color the
   host gets a row of TEN shades, from lightest (0) to darkest (9); shade 4 is always
   the game's original "Standard" color. The choice:
     - is applied instantly as CSS variables (no new round needed),
     - is shared by every screen connected to the same game (Socket.IO namespace
       /shades, see server/shared/color-shades-hub.js),
     - is cached in this browser so the page opens in the right colors with no flash.

   Add the script to a page like this (the data-game value picks the color list):
       <script src="/shared/color-shades.js" data-game="textle"></script>
   and drop <div data-color-shades></div> (or id="shadePicker") where the picker belongs.
   Scripts that draw their own colors (e.g. the TRAVLE globe) can read
   ColorShades.get("optimal") and listen for the "colorshades:change" event.
   ========================================================================== */
(function () {
  "use strict";

  var SHADE_COUNT = 10;
  var STANDARD = 4; // index of the original color in every ramp
  var SHADE_NAMES = ["Lightest", "Very light", "Light", "Soft", "Standard", "Medium", "Strong", "Bold", "Deep", "Darkest"];

  /* ------------------------------------------------------------------------
     Color lists per game.
       id        stable key (also what the server stores)
       label     what the host sees      hint  where it shows up
       std       the original color (becomes shade 4 exactly)
       vars      CSS variables set to the chosen shade
       darkVars  CSS variables set to a darker companion (borders, inset edges, "-dim")
       stdDark   the original companion color, so shade 4 reproduces the old look exactly
       inkVars   CSS variables set to readable text color (dark or white) for that shade
       glowVars  CSS variables set to a translucent glow of the shade
     ------------------------------------------------------------------------ */
  function wordColors(greenHint, yellowHint, thirdId, thirdLabel, thirdStd, thirdHint) {
    return [
      { id: "green", label: "Green", hint: greenHint, std: "#0E9F45", stdDark: "#087A32",
        vars: ["--strong-green"], darkVars: ["--strong-green-dark"], inkVars: ["--strong-green-ink"], glowVars: ["--green-glow"] },
      { id: "yellow", label: "Yellow", hint: yellowHint, std: "#FFC400", stdDark: "#D9A100",
        vars: ["--strong-yellow"], darkVars: ["--strong-yellow-dark"], inkVars: ["--strong-yellow-ink"], glowVars: ["--yellow-glow"] },
      thirdId === "grey"
        ? { id: "grey", label: thirdLabel, hint: thirdHint, std: thirdStd, vars: ["--strong-grey"], inkVars: ["--strong-grey-ink"] }
        : { id: "red", label: thirdLabel, hint: thirdHint, std: thirdStd, stdDark: "#B3101F",
            vars: ["--strong-red"], darkVars: ["--strong-red-dark"], inkVars: ["--strong-red-ink"] }
    ];
  }

  function colorLetterColors() {
    return [
      { id: "red", label: "Red", hint: "keyboard keys & empty boxes", std: "#E11D2E", vars: ["--cb-red"], inkVars: ["--cb-red-ink"] },
      { id: "blue", label: "Blue", hint: "keyboard keys & empty boxes", std: "#1E73E8", vars: ["--cb-blue"], inkVars: ["--cb-blue-ink"] },
      { id: "yellow", label: "Yellow", hint: "keyboard keys & empty boxes", std: "#FFC400", vars: ["--cb-yellow"], inkVars: ["--cb-yellow-ink"] },
      { id: "purple", label: "Purple", hint: "keyboard keys & empty boxes", std: "#7B3FE4", vars: ["--cb-purple"], inkVars: ["--cb-purple-ink"] },
      { id: "green", label: "Green", hint: "right letter in the right place", std: "#0E9F45", vars: ["--cb-hit"], inkVars: ["--cb-hit-ink"] },
      { id: "gray", label: "Gray", hint: "letter not in that place", std: "#8B8F9E", vars: ["--cb-miss"], inkVars: ["--cb-miss-ink"] }
    ];
  }

  var GAMES = {
    flagle: [
      { id: "mint", label: "Green", hint: "correct guess, win, success", std: "#4B8C3C", stdDark: "#326426", vars: ["--mint"], darkVars: ["--mint-dim"] },
      { id: "coral", label: "Orange-red", hint: "wrong guess, alerts, skip", std: "#D9663D", stdDark: "#A5451F", vars: ["--coral"], darkVars: ["--coral-dim"] },
      { id: "amber", label: "Gold", hint: "main accent & timer bar", std: "#C99117", stdDark: "#93690D", vars: ["--amber"], darkVars: ["--amber-dim"] },
      { id: "blue", label: "Blue", hint: "live, chat & connect", std: "#3A8FB7", stdDark: "#206485", vars: ["--blue"], darkVars: ["--blue-dim"] },
      { id: "violet", label: "Purple", hint: "hints", std: "#7F52B8", stdDark: "#5C3689", vars: ["--violet"], darkVars: ["--violet-dim"] },
      { id: "pink", label: "Pink", hint: "gifts & timer accents", std: "#C9527C", stdDark: "#9C2F55", vars: ["--pink"], darkVars: ["--pink-dim"] }
    ],
    travle: [
      { id: "endpoint", label: "Start & target", hint: "the two end countries", std: "#A855F7", stdDark: "#6B21A8", vars: ["--cs-endpoint"], darkVars: ["--cs-endpoint-dim"], inkVars: ["--cs-endpoint-ink"] },
      { id: "optimal", label: "Shortest path", hint: "countries on the best route", std: "#22C55E", stdDark: "#15803D", vars: ["--green-opt"], darkVars: ["--green-opt-dim"] },
      { id: "good", label: "Accepted guess", hint: "valid, but a longer route", std: "#FFD43B", stdDark: "#A88617", vars: ["--yellow-good"], darkVars: ["--yellow-good-dim"] },
      { id: "wrong", label: "Wrong guess", hint: "off the path, not connected", std: "#EF4444", vars: ["--red-wrong"] },
      { id: "neutral", label: "Land (not guessed)", hint: "countries nobody guessed yet", std: "#8FC1E8", vars: ["--land-light"] }
    ],
    blindle: wordColors("tiles & keys: right letter, right spot", "tiles & keys: right letter, wrong spot", "red", "Red", "#E11D2E", "tiles & keys: letter not in the word"),
    twistle: wordColors("tiles & keys", "tiles & keys", "red", "Red", "#E11D2E", "tiles & keys"),
    oracle: wordColors("green count badges", "gold count badges", "red", "Red", "#E11D2E", "red count badges"),
    crossdle: wordColors("tiles, keys & chips: right spot", "tiles, keys & chips: wrong spot", "grey", "Gray", "#4A4F66", "tiles, keys & chips: not in the word"),
    colorblindle: colorLetterColors(),
    colordle: colorLetterColors(),
    structle: [
      { id: "zero", label: "Green", hint: "a clue of 0 and the solved row", std: "#0E9F45", vars: ["--st-zero"], inkVars: ["--st-zero-ink"] }
    ],
    textle: [
      { id: "green", label: "Green", hint: "right letters in the right place (segments & keys)", std: "#0E9F45", stdDark: "#087A32", vars: ["--tx-green"], darkVars: ["--tx-green-dark"], inkVars: ["--tx-green-ink"] },
      { id: "yellow", label: "Yellow", hint: "right letters, wrong place (segments & keys)", std: "#FFC400", stdDark: "#D9A100", vars: ["--tx-yellow"], darkVars: ["--tx-yellow-dark"], inkVars: ["--tx-yellow-ink"] },
      { id: "gray", label: "Gray", hint: "letters not in the word (segments & keys)", std: "#7B8092", stdDark: "#5A5F70", vars: ["--tx-gray"], darkVars: ["--tx-gray-dark"], inkVars: ["--tx-gray-ink"] }
    ],
    rangedle: [
      { id: "hit", label: "Green", hint: "correct letter (tiles, legend & keyboard keys)", std: "#0E9F45", stdDark: "#087A32", vars: ["--rg-hit"], darkVars: ["--rg-hit-dark"], inkVars: ["--rg-hit-ink"] },
      { id: "d1", label: "Red", hint: "1-5 letters away", std: "#E11D2E", stdDark: "#B3101F", vars: ["--rg-d1"], darkVars: ["--rg-d1-dark"], inkVars: ["--rg-d1-ink"] },
      { id: "d2", label: "Orange", hint: "6-10 letters away", std: "#F57C00", stdDark: "#BF5F00", vars: ["--rg-d2"], darkVars: ["--rg-d2-dark"], inkVars: ["--rg-d2-ink"] },
      { id: "d3", label: "Yellow", hint: "11-15 letters away", std: "#E5B400", stdDark: "#B38C00", vars: ["--rg-d3"], darkVars: ["--rg-d3-dark"], inkVars: ["--rg-d3-ink"] },
      { id: "d4", label: "Blue", hint: "16-20 letters away", std: "#1E73E8", stdDark: "#1456B0", vars: ["--rg-d4"], darkVars: ["--rg-d4-dark"], inkVars: ["--rg-d4-ink"] },
      { id: "d5", label: "Purple", hint: "21-25 letters away", std: "#7B3FE4", stdDark: "#5A25B8", vars: ["--rg-d5"], darkVars: ["--rg-d5-dark"], inkVars: ["--rg-d5-ink"] }
    ],
    shapedle: [
      { id: "green", label: "Green", hint: "right letter, right spot (tiles, legend & keys)", std: "#0E9F45", stdDark: "#087A32", vars: ["--sp-green"], darkVars: ["--sp-green-dark"], inkVars: ["--sp-green-ink"] },
      { id: "yellow", label: "Yellow", hint: "in the word, wrong spot (tiles, legend & keys)", std: "#E5B400", stdDark: "#B38C00", vars: ["--sp-yellow"], darkVars: ["--sp-yellow-dark"], inkVars: ["--sp-yellow-ink"] },
      { id: "gray", label: "Gray", hint: "not in the word (tiles, legend & keys)", std: "#7B8092", stdDark: "#5A5F70", vars: ["--sp-gray"], darkVars: ["--sp-gray-dark"], inkVars: ["--sp-gray-ink"] }
    ],
    codedle: [
      { id: "hit", label: "Green", hint: "right letter, right spot (tiles, legend & keys)", std: "#0E9F45", stdDark: "#087A32", vars: ["--cd-hit"], darkVars: ["--cd-hit-dark"], inkVars: ["--cd-hit-ink"] },
      { id: "yellow", label: "Yellow", hint: "in the word, wrong spot (tiles, legend & keys)", std: "#E5B400", stdDark: "#B38C00", vars: ["--cd-yellow"], darkVars: ["--cd-yellow-dark"], inkVars: ["--cd-yellow-ink"] },
      { id: "blue", label: "Blue", hint: "within 3 letters of the hidden letter (tiles, legend & keys)", std: "#5FB4FF", stdDark: "#2F86D6", vars: ["--cd-blue"], darkVars: ["--cd-blue-dark"], inkVars: ["--cd-blue-ink"] },
      { id: "pink", label: "Pink", hint: "in the word and within 3 letters (tiles, legend & keys)", std: "#FF8FC8", stdDark: "#D9569B", vars: ["--cd-pink"], darkVars: ["--cd-pink-dark"], inkVars: ["--cd-pink-ink"] },
      { id: "gray", label: "Gray", hint: "not in the word (tiles, legend & keys)", std: "#7B8092", stdDark: "#5A5F70", vars: ["--cd-gray"], darkVars: ["--cd-gray-dark"], inkVars: ["--cd-gray-ink"] }
    ],
    findle: [
      { id: "leaf", label: "Green", hint: "found / correct", std: "#7DC468", stdDark: "#1F6B2E", vars: ["--findle-leaf"], darkVars: ["--findle-leaf-text"], inkVars: ["--findle-leaf-dark"] },
      { id: "citrus", label: "Orange", hint: "title, score & emphasis", std: "#FFB84D", stdDark: "#8A5A17", vars: ["--findle-citrus"], darkVars: ["--findle-citrus-text"], inkVars: ["--findle-citrus-dark"] },
      { id: "berry", label: "Red", hint: "host tag, errors & alerts", std: "#FF7A7A", stdDark: "#8C2E2E", vars: ["--findle-berry"], darkVars: ["--findle-berry-text"] },
      { id: "sky", label: "Blue", hint: "info accents", std: "#6FC7D9", stdDark: "#1F6E7A", vars: ["--findle-sky"], darkVars: ["--findle-sky-text"] }
    ]
  };

  /* ------------------------------ color math ------------------------------ */
  function hexToRgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgbToHex(r, g, b) {
    function h(v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? "0" : "") + v.toString(16); }
    return "#" + h(r) + h(g) + h(b);
  }
  function hexToHsl(hex) {
    var c = hexToRgb(hex), r = c[0] / 255, g = c[1] / 255, b = c[2] / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, h = 0, s = 0, d = max - min;
    if (d) {
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return [h, s, l];
  }
  function hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
    var c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2, r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
  }
  function inkFor(hex) {
    var c = hexToRgb(hex);
    function lin(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
    var lum = 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
    return lum > 0.4 ? "#1f2230" : "#ffffff";
  }

  // Ten shades of one color: 0-3 lighter, 4 = the original, 5-9 darker. Same hue throughout.
  var rampCache = {};
  function ramp(std) {
    if (rampCache[std]) return rampCache[std];
    var hsl = hexToHsl(std), h = hsl[0], s = hsl[1], l = hsl[2], out = [], i, j, t;
    var lightEnd = Math.max(0.9, l);
    var darkEnd = Math.max(0.07, l * 0.28);
    for (i = 0; i < STANDARD; i++) { // lightest first
      t = (STANDARD - i) / STANDARD;
      out.push(hslToHex(h, s * (0.78 + 0.22 * (1 - t)), l + (lightEnd - l) * t));
    }
    out.push(std.toUpperCase());
    for (j = 1; j <= SHADE_COUNT - 1 - STANDARD; j++) {
      t = j / (SHADE_COUNT - 1 - STANDARD);
      out.push(hslToHex(h, s * (1 - 0.12 * t), l - (l - darkEnd) * t));
    }
    rampCache[std] = out;
    return out;
  }

  // A darker companion of a shade (borders, inset edges, "-dim" variants). When the color has a
  // known original companion, the same lightness ratio is kept so shade 4 matches the old look.
  function darkerOf(hex, color) {
    var a = hexToHsl(hex), ratio = 0.72;
    if (color.stdDark && hex.toUpperCase() === color.std.toUpperCase()) return color.stdDark.toUpperCase(); // Standard = exactly the original look
    if (color.stdDark) {
      var base = hexToHsl(color.std), dk = hexToHsl(color.stdDark);
      ratio = base[2] > 0 ? dk[2] / base[2] : 0.72;
      return hslToHex(a[0], Math.min(1, a[1] * (base[1] ? dk[1] / base[1] : 1)), a[2] * ratio);
    }
    return hslToHex(a[0], a[1], a[2] * ratio);
  }
  function glowOf(hex) {
    var c = hexToRgb(hex);
    return "rgba(" + c[0] + "," + c[1] + "," + c[2] + ",.55)";
  }

  /* ------------------------------- state ---------------------------------- */
  var script = document.currentScript;
  var game = (script && script.getAttribute("data-game")) || (document.body && document.body.getAttribute("data-game")) || "";
  var colors = GAMES[game] || [];
  var current = {};          // colorId -> shade index
  var socket = null;
  var storageKey = "colorShades:" + game;

  function shadeIndexOf(id) {
    var v = current[id];
    return typeof v === "number" && v >= 0 && v < SHADE_COUNT ? v : STANDARD;
  }
  function hexOf(color) {
    return ramp(color.std)[shadeIndexOf(color.id)];
  }

  function applyAll() {
    var root = document.documentElement;
    colors.forEach(function (color) {
      var hex = hexOf(color);
      (color.vars || []).forEach(function (v) { root.style.setProperty(v, hex); });
      (color.darkVars || []).forEach(function (v) { root.style.setProperty(v, darkerOf(hex, color)); });
      (color.inkVars || []).forEach(function (v) { root.style.setProperty(v, inkFor(hex)); });
      (color.glowVars || []).forEach(function (v) { root.style.setProperty(v, glowOf(hex)); });
    });
    try { document.dispatchEvent(new CustomEvent("colorshades:change", { detail: { game: game } })); } catch (e) {}
    renderAll();
  }

  function cache() {
    try { localStorage.setItem(storageKey, JSON.stringify(current)); } catch (e) {}
  }
  function readCache() {
    try {
      var raw = JSON.parse(localStorage.getItem(storageKey) || "{}");
      Object.keys(raw).forEach(function (k) {
        var n = Math.round(Number(raw[k]));
        if (n >= 0 && n < SHADE_COUNT) current[k] = n;
      });
    } catch (e) {}
  }

  function setShade(id, shade) {
    current[id] = shade;
    cache();
    applyAll();
    if (socket && socket.connected) socket.emit("shades:set", { game: game, color: id, shade: shade });
  }
  function resetAll() {
    current = {};
    cache();
    applyAll();
    if (socket && socket.connected) socket.emit("shades:reset", { game: game });
  }

  /* ------------------------------ picker UI ------------------------------- */
  var mounts = [];

  function renderAll() {
    mounts.forEach(renderPicker);
  }

  function renderPicker(box) {
    box.innerHTML = "";
    var legend = document.createElement("div");
    legend.className = "shadeLegend";
    legend.innerHTML = "<span>Lightest</span><span>Standard</span><span>Darkest</span>";
    box.appendChild(legend);

    colors.forEach(function (color) {
      var steps = ramp(color.std), sel = shadeIndexOf(color.id);
      var row = document.createElement("div");
      row.className = "shadeRow";

      var head = document.createElement("div");
      head.className = "shadeHead";
      var name = document.createElement("span");
      name.className = "shadeName";
      name.textContent = color.label;
      var cur = document.createElement("span");
      cur.className = "shadeCurrent";
      cur.textContent = SHADE_NAMES[sel] + " · " + (sel + 1) + "/" + SHADE_COUNT;
      head.appendChild(name);
      head.appendChild(cur);
      row.appendChild(head);

      if (color.hint) {
        var hint = document.createElement("div");
        hint.className = "shadeHint";
        hint.textContent = color.hint;
        row.appendChild(hint);
      }

      var opts = document.createElement("div");
      opts.className = "shadeOptions";
      steps.forEach(function (hex, i) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "shadeBtn" + (i === sel ? " selected" : "") + (i === STANDARD ? " isStandard" : "");
        b.style.background = hex;
        b.style.setProperty("--shade-ink", inkFor(hex));
        b.title = color.label + " — " + SHADE_NAMES[i] + " (" + (i + 1) + "/" + SHADE_COUNT + ")";
        b.setAttribute("aria-label", color.label + " " + SHADE_NAMES[i]);
        b.setAttribute("aria-pressed", i === sel ? "true" : "false");
        b.addEventListener("click", function () { setShade(color.id, i); });
        opts.appendChild(b);
      });
      row.appendChild(opts);
      box.appendChild(row);
    });

    var reset = document.createElement("button");
    reset.type = "button";
    reset.className = "btn btnGhost btnFull shadeResetBtn";
    reset.textContent = "Reset all to standard";
    reset.addEventListener("click", resetAll);
    box.appendChild(reset);
  }

  function mountPickers() {
    var found = document.querySelectorAll("[data-color-shades], #shadePicker");
    for (var i = 0; i < found.length; i++) {
      if (mounts.indexOf(found[i]) === -1) mounts.push(found[i]);
    }
    renderAll();
  }

  /* ------------------------------ live sync ------------------------------- */
  function connect() {
    if (!game || !colors.length || socket) return;
    function go() {
      if (typeof io === "undefined") return;
      socket = io("/shades");
      socket.on("connect", function () { socket.emit("shades:join", { game: game }); });
      socket.on("shades:state", function (msg) {
        if (!msg || msg.game !== game) return;
        current = {};
        var s = msg.shades || {};
        Object.keys(s).forEach(function (k) {
          var n = Math.round(Number(s[k]));
          if (n >= 0 && n < SHADE_COUNT) current[k] = n;
        });
        cache();
        applyAll();
      });
    }
    if (typeof io !== "undefined") { go(); return; }
    // The page did not load Socket.IO itself (Blindle uses its own WebSocket) - load it here.
    var tag = document.createElement("script");
    tag.src = "/socket.io/socket.io.js";
    tag.onload = go;
    document.head.appendChild(tag);
  }

  /* -------------------------------- boot ---------------------------------- */
  readCache();
  applyAll(); // before the page paints: no flash of the wrong colors

  function ready() {
    mountPickers();
    connect();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", ready);
  else ready();

  window.ColorShades = {
    game: game,
    count: SHADE_COUNT,
    standard: STANDARD,
    // The color currently chosen for one of this game's colors, e.g. ColorShades.get("optimal").
    get: function (id) {
      for (var i = 0; i < colors.length; i++) if (colors[i].id === id) return hexOf(colors[i]);
      return null;
    },
    ramp: ramp
  };
})();
