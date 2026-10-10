// game-render.js
// Shared rendering logic for the Findle Live grid, answer strip,
// leaderboard and feed. Used by both host.html (the one-page app) and
// display.html (an optional plain audience screen for two-device setups).
//
// Implements the real mechanic confirmed from the official game:
// a letter only disappears once every hidden word using it has been
// found, and a found word's letters flash in sequence (mimicking the
// original swipe trace) before any now-fully-used tiles fall away.

const FindleRender = (() => {
  let previousFound = {}; // word -> found boolean, to detect new finds
  let previousTheme = null;

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Deterministic colored-initial fallback, used whenever a viewer's real
  // TikTok profile picture isn't available (host-typed play, Test Mode,
  // or the image URL failing to load).
  const AVATAR_PALETTE = ['#e0699c', '#4fa0c4', '#6faa5c', '#e0a934', '#9c6fd1', '#e0724a', '#3aa6a6', '#c4577a'];
  function hashString(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h;
  }
  function avatarColorFor(name) { return AVATAR_PALETTE[hashString(name || '?') % AVATAR_PALETTE.length]; }
  function avatarInitial(name) { const c = String(name || '').trim(); return c ? c[0].toUpperCase() : '?'; }

  function avatarChipHtml(name, avatarUrl, sizePx) {
    sizePx = sizePx || 20;
    const initial = escapeHtml(avatarInitial(name));
    const color = avatarColorFor(name);
    const title = escapeHtml(name || 'Unknown viewer');
    if (avatarUrl) {
      return `<span class="avatarChip" style="width:${sizePx}px;height:${sizePx}px;" title="${title}">` +
        `<img class="avatarChipImg" alt="" referrerpolicy="no-referrer" src="${escapeHtml(avatarUrl)}" ` +
        `onerror="this.parentElement.classList.add('avatarChipFallback');this.parentElement.style.background='${color}';this.replaceWith('${initial}')" /></span>`;
    }
    return `<span class="avatarChip avatarChipFallback" style="width:${sizePx}px;height:${sizePx}px;background:${color};" title="${title}">${initial}</span>`;
  }

  function renderGrid(gridEl, gridSize, letters, words, clearedGrid) {
    gridEl.style.gridTemplateColumns = `repeat(${gridSize}, 1fr)`;
    gridEl.style.gridTemplateRows = `repeat(${gridSize}, 1fr)`;

    const needsRebuild = gridEl.children.length !== gridSize * gridSize || gridEl.dataset.size != gridSize;
    if (needsRebuild) {
      gridEl.innerHTML = '';
      gridEl.dataset.size = gridSize;
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          const div = document.createElement('div');
          div.className = 'cell';
          div.dataset.r = r; div.dataset.c = c;
          div.textContent = letters[r][c];
          gridEl.appendChild(div);
        }
      }
    } else {
      Array.from(gridEl.children).forEach((cell) => {
        cell.textContent = letters[cell.dataset.r][cell.dataset.c];
      });
    }

    // find words that just transitioned to found, in path order
    const newlyFound = words.filter((w) => w.found && w.cells && !previousFound[w.word]);

    newlyFound.forEach((w) => {
      w.cells.forEach(([r, c], i) => {
        const cell = gridEl.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
        if (!cell) return;
        cell.style.animationDelay = (i * 90) + 'ms';
        cell.classList.add('flash');
        setTimeout(() => cell.classList.remove('flash'), i * 90 + 550);
      });
    });

    const clearDelay = newlyFound.length
      ? Math.max(...newlyFound.map((w) => w.cells.length)) * 90 + 380
      : 0;

    setTimeout(() => {
      if (!clearedGrid) return;
      Array.from(gridEl.children).forEach((cell) => {
        const r = +cell.dataset.r, c = +cell.dataset.c;
        cell.classList.toggle('cleared', !!clearedGrid[r][c]);
      });
    }, clearDelay);

    words.forEach((w) => { previousFound[w.word] = w.found; });
  }

  function renderAnswers(answersEl, words) {
    answersEl.innerHTML = words.map((w) => {
      if (w.found) {
        const credit = w.foundBy ? avatarChipHtml(w.foundBy, w.foundByAvatar, 18) + `<span class="credit">${escapeHtml(w.foundBy)}</span>` : '';
        return `<div class="answer-pill found">${escapeHtml(w.word)} ${credit}</div>`;
      }
      return `<div class="answer-pill">${escapeHtml(w.hint.split('').join(' '))}</div>`;
    }).join('');
  }

  function renderProgress(dotsEl, found, total) {
    let html = '';
    for (let i = 0; i < total; i++) html += `<div class="progress-dot ${i < found ? 'done' : ''}"></div>`;
    dotsEl.innerHTML = html;
  }

  function renderLeaderboard(el, list, emptyText) {
    if (!list.length) {
      el.innerHTML = `<div class="empty-hint">${emptyText || 'No scores yet.'}</div>`;
      return;
    }
    el.innerHTML = list.map((row, i) =>
      `<div class="leader-row"><span class="leader-rank">${i + 1}</span>${avatarChipHtml(row.name, row.avatarUrl, 22)}<span class="leader-name">${escapeHtml(row.name)}</span><span class="leader-score">${row.score}</span></div>`
    ).join('');
  }

  function renderFeed(el, feed, limit) {
    el.innerHTML = feed.slice(0, limit || 25).map((item) => {
      if (item.type === 'system') return `<div class="feed-item system">${escapeHtml(item.text)}</div>`;
      if (item.type === 'win') return `<div class="feed-item win">${escapeHtml(item.text)}</div>`;
      if (item.type === 'host') return `<div class="feed-item host"><span class="u">HOST:</span> ${escapeHtml(item.text)}</div>`;
      return `<div class="feed-item"><span class="u">${escapeHtml(item.user)}:</span> ${escapeHtml(item.text)}</div>`;
    }).join('');
  }

  function resetTrackingIfNewPuzzle(theme) {
    if (theme !== previousTheme) {
      previousFound = {};
      previousTheme = theme;
    }
  }

  function celebrate(gridWrapEl) {
    gridWrapEl.classList.add('celebrate');
    setTimeout(() => gridWrapEl.classList.remove('celebrate'), 1300);

    // lightweight confetti burst -- a handful of emoji drifting up and fading
    const emojis = ['🎉', '✨', '🧩', '⭐', '🎊'];
    for (let i = 0; i < 10; i++) {
      const span = document.createElement('div');
      span.className = 'confetti-bit';
      span.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      span.style.left = Math.random() * 100 + '%';
      span.style.animationDelay = (Math.random() * 0.3) + 's';
      gridWrapEl.appendChild(span);
      setTimeout(() => span.remove(), 1800);
    }
  }

  function medalFor(rank) {
    if (rank === 0) return '<span class="medal medal-gold">🥇</span>';
    if (rank === 1) return '<span class="medal medal-silver">🥈</span>';
    if (rank === 2) return '<span class="medal medal-bronze">🥉</span>';
    return `<span class="medal">${rank + 1}.</span>`;
  }

  let lastTickerSignature = null;

  function renderTicker(wrapEl, trackEl, list) {
    if (!list.length) {
      wrapEl.style.display = '';
      trackEl.style.animation = 'none';
      trackEl.innerHTML = '<span class="ticker-empty">Find hidden words in the grid to top the leaderboard!</span>';
      lastTickerSignature = null;
      return;
    }
    const signature = JSON.stringify(list);
    if (signature === lastTickerSignature) return; // avoid restarting the scroll animation needlessly
    lastTickerSignature = signature;

    const itemsHtml = list.map((row, i) =>
      `<span class="ticker-item">${medalFor(i)}${avatarChipHtml(row.name, row.avatarUrl, 16)}${escapeHtml(row.name)} <span class="tscore">${row.score}</span></span>`
    ).join('');
    // duplicate the content once so the loop (0% -> -50%) is seamless
    trackEl.innerHTML = itemsHtml + itemsHtml;
    const approxWidth = list.length * 160; // rough width estimate to keep scroll speed consistent
    trackEl.style.animation = 'none';
    // eslint-disable-next-line no-unused-expressions
    trackEl.offsetHeight; // force reflow so the animation restarts cleanly
    trackEl.style.animation = `tickerScroll ${Math.max(10, approxWidth / 40)}s linear infinite`;
  }

  function buildRecapRows(recap) {
    if (!recap || !recap.length) {
      return '<div class="empty-hint" style="text-align:center;">No words were found this round.</div>';
    }
    return '<div class="recap-list">' + recap.map((r) =>
      `<div class="recap-row"><span><span class="rword">${escapeHtml(r.word)}</span><br/><span class="rwho">${escapeHtml(r.foundBy)}</span></span><span class="rpts">+${r.points}</span></div>`
    ).join('') + '</div>';
  }

  return { escapeHtml, renderGrid, renderAnswers, renderProgress, renderLeaderboard, renderFeed, resetTrackingIfNewPuzzle, celebrate, renderTicker, medalFor, buildRecapRows };
})();
