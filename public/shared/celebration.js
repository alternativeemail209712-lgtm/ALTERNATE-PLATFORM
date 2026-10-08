/* ==========================================================================
   CELEBRATION — shared, purely-decorative floating result windows.
   Used by both Flagle and TRAVLE to show a centered floating card after a
   round ends: who scored (and how much), and — as a second, separate
   floating window right after — the all-time top scorer.

   Deliberately self-contained (injects its own <style> tag) so it works
   the same regardless of whichever per-game stylesheet is loaded, and
   picks up the shared platform theme colors (--theme-*) automatically if
   they're present, so it always matches whatever color the host picked.

   API:
     window.Celebration.showCard({
       emoji,        // big icon at the top, e.g. "🎉"
       title,        // heading text
       rows: [ { primary, secondary, primaryLarge, secondaryLarge } ],
       durationMs,   // how long before it auto-dismisses (also closes on tap)
     })
     -> returns a Promise that resolves once the card has closed, so a
        second call can be chained with .then() to show one card right
        after another instead of stacking them on screen at once.
   ========================================================================== */

(function () {
  if (window.Celebration) return; // don't double-init if included twice

  const STYLE_ID = "celebration-style";
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .cel-overlay{
        position:fixed; inset:0; z-index:9500;
        display:flex; align-items:center; justify-content:center;
        padding:24px;
        background:rgba(30,20,10,0);
        transition:background .25s ease;
        pointer-events:none;
      }
      .cel-overlay.cel-visible{ background:rgba(30,20,10,.38); pointer-events:auto; }
      .cel-card{
        width:100%; max-width:340px; max-height:82vh;
        display:flex; flex-direction:column;
        background:var(--theme-card,#fffbf2);
        border:3px dashed var(--theme-line,#d9be93);
        border-radius:22px;
        padding:22px 20px 18px;
        text-align:center;
        box-shadow:0 16px 36px rgba(0,0,0,.28), inset 0 2px 0 rgba(255,255,255,.6);
        font-family:"Fredoka","Baloo 2","Quicksand",sans-serif;
        color:var(--theme-ink,#5b4636);
        transform:scale(.82) translateY(10px);
        opacity:0;
        transition:transform .28s cubic-bezier(.34,1.56,.64,1), opacity .22s ease;
      }
      .cel-overlay.cel-visible .cel-card{ transform:scale(1) translateY(0); opacity:1; }
      .cel-emoji{ font-size:38px; line-height:1; margin-bottom:4px; flex:none; }
      .cel-title{
        font-weight:600; font-size:18px; letter-spacing:.01em;
        color:var(--theme-deep,#6b4423); margin-bottom:14px; flex:none;
      }
      .cel-rows{
        display:flex; flex-direction:column; gap:10px;
        transform-origin:top center;
        overflow-y:auto; /* last-resort only — rows are pre-scaled to fit before this ever kicks in */
      }
      .cel-row{
        display:flex; align-items:center; justify-content:space-between; gap:12px;
        background:rgba(0,0,0,.035); border-radius:12px; padding:8px 12px;
      }
      .cel-avatar{
        flex:none; display:flex; align-items:center; justify-content:center;
        border-radius:50%; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.3);
      }
      .cel-avatar-img{ width:100%; height:100%; object-fit:cover; display:block; }
      .cel-avatar-fallback{ font-weight:800; color:#fff; text-transform:uppercase; user-select:none; font-size:12px; }
      .cel-primary{ font-weight:600; font-size:15px; text-align:left; word-break:break-word; }
      .cel-secondary{ font-weight:600; font-size:12.5px; opacity:.75; white-space:nowrap; }
      .cel-primary.cel-large{ font-size:22px; }
      .cel-secondary.cel-large{ font-size:17px; }
      .cel-footer{ margin-top:12px; font-size:11.5px; opacity:.6; font-weight:500; }
    `;
    document.head.appendChild(style);
  }

  // Cards are queued so a second showCard() call never overlaps the first —
  // this is what lets a caller show "who won" and then, right after,
  // "all-time top scorer" as two distinct floating windows in sequence.
  let queue = Promise.resolve();

  function rowHtml(row) {
    const primaryClass = "cel-primary" + (row.primaryLarge ? " cel-large" : "");
    const secondaryClass = "cel-secondary" + (row.secondaryLarge ? " cel-large" : "");
    const secondary = row.secondary ? `<span class="${secondaryClass}">${escapeHtml(row.secondary)}</span>` : "";
    // avatarUrl (even null) opts a row into showing a circular viewer photo
    // (or a colored-initial fallback) to the left of its primary text —
    // rows that never pass the key at all render exactly as before.
    const avatar = "avatarUrl" in row ? avatarChipHtml(row.avatarName || row.primary, row.avatarUrl, 26) : "";
    return `<div class="cel-row">${avatar}<span class="${primaryClass}">${escapeHtml(String(row.primary))}</span>${secondary}</div>`;
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Deterministic colored-initial fallback, same convention used
  // platform-wide (BLINDLE, FINDLE, CROSSDLE) — shown whenever a viewer's
  // real TikTok profile picture isn't available or fails to load.
  const AVATAR_PALETTE = ["#e0699c", "#4fa0c4", "#6faa5c", "#e0a934", "#9c6fd1", "#e0724a", "#3aa6a6", "#c4577a"];
  function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h;
  }
  function avatarColorFor(name) { return AVATAR_PALETTE[hashString(name || "?") % AVATAR_PALETTE.length]; }
  function avatarInitial(name) { const c = String(name || "").trim(); return c ? c[0].toUpperCase() : "?"; }
  function avatarChipHtml(name, avatarUrl, sizePx) {
    const initial = escapeHtml(avatarInitial(name));
    const color = avatarColorFor(name);
    const title = escapeHtml(name || "Unknown viewer");
    if (avatarUrl) {
      return `<span class="cel-avatar" style="width:${sizePx}px;height:${sizePx}px;" title="${title}">` +
        `<img class="cel-avatar-img" alt="" referrerpolicy="no-referrer" src="${escapeHtml(avatarUrl)}" ` +
        `onerror="this.parentElement.classList.add('cel-avatar-fallback');this.parentElement.style.background='${color}';this.replaceWith('${initial}')" /></span>`;
    }
    return `<span class="cel-avatar cel-avatar-fallback" style="width:${sizePx}px;height:${sizePx}px;background:${color};" title="${title}">${initial}</span>`;
  }

  // Shrinks the rows block down (as one unit — text, gaps, everything) so
  // its natural height fits inside the card without scrolling. Only falls
  // back to the browser's own scrollbar if a genuinely huge number of rows
  // would need to shrink past legibility.
  const ROWS_MIN_SCALE = 0.55;
  function fitRowsToCard(cardEl, rowsEl) {
    if (!cardEl || !rowsEl) return;
    rowsEl.style.transform = "";
    const nonRowsHeight = cardEl.scrollHeight - rowsEl.scrollHeight;
    const available = cardEl.clientHeight - nonRowsHeight;
    const natural = rowsEl.scrollHeight;
    if (!available || !natural || natural <= available) return;
    const scale = Math.max(ROWS_MIN_SCALE, available / natural);
    rowsEl.style.transform = `scale(${scale})`;
  }

  function showCard(opts) {
    const {
      emoji = "🎉",
      title = "",
      rows = [],
      footer = "",
      durationMs = 4000, // 4 seconds by default for every card
    } = opts || {};

    queue = queue.then(() => new Promise((resolve) => {
      // Hard singleton: no matter what got us here, clear out any
      // leftover card first so exactly one is ever on screen at once.
      document.querySelectorAll(".cel-overlay").forEach((el) => el.remove());

      const overlay = document.createElement("div");
      overlay.className = "cel-overlay";
      const card = document.createElement("div");
      card.className = "cel-card";
      card.innerHTML =
        `<div class="cel-emoji">${emoji}</div>` +
        `<div class="cel-title">${escapeHtml(title)}</div>` +
        `<div class="cel-rows">${rows.map(rowHtml).join("")}</div>` +
        (footer ? `<div class="cel-footer">${escapeHtml(footer)}</div>` : "");
      overlay.appendChild(card);
      document.body.appendChild(overlay);
      requestAnimationFrame(() => {
        fitRowsToCard(card, card.querySelector(".cel-rows"));
        requestAnimationFrame(() => overlay.classList.add("cel-visible"));
      });

      let closed = false;
      function close() {
        if (closed) return;
        closed = true;
        clearTimeout(timer);
        overlay.classList.remove("cel-visible");
        setTimeout(() => { overlay.remove(); resolve(); }, 260);
      }
      overlay.addEventListener("click", close);
      const timer = setTimeout(close, durationMs);
    }));
    return queue;
  }

  window.Celebration = { showCard };
})();
