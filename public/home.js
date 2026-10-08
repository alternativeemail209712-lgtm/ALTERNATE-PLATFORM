/* ==========================================================================
   HOME PAGE SCRIPT  (update 30)

   PART 1  Live-host banner
     While a TikTok host is connected to ANY game, the top-left banner reads "<HOST NAME> LIVE GAMES" with the
     host's exact round TikTok profile picture on its left, inside the banner. When nobody is connected it is
     the original "TIKTOK LIVE GAMES". Data comes from the server (server/shared/host-presence.js): instantly
     over Socket.IO (/home-hub) and by polling /api/live-host as a safety net.

   PART 2  Customizable game cards
     The 🎛️ button opens a panel where every game card can be restyled (colors, border, corner radius, 3D edge,
     title font, icon / title / description / button text, hide, reorder). Saved on the server (shared by the
     host's phone, tablet and desktop) and in this browser (so nothing is lost if the server disk is wiped).
   ========================================================================== */
(function () {
  "use strict";

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function h(tag, attrs, kids) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === false || v === null || v === undefined) return;
        if (k === "class") el.className = v;
        else if (k === "text") el.textContent = v;
        else if (k.slice(0, 2) === "on" && typeof v === "function") el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? "" : v);
      });
    }
    (kids || []).forEach(function (kid) {
      if (kid === null || kid === undefined || kid === false) return;
      el.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
    });
    return el;
  }

  /* ========================================================================
     SHARED: Socket.IO connection to /home-hub (optional - everything also works by polling)
     ======================================================================== */
  var socket = null;
  try {
    if (typeof window.io === "function") socket = window.io("/home-hub");
  } catch (e) { socket = null; }
  var lastSocketAt = 0;

  /* ========================================================================
     PART 1 - LIVE HOST BANNER
     ======================================================================== */
  (function liveHostBanner() {
    var badge = $("#hubBadge");
    if (!badge) return;
    var avatarBox = $("#hbAvatar"), img = $("#hbImg"), initial = $("#hbInitial");
    var emoji = $("#hbEmoji"), nameEl = $("#hbName"), label = $("#hbLabel");

    var hosts = [];
    var index = 0;
    var rotateTimer = null;
    var shownKey = "";   // what is on screen now ("" = the plain banner)
    var swapTimer = null;

    function cleanName(host) {
      var n = String(host.displayName || host.nickname || host.username || "").replace(/^@/, "").trim();
      return n || String(host.username || "");
    }
    function safePicture(url) {
      // only the server's own copy of the picture is ever used (same-origin, never hot-linked)
      return typeof url === "string" && url.indexOf("/host-avatar/") === 0 ? url : "";
    }
    function firstLetter(name) {
      var chars = Array.from(name.replace(/[^\p{L}\p{N}]/gu, "") || name);
      return (chars[0] || "?").toUpperCase();
    }

    function paint(host) {
      if (!host) {
        badge.classList.remove("has-host");
        avatarBox.hidden = true;
        nameEl.hidden = true;
        nameEl.textContent = "";
        emoji.hidden = false;
        label.textContent = "TIKTOK LIVE GAMES";
        document.title = "Live Game Platform";
        return;
      }
      var name = cleanName(host);
      var pic = safePicture(host.avatarUrl);
      badge.classList.add("has-host");
      emoji.hidden = true;
      nameEl.hidden = false;
      nameEl.textContent = name;
      nameEl.title = name;
      label.textContent = "LIVE GAMES";
      avatarBox.hidden = false;
      initial.textContent = firstLetter(name);
      initial.hidden = false;
      img.hidden = true;
      if (pic) {
        img.onload = function () { img.hidden = false; initial.hidden = true; };
        img.onerror = function () { img.hidden = true; initial.hidden = false; };
        if (img.getAttribute("src") !== pic) img.src = pic;
        else if (img.complete && img.naturalWidth > 0) { img.hidden = false; initial.hidden = true; }
      } else {
        img.removeAttribute("src");
      }
      document.title = name + " Live Games";
    }

    function render() {
      var host = hosts.length ? hosts[index % hosts.length] : null;
      var key = host ? host.username + "|" + cleanName(host) + "|" + safePicture(host.avatarUrl) : "";
      if (key === shownKey) return;
      var prevUser = shownKey ? shownKey.split("|")[0] : "";
      var nextUser = host ? host.username : "";
      shownKey = key;
      if (swapTimer) { clearTimeout(swapTimer); swapTimer = null; badge.classList.remove("is-swapping"); }
      if (prevUser !== nextUser && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        // a different host (or host <-> no host): quick fade so the change is noticeable
        badge.classList.add("is-swapping");
        swapTimer = setTimeout(function () {
          paint(host);
          badge.classList.remove("is-swapping");
          swapTimer = null;
        }, 180);
      } else {
        paint(host); // same host, new name/picture: update in place
      }
    }

    function setRotation() {
      if (rotateTimer) { clearInterval(rotateTimer); rotateTimer = null; }
      if (hosts.length > 1) {
        // several different TikTok accounts are connected at once: take turns showing them
        rotateTimer = setInterval(function () { index = (index + 1) % hosts.length; render(); }, 7000);
      }
    }

    var EMPTY_GRACE_MS = 6000;  // a game that auto-reconnects leaves the server host-less for a moment: don't flicker
    var emptyTimer = null;
    function apply(state) {
      var list = state && Array.isArray(state.hosts) ? state.hosts : [];
      if (!list.length && hosts.length) {
        if (!emptyTimer) emptyTimer = setTimeout(function () { emptyTimer = null; applyNow([]); }, EMPTY_GRACE_MS);
        return;
      }
      if (emptyTimer) { clearTimeout(emptyTimer); emptyTimer = null; }
      applyNow(list);
    }
    function applyNow(list) {
      var currentUser = hosts.length ? hosts[index % hosts.length].username : "";
      var prevCount = hosts.length;
      hosts = list.filter(function (x) { return x && typeof x.username === "string" && x.username; });
      var keep = -1;
      hosts.forEach(function (x, i) { if (x.username === currentUser) keep = i; });
      index = keep >= 0 ? keep : 0;
      if (hosts.length !== prevCount) setRotation();
      render();
    }

    if (socket) {
      socket.on("hosts:state", function (state) { lastSocketAt = Date.now(); apply(state); });
    }

    function poll() {
      if (document.hidden) return;
      var started = Date.now();
      fetch("/api/live-host", { cache: "no-store" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (state) {
          if (state && lastSocketAt < started) apply(state); // never let an older answer undo a newer push
        })
        .catch(function () { /* offline: keep what is shown */ });
    }
    poll();
    setInterval(poll, 12000);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) poll(); });
  })();

  /* ========================================================================
     PART 2 - CUSTOMIZABLE GAME CARDS
     ======================================================================== */
  (function cardCustomizer() {
    var cards = $all(".game-card[data-game]");
    var footer = $(".hub-footer");
    var openBtn = $("#cuOpen");
    if (!cards.length || !footer) { if (openBtn) openBtn.hidden = true; return; }

    var LS_KEY = "homeCards.v1";
    var LS_EDIT_KEY = "homeCards.editKey";
    var els = {};
    var defaults = {};
    var ORIGINAL_ORDER = [];
    cards.forEach(function (el) {
      var id = el.getAttribute("data-game");
      els[id] = el;
      ORIGINAL_ORDER.push(id);
      defaults[id] = {
        icon: $(".game-icon", el).textContent.trim(),
        title: $(".game-name", el).textContent.trim(),
        desc: $(".game-desc", el).textContent.trim(),
        cta: $(".play-cta", el).textContent.trim()
      };
    });

    // Each game's original accent + darker accent (the values in index.html), used as the starting
    // value shown by the color pickers.
    var ACCENTS = {
      flagle: ["#4FA0C4", "#2C7594"], travle: ["#9C6FD1", "#6C459E"], blindle: ["#E0A934", "#A8790F"],
      findle: ["#6FAA5C", "#4B7D3C"], crossdle: ["#E0724A", "#A84B26"], twistle: ["#E0699C", "#A8446F"],
      oracle: ["#9C6FD1", "#6C459E"], colorblindle: ["#E0724A", "#A84B26"], colordle: ["#2F9E8F", "#1F7A6E"],
      structle: ["#D9822B", "#A85F14"], textle: ["#0E9F45", "#087A32"], rangedle: ["#7B3FE4", "#5A25B8"],
      codedle: ["#E0699C", "#B8457A"], shapedle: ["#F2799F", "#C94A77"]
    };
    var FONT_STACKS = {
      fredoka: '"Fredoka","Baloo 2",cursive',
      baloo: '"Baloo 2","Fredoka",cursive',
      quicksand: '"Quicksand",sans-serif'
    };
    var COLOR_ROWS = [
      ["bg", "Card background"], ["border", "Border"], ["edge", "3D bottom edge"],
      ["blob", "Corner circle"], ["titleColor", "Title text"], ["textColor", "Description text"],
      ["iconColor", "Icon circle"], ["ctaColor", "Play button text"], ["tagColor", "Tags"]
    ];
    // (color keys end in "Color" so they can never be confused with the text keys title / desc / cta / icon)
    var STYLE_KEYS = ["bg", "border", "edge", "blob", "titleColor", "textColor", "iconColor", "ctaColor", "tagColor", "borderStyle", "borderWidth", "radius", "depth", "font"];
    var PRESETS = ["#E0699C", "#E0724A", "#E0A934", "#6FAA5C", "#0E9F45", "#2F9E8F", "#4FA0C4", "#2C7594", "#7B3FE4", "#9C6FD1", "#F2799F", "#6B4423", "#334155", "#111827"];
    var HEX = /^#[0-9a-f]{6}$/i;

    /* ---------- config helpers ---------- */
    function emptyCfg() { return { updatedAt: 0, order: ORIGINAL_ORDER.slice(), cards: {} }; }

    function cleanCard(src) {
      var out = {};
      if (!src || typeof src !== "object") return out;
      COLOR_ROWS.forEach(function (r) { if (typeof src[r[0]] === "string" && HEX.test(src[r[0]])) out[r[0]] = src[r[0]].toLowerCase(); });
      if (["solid", "dashed", "dotted", "double", "none"].indexOf(src.borderStyle) >= 0) out.borderStyle = src.borderStyle;
      [["borderWidth", 0, 8], ["radius", 0, 40], ["depth", 0, 14]].forEach(function (r) {
        var n = Number(src[r[0]]);
        if (isFinite(n)) out[r[0]] = Math.min(r[2], Math.max(r[1], Math.round(n)));
      });
      if (FONT_STACKS[src.font]) out.font = src.font;
      [["title", 40], ["desc", 420], ["cta", 40]].forEach(function (r) {
        if (typeof src[r[0]] === "string" && src[r[0]].trim()) out[r[0]] = src[r[0]].replace(/\s+/g, " ").trim().slice(0, r[1]);
      });
      if (typeof src.icon === "string" && src.icon.trim()) out.icon = Array.from(src.icon.trim()).slice(0, 10).join("");
      if (src.hidden === true) out.hidden = true;
      return out;
    }
    function cleanCfg(src) {
      var cfg = emptyCfg();
      if (!src || typeof src !== "object") return cfg;
      cfg.updatedAt = Number(src.updatedAt) || 0;
      if (src.cards && typeof src.cards === "object") {
        ORIGINAL_ORDER.forEach(function (id) {
          var c = cleanCard(src.cards[id]);
          if (Object.keys(c).length) cfg.cards[id] = c;
        });
      }
      if (Array.isArray(src.order)) {
        var seen = {}, order = [];
        src.order.forEach(function (id) { if (els[id] && !seen[id]) { seen[id] = 1; order.push(id); } });
        ORIGINAL_ORDER.forEach(function (id) { if (!seen[id]) order.push(id); });
        cfg.order = order;
      }
      return cfg;
    }
    function hasCustomizations(cfg) {
      var orderChanged = cfg.order.join() !== ORIGINAL_ORDER.join();
      return orderChanged || Object.keys(cfg.cards).length > 0;
    }

    function readLocal() {
      try {
        var raw = JSON.parse(localStorage.getItem(LS_KEY) || "null");
        if (raw && raw.cfg) return { cfg: cleanCfg(raw.cfg), dirty: raw.dirty === true };
      } catch (e) { /* ignore */ }
      return { cfg: emptyCfg(), dirty: false };
    }
    var cfg, dirty;
    var local = readLocal();
    cfg = local.cfg; dirty = local.dirty;
    function writeLocal() {
      try { localStorage.setItem(LS_KEY, JSON.stringify({ cfg: cfg, dirty: dirty })); } catch (e) { /* private mode: server copy still works */ }
    }

    /* ---------- colors ---------- */
    function hexToRgb(hex) { return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]; }
    function rgbToHex(rgb) { return "#" + rgb.map(function (v) { return ("0" + Math.max(0, Math.min(255, Math.round(v))).toString(16)).slice(-2); }).join(""); }
    function shade(hex, f) { return rgbToHex(hexToRgb(hex).map(function (v) { return v * f; })); }
    function themeCard() {
      var v = getComputedStyle(document.documentElement).getPropertyValue("--theme-card").trim();
      return HEX.test(v) ? v.toLowerCase() : "#fffbf2";
    }
    function defaultColor(id, key) {
      var a = ACCENTS[id] || ["#E0A934", "#A8790F"];
      switch (key) {
        case "bg": return themeCard();
        case "border": case "blob": case "iconColor": case "tagColor": return a[0].toLowerCase();
        case "edge": case "titleColor": case "ctaColor": return a[1].toLowerCase();
        case "textColor": return "#9c8367";
      }
      return "#000000";
    }
    var DEFAULT_STYLE = { borderStyle: "dashed", borderWidth: 3, radius: 22, depth: 7, font: "fredoka" };

    /* ---------- applying a card's design ---------- */
    function applyCard(el, c, id, forPreview) {
      function set(prop, value) {
        if (value === undefined || value === null) el.style.removeProperty(prop);
        else el.style.setProperty(prop, value);
      }
      set("--cu-bg", c.bg); set("--cu-border", c.border); set("--cu-edge", c.edge); set("--cu-blob", c.blob);
      set("--cu-title", c.titleColor); set("--cu-text", c.textColor); set("--cu-icon", c.iconColor); set("--cu-cta", c.ctaColor);
      set("--cu-iconedge", c.iconColor ? shade(c.iconColor, 0.7) : undefined);
      set("--cu-tag", c.tagColor); set("--cu-tagedge", c.tagColor ? shade(c.tagColor, 0.7) : undefined);
      set("--cu-bs", c.borderStyle);
      set("--cu-bw", c.borderWidth !== undefined ? c.borderWidth + "px" : undefined);
      set("--cu-radius", c.radius !== undefined ? c.radius + "px" : undefined);
      set("--cu-depth", c.depth !== undefined ? c.depth + "px" : undefined);
      set("--cu-font", c.font ? FONT_STACKS[c.font] : undefined);
      var d = defaults[id];
      $(".game-icon", el).textContent = c.icon || d.icon;
      $(".game-name", el).textContent = c.title || d.title;
      $(".game-desc", el).textContent = c.desc || d.desc;
      $(".play-cta", el).textContent = c.cta || d.cta;
      if (forPreview) el.classList.toggle("is-preview-hidden", c.hidden === true);
      else el.hidden = c.hidden === true;
    }
    function applyAll() {
      cfg.order.forEach(function (id) { footer.parentNode.insertBefore(els[id], footer); });
      ORIGINAL_ORDER.forEach(function (id) { applyCard(els[id], cfg.cards[id] || {}, id, false); });
    }
    applyAll(); // instant (before the server answers), so there is no flash of the old design

    /* ---------- saving: this browser at once, the server a moment later ---------- */
    var editSeq = 0, saveTimer = null, status = null, saving = false;
    function setStatus(text) { if (status) status.textContent = text; }

    function putToServer(allowPrompt) {
      var seq = editSeq;
      saving = true;
      setStatus("Saving…");
      var headers = { "Content-Type": "application/json" };
      var key = "";
      try { key = localStorage.getItem(LS_EDIT_KEY) || ""; } catch (e) { /* ignore */ }
      if (key) headers["x-edit-key"] = key;
      return fetch("/api/home-cards", { method: "PUT", headers: headers, body: JSON.stringify({ order: cfg.order, cards: cfg.cards }) })
        .then(function (r) {
          if (r.status === 401) {
            if (allowPrompt) {
              var typed = window.prompt("This site asks for the edit password before saving card designs.\nEnter it once for this device:");
              if (typed) {
                try { localStorage.setItem(LS_EDIT_KEY, typed); } catch (e) { /* ignore */ }
                return putToServer(false);
              }
            }
            throw new Error("locked");
          }
          if (!r.ok) throw new Error("http " + r.status);
          return r.json();
        })
        .then(function (saved) {
          if (!saved) return;
          saving = false;
          if (seq === editSeq) { cfg.updatedAt = Number(saved.updatedAt) || cfg.updatedAt; dirty = false; writeLocal(); setStatus("Saved ✓ (on the server and this device)"); }
          else { setStatus("Saving…"); }
        })
        .catch(function (err) {
          saving = false;
          setStatus(err && err.message === "locked"
            ? "Saved on this device only (wrong or missing edit password)."
            : "Saved on this device only - the server could not be reached. It will retry.");
        });
    }
    function scheduleSave() {
      editSeq += 1;
      dirty = true;
      writeLocal();
      setStatus("Saving…");
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(function () { saveTimer = null; putToServer(true); }, 500);
    }

    // On load: reconcile this browser's copy with the server's copy.
    fetch("/api/home-cards", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (server) {
        if (!server) return;
        var srv = cleanCfg(server);
        if (dirty) { putToServer(false); return; }                       // edits this device never managed to upload
        if (srv.updatedAt > 0 && srv.updatedAt >= cfg.updatedAt) { adopt(srv); return; } // the server has the newest design
        if (hasCustomizations(cfg)) putToServer(false);                   // server disk was wiped: restore it from here
      })
      .catch(function () { /* offline: the browser copy is already applied */ });

    function adopt(next) {
      cfg = next; dirty = false; writeLocal();
      applyAll();
      if (panel) { renderChips(); renderPreview(); refreshControls(); }
    }
    if (socket) {
      socket.on("home:cards", function (saved) {
        var next = cleanCfg(saved);
        if (!dirty && !saving && next.updatedAt > cfg.updatedAt) adopt(next); // another device saved a new design
      });
    }

    /* ---------- editing ---------- */
    var selected = ORIGINAL_ORDER[0];
    function cardCfg(id) { return cfg.cards[id] || {}; }
    function setKey(id, key, value) {
      var c = cfg.cards[id] ? Object.assign({}, cfg.cards[id]) : {};
      if (value === undefined || value === "" || value === false) delete c[key]; else c[key] = value;
      if (Object.keys(c).length) cfg.cards[id] = c; else delete cfg.cards[id];
    }
    function commit() {
      applyCard(els[selected], cardCfg(selected), selected, false);
      if (preview) applyCard(preview, cardCfg(selected), selected, true);
      renderChips();
      refreshControls();
      scheduleSave();
    }
    function commitAll() {
      applyAll();
      renderChips(); renderPreview(); refreshControls();
      scheduleSave();
    }

    /* ---------- panel ---------- */
    var panel = null, overlay = null, preview = null, previewSlot = null, chipsEl = null, lastFocus = null;
    var controls = { colors: {}, ranges: {}, selects: {}, texts: {}, hidden: null };

    function shortName(id) { return defaults[id].title.replace(/\s*live\s*$/i, "").trim(); }

    function renderChips() {
      if (!chipsEl) return;
      chipsEl.textContent = "";
      cfg.order.forEach(function (id) {
        var c = cardCfg(id);
        chipsEl.appendChild(h("button", {
          type: "button",
          class: "cu-chip" + (id === selected ? " is-on" : "") + (c.hidden ? " is-hidden" : ""),
          "data-game": id,
          "aria-pressed": id === selected ? "true" : "false",
          title: c.hidden ? "Hidden on the home page" : "",
          text: (c.icon || defaults[id].icon) + " " + (c.title || defaults[id].title).replace(/\s*live\s*$/i, ""),
          onclick: function () { selected = id; renderChips(); renderPreview(); refreshControls(); }
        }));
      });
      var on = $(".cu-chip.is-on", chipsEl);
      if (on && on.scrollIntoView) { try { on.scrollIntoView({ block: "nearest", inline: "center" }); } catch (e) { /* old browsers */ } }
    }

    function renderPreview() {
      if (!previewSlot) return;
      previewSlot.textContent = "";
      preview = els[selected].cloneNode(true);
      preview.removeAttribute("href");
      preview.removeAttribute("data-game");
      preview.removeAttribute("hidden");
      preview.setAttribute("tabindex", "-1");
      preview.setAttribute("aria-hidden", "true");
      applyCard(preview, cardCfg(selected), selected, true);
      previewSlot.appendChild(preview);
    }

    function colorRow(key, label) {
      var input = h("input", { type: "color", id: "cu-c-" + key, "aria-label": label });
      var reset = h("button", { type: "button", class: "cu-mini", title: "Back to the original color", "aria-label": "Reset " + label, text: "↺" });
      var row = h("div", { class: "cu-row" }, [h("label", { for: "cu-c-" + key, text: label }), input, reset]);
      input.addEventListener("input", function () { setKey(selected, key, input.value.toLowerCase()); commit(); });
      reset.addEventListener("click", function () { setKey(selected, key, undefined); commit(); });
      controls.colors[key] = { input: input, row: row };
      return row;
    }

    function rangeRow(key, label, min, max, unit) {
      var input = h("input", { type: "range", min: String(min), max: String(max), step: "1", id: "cu-r-" + key });
      var out = h("output", { for: "cu-r-" + key });
      var reset = h("button", { type: "button", class: "cu-mini", title: "Back to the original", "aria-label": "Reset " + label, text: "↺" });
      var wrap = h("div", { class: "cu-field" }, [
        h("span", { text: label }),
        h("div", { class: "cu-range" }, [input, out, reset])
      ]);
      input.addEventListener("input", function () { setKey(selected, key, Number(input.value)); commit(); });
      reset.addEventListener("click", function () { setKey(selected, key, undefined); commit(); });
      controls.ranges[key] = { input: input, out: out, unit: unit, reset: reset };
      return wrap;
    }

    function selectRow(key, label, options) {
      var sel = h("select", { id: "cu-s-" + key }, options.map(function (o) { return h("option", { value: o[0], text: o[1] }); }));
      sel.addEventListener("change", function () {
        setKey(selected, key, sel.value === DEFAULT_STYLE[key] ? undefined : sel.value);
        commit();
      });
      controls.selects[key] = sel;
      return h("label", { class: "cu-field" }, [h("span", { text: label }), sel]);
    }

    function textRow(key, label, multiline, maxLen) {
      var input = multiline
        ? h("textarea", { id: "cu-t-" + key, maxlength: String(maxLen) })
        : h("input", { type: "text", id: "cu-t-" + key, maxlength: String(maxLen), autocomplete: "off" });
      input.addEventListener("input", function () {
        var v = input.value.replace(/\s+/g, " ").trim();
        setKey(selected, key, v && v !== defaults[selected][key] ? v : undefined);
        commit();
      });
      controls.texts[key] = input;
      return h("label", { class: "cu-field" }, [h("span", { text: label }), input]);
    }

    function setMainColor(hex) {
      hex = hex.toLowerCase();
      var c = Object.assign({}, cardCfg(selected));
      c.border = hex; c.blob = hex; c.iconColor = hex; c.tagColor = hex;
      c.edge = shade(hex, 0.65); c.titleColor = shade(hex, 0.62); c.ctaColor = shade(hex, 0.62);
      cfg.cards[selected] = c;
      commit();
    }

    function buildPanel() {
      status = h("div", { class: "cu-status", role: "status", text: "Changes save automatically." });
      chipsEl = h("div", { class: "cu-chips", role: "group", "aria-label": "Choose a game card" });
      previewSlot = h("div", { class: "cu-preview" });

      var dots = h("div", { class: "cu-dots" }, PRESETS.map(function (hex) {
        return h("button", { type: "button", class: "cu-dot", style: "background:" + hex, title: hex, "aria-label": "Use " + hex + " as the main color", onclick: function () { setMainColor(hex); } });
      }));
      var mainPicker = h("input", { type: "color", id: "cu-main", value: "#e0699c", "aria-label": "Pick any main color" });
      mainPicker.style.cssText = "width:38px;height:30px;padding:0;border:2px solid #fff;border-radius:9px;cursor:pointer;box-shadow:0 0 0 2px var(--theme-line,#D9BE93)";
      mainPicker.addEventListener("input", function () { setMainColor(mainPicker.value); });
      dots.appendChild(mainPicker);

      var colorGrid = h("div", { class: "cu-grid" }, COLOR_ROWS.map(function (r) { return colorRow(r[0], r[1]); }));

      var hideBox = h("input", { type: "checkbox", id: "cu-hide" });
      hideBox.addEventListener("change", function () { setKey(selected, "hidden", hideBox.checked ? true : undefined); commit(); });
      controls.hidden = hideBox;

      var up = h("button", { type: "button", class: "cu-btn", text: "▲ Move up", onclick: function () { move(-1); } });
      var down = h("button", { type: "button", class: "cu-btn", text: "▼ Move down", onclick: function () { move(1); } });

      var body = h("div", { class: "cu-body" }, [
        h("section", { class: "cu-sec" }, [
          h("h3", { text: "Quick main color" }),
          dots,
          h("p", { class: "cu-hint", text: "One tap recolors the border, icon, title, tags and 3D edge together. Fine-tune each part below." })
        ]),
        h("section", { class: "cu-sec" }, [h("h3", { text: "Colors" }), colorGrid,
          h("p", { class: "cu-hint", text: "A ↺ button appears next to anything you changed - tap it to go back to the original." })]),
        h("section", { class: "cu-sec" }, [h("h3", { text: "Shape & style" }),
          h("div", { class: "cu-stack" }, [
            h("div", { class: "cu-two" }, [
              selectRow("borderStyle", "Border style", [["dashed", "Dashed"], ["solid", "Solid"], ["dotted", "Dotted"], ["double", "Double"], ["none", "No border"]]),
              selectRow("font", "Title font", [["fredoka", "Fredoka (round)"], ["baloo", "Baloo (bold)"], ["quicksand", "Quicksand (soft)"]])
            ]),
            rangeRow("borderWidth", "Border thickness", 0, 8, "px"),
            rangeRow("radius", "Corner roundness", 0, 40, "px"),
            rangeRow("depth", "3D bottom edge height", 0, 14, "px")
          ])]),
        h("section", { class: "cu-sec" }, [h("h3", { text: "Text" }),
          h("div", { class: "cu-stack" }, [
            h("div", { class: "cu-two" }, [textRow("icon", "Icon (emoji)", false, 10), textRow("cta", "Button words", false, 40)]),
            textRow("title", "Title", false, 40),
            textRow("desc", "Description", true, 420)
          ])]),
        h("section", { class: "cu-sec" }, [h("h3", { text: "This card on the home page" }),
          h("div", { class: "cu-stack" }, [
            h("label", { class: "cu-check" }, [hideBox, h("span", { text: "Hide this card" })]),
            h("div", { class: "cu-two" }, [up, down])
          ])])
      ]);

      var foot = h("div", { class: "cu-foot" }, [
        status,
        h("button", { type: "button", class: "cu-btn", text: "Reset this card", onclick: function () {
          delete cfg.cards[selected]; commit();
        } }),
        h("button", { type: "button", class: "cu-btn", text: "Copy look to all cards", onclick: copyLookToAll }),
        h("span", { class: "cu-spacer" }),
        h("button", { type: "button", class: "cu-btn cu-warn", text: "Reset ALL", onclick: resetAll }),
        h("button", { type: "button", class: "cu-btn cu-primary", text: "Done", onclick: closePanel })
      ]);

      var closeBtn = h("button", { type: "button", class: "cu-x", "aria-label": "Close", text: "✕", onclick: closePanel });
      var sheet = h("div", { class: "cu-sheet", role: "dialog", "aria-modal": "true", "aria-label": "Customize game cards" }, [
        h("div", { class: "cu-head" }, [h("h2", { text: "🎛️ Customize game cards" }), closeBtn]),
        h("div", { class: "cu-top" }, [chipsEl, previewSlot]),
        body,
        foot
      ]);
      overlay = h("div", { class: "cu-overlay", hidden: true }, [sheet]);
      overlay.addEventListener("mousedown", function (e) { if (e.target === overlay) closePanel(); });
      document.body.appendChild(overlay);
      panel = sheet;
    }

    function move(dir) {
      var i = cfg.order.indexOf(selected), j = i + dir;
      if (i < 0 || j < 0 || j >= cfg.order.length) return;
      var tmp = cfg.order[i]; cfg.order[i] = cfg.order[j]; cfg.order[j] = tmp;
      commitAll();
    }
    function copyLookToAll() {
      if (!window.confirm("Give every card the look of this one (colors, border, corners, 3D edge, font)? Each card keeps its own icon, words and hidden/visible setting.")) return;
      var src = cardCfg(selected);
      ORIGINAL_ORDER.forEach(function (id) {
        if (id === selected) return;
        var c = Object.assign({}, cfg.cards[id] || {});
        STYLE_KEYS.forEach(function (k) { delete c[k]; if (src[k] !== undefined) c[k] = src[k]; });
        if (Object.keys(c).length) cfg.cards[id] = c; else delete cfg.cards[id];
      });
      commitAll();
    }
    function resetAll() {
      if (!window.confirm("Put every game card back to its original look, words and order?")) return;
      cfg.cards = {};
      cfg.order = ORIGINAL_ORDER.slice();
      commitAll();
    }

    function refreshControls() {
      if (!panel) return;
      var c = cardCfg(selected);
      COLOR_ROWS.forEach(function (r) {
        var k = r[0], ctl = controls.colors[k];
        ctl.input.value = c[k] || defaultColor(selected, k);
        ctl.row.classList.toggle("is-set", c[k] !== undefined);
      });
      $("#cu-main").value = c.border || defaultColor(selected, "border");
      Object.keys(controls.ranges).forEach(function (k) {
        var ctl = controls.ranges[k];
        var v = c[k] !== undefined ? c[k] : DEFAULT_STYLE[k];
        ctl.input.value = String(v);
        ctl.out.textContent = v + ctl.unit;
        ctl.reset.parentNode.parentNode.classList.toggle("is-set", c[k] !== undefined);
        ctl.reset.style.visibility = c[k] !== undefined ? "visible" : "hidden";
      });
      Object.keys(controls.selects).forEach(function (k) { controls.selects[k].value = c[k] || DEFAULT_STYLE[k]; });
      Object.keys(controls.texts).forEach(function (k) {
        var input = controls.texts[k];
        input.value = c[k] || "";
        input.placeholder = defaults[selected][k];
      });
      controls.hidden.checked = c.hidden === true;
    }

    function openPanel() {
      if (!panel) buildPanel();
      lastFocus = document.activeElement;
      overlay.hidden = false;
      document.body.style.overflow = "hidden";
      renderChips(); renderPreview(); refreshControls();
      var x = $(".cu-x", overlay);
      if (x) x.focus();
    }
    function closePanel() {
      if (!overlay) return;
      overlay.hidden = true;
      document.body.style.overflow = "";
      if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) { /* ignore */ } }
    }
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && overlay && !overlay.hidden) closePanel();
    });
    if (openBtn) openBtn.addEventListener("click", openPanel);
  })();
})();
