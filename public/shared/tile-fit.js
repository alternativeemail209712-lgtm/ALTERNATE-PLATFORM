/* ==========================================================================
   TILE FIT  (update 39) - readable tiles in the letter word games.

   1. The NUMBER of guesses never changes the tile size any more. Rows that do not fit scroll inside the
      guess board instead: it AUTO-SCROLLS to the newest guess (newest is on top) and the host can scroll
      by hand any time (auto-scroll then waits until you are back at the top or tap "Latest").
   2. "Auto-resize tiles to fit long words" (Settings, remembered on this device, shared by all games):
        ON  - the word always fits on one line (tiles shrink for very long words, e.g. above 15 letters).
        OFF - tiles keep a fixed, readable size (sized for up to 15 letters); a longer word scrolls sideways.

   Loaded in the <head> of every game that uses it. The games call TileFit.fitLength(n) when they size tiles;
   everything else (scroll box, settings switches, re-draw) is done here.
   ========================================================================== */
(function () {
  "use strict";
  if (window.TileFit) return;
  var K_FIT = "platform.tileAutoFit", K_SCROLL = "platform.tileAutoScroll", FIXED_LEN = 15;

  function read(key, def) {
    try { var v = localStorage.getItem(key); return v === null ? def : v === "1"; } catch (e) { return def; }
  }
  function write(key, on) { try { localStorage.setItem(key, on ? "1" : "0"); } catch (e) {} }

  var autoFit = read(K_FIT, true), autoScroll = read(K_SCROLL, true);
  var listeners = [];

  function rerender() {
    // The games keep their state in page-level variables; ask them to draw again with the new size rule.
    try { if (typeof lastTilesSignature !== "undefined") lastTilesSignature = ""; } catch (e) {}
    try { if (typeof renderTiles === "function" && typeof lastState !== "undefined" && lastState && lastState.game) renderTiles(lastState.game); } catch (e) {}
    try { if (typeof applyLayout === "function") applyLayout(); } catch (e) {} // TWISTLE's own layout engine
    listeners.forEach(function (fn) { try { fn(); } catch (e) {} });
  }

  /* ---------- the scroll box around the guess rows ---------- */
  var wrap = null, btn = null, last = { top: 0, h: 0 }, observer = null;

  function maxHeight() {
    var h = 0;
    try { if (typeof computeAvailableTilesHeight === "function") h = computeAvailableTilesHeight(); } catch (e) {}
    if (!h) { var r = wrap.getBoundingClientRect(); h = window.innerHeight - r.top - 230; }
    return Math.max(150, Math.round(h));
  }
  function placeButton() {
    if (!btn || !wrap) return;
    var show = wrap.scrollTop > 60 && wrap.offsetParent !== null;
    btn.style.display = show ? "block" : "none";
    if (!show) return;
    var r = wrap.getBoundingClientRect();
    btn.style.top = Math.max(6, r.top + 6) + "px";
    btn.style.left = Math.max(6, r.right - 96) + "px";
  }
  function onContentChanged() {
    if (!wrap) return;
    wrap.style.maxHeight = maxHeight() + "px";
    var h = wrap.scrollHeight;
    if (autoScroll && last.top <= 8) wrap.scrollTop = 0; // following the newest guess
    else wrap.scrollTop = Math.max(0, last.top + (h - last.h)); // host is reading older rows: keep their place
    last.top = wrap.scrollTop; last.h = wrap.scrollHeight;
    placeButton();
  }
  function setupScrollBox() {
    wrap = document.getElementById("tilesWrap");
    if (!wrap) return;
    var s = wrap.style;
    s.overflowY = "auto"; s.overflowX = "auto"; s.overscrollBehavior = "contain"; s.scrollbarWidth = "thin";
    s.webkitOverflowScrolling = "touch"; s.paddingRight = "2px";
    btn = document.createElement("button");
    btn.type = "button"; btn.textContent = "⬆ Latest"; btn.setAttribute("aria-label", "Scroll to the newest guess");
    btn.style.cssText = "position:fixed;display:none;z-index:50;padding:6px 10px;border-radius:999px;border:0;font:700 12px system-ui,sans-serif;" +
      "background:#222;color:#fff;opacity:.88;box-shadow:0 2px 8px rgba(0,0,0,.35);cursor:pointer";
    btn.onclick = function () { wrap.scrollTo ? wrap.scrollTo({ top: 0, behavior: "smooth" }) : (wrap.scrollTop = 0); };
    document.body.appendChild(btn);
    wrap.addEventListener("scroll", function () { last.top = wrap.scrollTop; last.h = wrap.scrollHeight; placeButton(); }, { passive: true });
    window.addEventListener("resize", function () { onContentChanged(); });
    window.addEventListener("scroll", placeButton, { passive: true });
    if (typeof MutationObserver !== "undefined") {
      observer = new MutationObserver(onContentChanged);
      observer.observe(wrap, { childList: true });
    }
    onContentChanged();
  }

  /* ---------- the two switches in the game's Settings ---------- */
  function mountSettings() {
    if (document.getElementById("tileFitBox")) return;
    var anchor = document.getElementById("randomLengthNote") || document.getElementById("randomLengthRow") || document.getElementById("fixedLengthRow");
    if (!anchor) { var sel = document.getElementById("wordLengthSelect"); anchor = sel && sel.parentNode; }
    if (!anchor || !anchor.parentNode) return;
    var box = document.createElement("div");
    box.id = "tileFitBox";
    box.style.cssText = "margin:12px 0 4px;padding:10px 12px;border:1px solid rgba(128,128,128,.4);border-radius:12px;font-size:13px;line-height:1.45";
    function row(id, label, help, checked, onChange) {
      var wrapRow = document.createElement("div"); wrapRow.style.marginTop = "8px";
      var lab = document.createElement("label"); lab.style.cssText = "display:flex;gap:10px;align-items:flex-start;cursor:pointer;font-weight:700";
      var cb = document.createElement("input"); cb.type = "checkbox"; cb.id = id; cb.checked = checked; cb.style.cssText = "width:20px;height:20px;flex:0 0 auto;margin-top:1px";
      cb.addEventListener("change", function () { onChange(cb.checked); });
      var t = document.createElement("span"); t.textContent = label;
      lab.appendChild(cb); lab.appendChild(t);
      var p = document.createElement("div"); p.style.cssText = "margin:3px 0 0 30px;font-weight:500;opacity:.8"; p.textContent = help;
      wrapRow.appendChild(lab); wrapRow.appendChild(p);
      return wrapRow;
    }
    var head = document.createElement("div"); head.style.fontWeight = "700"; head.textContent = "🔠 Tile size & scrolling";
    var note = document.createElement("div"); note.style.cssText = "opacity:.8;margin-top:2px";
    note.textContent = "Tiles never shrink because of the number of guesses - extra rows scroll instead.";
    box.appendChild(head); box.appendChild(note);
    box.appendChild(row("tileAutoFitToggle", "Auto-resize tiles to fit long words",
      "ON: a long word always fits on one line (tiles get smaller above about " + FIXED_LEN + " letters). OFF: tiles keep a fixed readable size and a word longer than " + FIXED_LEN + " letters scrolls sideways.",
      autoFit, function (on) { autoFit = on; write(K_FIT, on); rerender(); }));
    box.appendChild(row("tileAutoScrollToggle", "Auto-scroll to the newest guess",
      "The newest guess is on top. Scroll down by hand to read older ones - auto-scroll pauses until you scroll back to the top or tap \"Latest\".",
      autoScroll, function (on) { autoScroll = on; write(K_SCROLL, on); onContentChanged(); }));
    anchor.parentNode.insertBefore(box, anchor.nextSibling);
  }

  window.TileFit = {
    FIXED_LEN: FIXED_LEN,
    autoFit: function () { return autoFit; },
    autoScroll: function () { return autoScroll; },
    /** Word length to use when sizing tiles: the real length, or at most 15 when auto-resize is off. */
    fitLength: function (n) { n = Number(n) || 0; return autoFit ? n : Math.min(n, FIXED_LEN); },
    rerender: rerender,
    onChange: function (fn) { listeners.push(fn); }
  };

  function start() { setupScrollBox(); mountSettings(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
