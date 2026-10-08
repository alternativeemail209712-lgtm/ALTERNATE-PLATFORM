// ============================================================================
// CROSSDLE LIVE - front-end
// Renders whatever the server sends. All game logic lives server-side; this
// file is purely presentation + host input wiring.
// ============================================================================

(function () {
  'use strict';

  // --------------------------------------------------------------------
  // Mobile viewport height fix: measure the REAL visible height instead
  // of trusting raw 100vh, which lies on mobile browsers because of the
  // address bar. Re-measured on resize/orientation change.
  // --------------------------------------------------------------------
  function setAppHeight() {
    document.documentElement.style.setProperty('--app-height', window.innerHeight + 'px');
  }
  setAppHeight();
  window.addEventListener('resize', setAppHeight);
  window.addEventListener('orientationchange', setAppHeight);

  // --------------------------------------------------------------------
  // DOM references
  // --------------------------------------------------------------------
  const el = (id) => document.getElementById(id);

  const diagToggle = el('diagToggle');
  const diagPanel = el('diagPanel');
  const diagDot = el('diagDot');
  const diagSummary = el('diagSummary');
  const diagConnState = el('diagConnState');
  const diagSignKey = el('diagSignKey');
  const diagDictionary = el('diagDictionary');
  const diagEvents = el('diagEvents');
  const diagRecognized = el('diagRecognized');
  const diagLast = el('diagLast');
  const diagRawSamples = el('diagRawSamples');
  const diagErrors = el('diagErrors');

  const roundPill = el('roundPill');

  const fullscreenBtn = el('fullscreenBtn');
  const leaderboardBtn = el('leaderboardBtn');
  const leaderboardTicker = el('leaderboardTicker');
  const tickerTrack = el('tickerTrack');
  const leaderboardModal = el('leaderboardModal');
  const leaderboardModalClose = el('leaderboardModalClose');
  const leaderboardModalList = el('leaderboardModalList');
  const celebrationOverlay = el('celebrationOverlay');
  const celebrationCloseBtn = el('celebrationCloseBtn');
  const celebrationBody = el('celebrationBody');
  const celebrationDots = el('celebrationDots');
  const celebConfettiLayer = el('celebConfettiLayer');

  const keyboardRow1 = el('keyboardRow1');
  const keyboardRow2 = el('keyboardRow2');
  const rejectToast = el('rejectToast');

  const board = el('board');
  const boardEmpty = el('boardEmpty');
  const roundBanner = el('roundBanner');
  const hintsRow = el('hintsRow');
  const hintsTiles = el('hintsTiles');

  const strictFitToggle = el('strictFitToggle');
  const keyAutoColorToggle = el('keyAutoColorToggle');
  const starterWordToggle = el('starterWordToggle');
  const hostFab = el('hostFab');
  const hostPanelOverlay = el('hostPanelOverlay');
  const hostPanelClose = el('hostPanelClose');

  const tiktokUsernameInput = el('tiktokUsernameInput');
  const connectBtn = el('connectBtn');
  const disconnectBtn = el('disconnectBtn');
  const testModeToggle = el('testModeToggle');

  const startRoundBtn = el('startRoundBtn');
  const skipRoundBtn = el('skipRoundBtn');
  const hintBtn = el('hintBtn');
  const revealBtn = el('revealBtn');
  const wordLengthSelect = el('wordLengthSelect');
  const nextRoundDelaySelect = el('nextRoundDelaySelect');
  const resetLeaderboardBtn = el('resetLeaderboardBtn');

  const hostSayInput = el('hostSayInput');
  const hostSayBtn = el('hostSayBtn');

  const howToPlayBtn = el('howToPlayBtn');
  const howToPlayModal = el('howToPlayModal');
  const howToPlayClose = el('howToPlayClose');

  const MAX_DISPLAYED_ROWS = 60; // unlimited guesses server-side; the board only *renders* the most recent N for a smooth UI

  // --------------------------------------------------------------------
  // Diagnostics ribbon toggle
  // --------------------------------------------------------------------
  diagToggle.addEventListener('click', () => diagPanel.classList.toggle('hidden'));

  // --------------------------------------------------------------------
  // Fullscreen toggle
  // --------------------------------------------------------------------
  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }
  function updateFullscreenLabel() {
    const label = fullscreenBtn.querySelector('.btn-text');
    const icon = fullscreenBtn.querySelector('span');
    if (isFullscreen()) {
      icon.textContent = '⤢';
      if (label) label.textContent = 'Exit Fullscreen';
    } else {
      icon.textContent = '⛶';
      if (label) label.textContent = 'Fullscreen';
    }
  }
  fullscreenBtn.addEventListener('click', () => {
    try {
      if (!isFullscreen()) {
        const target = document.documentElement;
        const request = target.requestFullscreen || target.webkitRequestFullscreen;
        if (request) request.call(target);
      } else {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if (exit) exit.call(document);
      }
    } catch (_) {
      // Fullscreen isn't available in every browser/context - fail quietly,
      // the game still works perfectly well without it.
    }
  });
  document.addEventListener('fullscreenchange', updateFullscreenLabel);
  document.addEventListener('webkitfullscreenchange', updateFullscreenLabel);

  // --------------------------------------------------------------------
  // Host control panel: opened on demand from the floating button, closed
  // by the X, tapping the backdrop, or Escape.
  // --------------------------------------------------------------------
  function openHostPanel() { hostPanelOverlay.classList.remove('hidden'); }
  function closeHostPanel() { hostPanelOverlay.classList.add('hidden'); }
  hostFab.addEventListener('click', openHostPanel);
  hostPanelClose.addEventListener('click', closeHostPanel);
  hostPanelOverlay.addEventListener('click', (e) => {
    if (e.target === hostPanelOverlay) closeHostPanel();
  });

  // --------------------------------------------------------------------
  // How to Play modal
  // --------------------------------------------------------------------
  function openHowToPlay() { howToPlayModal.classList.remove('hidden'); }
  function closeHowToPlay() { howToPlayModal.classList.add('hidden'); }
  howToPlayBtn.addEventListener('click', openHowToPlay);
  howToPlayClose.addEventListener('click', closeHowToPlay);
  howToPlayModal.addEventListener('click', (e) => {
    if (e.target === howToPlayModal) closeHowToPlay();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeHowToPlay();
      closeHostPanel();
      closeLeaderboardModal();
    }
  });

  // Build the worked example in the modal using the SAME tile markup as the
  // real board, so it's a live, on-brand example rather than a static image.
  (function buildExample() {
    const guessTiles = el('exampleGuessTiles');
    const decoyTiles = el('exampleDecoyTiles');
    const guess = ['c', 'l', 'a', 'i', 'm'];
    const guessColors = ['green', 'yellow', 'grey', 'yellow', 'green'];
    const decoy = ['c', 'r', 'i', 'm', 'e'];
    guess.forEach((letter, i) => {
      const t = document.createElement('div');
      t.className = `tile tile-${guessColors[i]}`;
      t.textContent = letter;
      guessTiles.appendChild(t);
    });
    decoy.forEach((letter) => {
      const t = document.createElement('div');
      t.className = 'tile tile-decoy';
      t.textContent = letter;
      decoyTiles.appendChild(t);
    });
  })();

  // --------------------------------------------------------------------
  // On-screen keyboard: A-M / N-Z, colored with the BEST status seen for
  // each letter across this round's attempts (same info already visible
  // per-row on the board - this is just a fast-glance summary).
  // --------------------------------------------------------------------
  const KEY_ROW_1 = 'ABCDEFGHIJKLM'.split('');
  const KEY_ROW_2 = 'NOPQRSTUVWXYZ'.split('');
  const keyElements = new Map();

  (function buildKeyboard() {
    for (const letter of KEY_ROW_1) keyElements.set(letter, makeKey(letter, keyboardRow1));
    for (const letter of KEY_ROW_2) keyElements.set(letter, makeKey(letter, keyboardRow2));
  })();

  function makeKey(letter, container) {
    const key = document.createElement('div');
    key.className = 'key-tile key-unused';
    key.textContent = letter;
    container.appendChild(key);
    return key;
  }

  const RANK = { green: 3, yellow: 2, grey: 1, unused: 0 };

  let keyAutoColorOn = true;
  let lastKeyboardAttempts = [];

  function renderKeyboard(attempts) {
    lastKeyboardAttempts = attempts || [];
    if (!keyAutoColorOn) { resetKeyboard(); return; }
    const best = {};
    for (const attempt of attempts) {
      for (let i = 0; i < attempt.guess.length; i++) {
        const letter = attempt.guess[i].toUpperCase();
        const color = attempt.colors[i];
        if (!best[letter] || RANK[color] > RANK[best[letter]]) best[letter] = color;
      }
    }
    for (const [letter, keyEl] of keyElements) {
      const status = best[letter] || 'unused';
      keyEl.className = `key-tile key-${status}`;
    }
  }

  function resetKeyboard() {
    for (const keyEl of keyElements.values()) keyEl.className = 'key-tile key-unused';
  }

  // --------------------------------------------------------------------
  // Reject toast: shown when a chat message looked like a guess attempt
  // but wasn't a recognized word. Kept on screen a bit longer than a
  // typical toast so viewers actually have time to read it.
  // --------------------------------------------------------------------
  const REJECT_TOAST_DURATION_MS = 3500;
  let rejectToastTimer = null;
  function showRejectToast(username, guess, info) {
    if (info && info.reason === 'no-fit') {
      rejectToast.textContent = `❌ "${(guess || '').toUpperCase()}" from ${username} doesn't fit the tiles of guess #${(info.conflictIndex || 0) + 1} (${String(info.conflictWord || '').toUpperCase()}) - not added to the board.`;
    } else {
      rejectToast.textContent = `❌ "${(guess || '').toUpperCase()}" from ${username} isn't a recognized word - not added to the board.`;
    }
    rejectToast.classList.remove('hidden');
    if (rejectToastTimer) clearTimeout(rejectToastTimer);
    rejectToastTimer = setTimeout(() => rejectToast.classList.add('hidden'), REJECT_TOAST_DURATION_MS);
  }

  // --------------------------------------------------------------------
  // Leaderboard: an always-on scrolling ticker up top, plus a full
  // ranked list opened on demand from the header button.
  // --------------------------------------------------------------------
  function renderLeaderboardTicker(top) {
    const list = top || [];
    const medals = ['🥇', '🥈', '🥉'];

    if (!list.length) {
      tickerTrack.innerHTML = '<span class="ticker-entry">No scores yet - guesses earn points!</span>';
    } else {
      const entryHtml = list
        .map((e, i) => `<span class="ticker-entry">${medals[i] || (i + 1) + '.'} ${avatarChipHtml(e.username, e.avatarUrl, 16)}${escapeHtml(e.username)}<span class="ticker-score">${e.score} pts</span></span>`)
        .join('');
      // Two copies back-to-back so the CSS marquee (translateX -50%) loops seamlessly.
      tickerTrack.innerHTML = entryHtml + entryHtml;
    }

    leaderboardModalList.innerHTML = '';
    if (!list.length) {
      const li = document.createElement('li');
      li.className = 'empty-note';
      li.textContent = 'No scores yet - guesses earn points!';
      leaderboardModalList.appendChild(li);
      return;
    }
    list.forEach((entry, i) => {
      const li = document.createElement('li');
      if (i === 0) li.classList.add('top1');
      if (i === 1) li.classList.add('top2');
      if (i === 2) li.classList.add('top3');
      const left = document.createElement('span');
      const rank = document.createElement('span');
      rank.className = 'rank';
      rank.textContent = medals[i] || `${i + 1}.`;
      left.appendChild(rank);
      left.appendChild(buildAvatarNode(entry.username, entry.avatarUrl, 22));
      left.appendChild(document.createTextNode(entry.username));
      const score = document.createElement('span');
      score.className = 'lb-score';
      score.textContent = `${entry.score} pts`;
      li.appendChild(left);
      li.appendChild(score);
      leaderboardModalList.appendChild(li);
    });
  }

  function openLeaderboardModal() { leaderboardModal.classList.remove('hidden'); }
  function closeLeaderboardModal() { leaderboardModal.classList.add('hidden'); }
  leaderboardBtn.addEventListener('click', openLeaderboardModal);
  leaderboardModalClose.addEventListener('click', closeLeaderboardModal);
  leaderboardModal.addEventListener('click', (e) => {
    if (e.target === leaderboardModal) closeLeaderboardModal();
  });

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Deterministic colored-initial fallback, used whenever a viewer's real
  // TikTok profile picture isn't available (host-typed play, Test Mode,
  // or the image URL failing to load) — same pattern used across the
  // rest of the platform (BLINDLE, FINDLE).
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

  // DOM-node version of the same chip, for spots that build real elements
  // (the guess board rows) instead of innerHTML strings.
  function buildAvatarNode(name, avatarUrl, sizePx) {
    const wrap = document.createElement('span');
    wrap.className = 'avatarChip';
    wrap.style.width = sizePx + 'px';
    wrap.style.height = sizePx + 'px';
    wrap.title = name || 'Unknown viewer';
    function showFallback() {
      wrap.innerHTML = '';
      wrap.classList.add('avatarChipFallback');
      wrap.style.background = avatarColorFor(name);
      wrap.textContent = avatarInitial(name);
    }
    if (avatarUrl) {
      const img = document.createElement('img');
      img.className = 'avatarChipImg';
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      img.onerror = showFallback;
      img.src = avatarUrl;
      wrap.appendChild(img);
    } else {
      showFallback();
    }
    return wrap;
  }

  // --------------------------------------------------------------------
  // Socket.io connection
  // --------------------------------------------------------------------
  const socket = io('/crossdle');

  socket.on('state:full', (state) => {
    renderDiagnostics(state.diagnostics);
    renderTiktokStatus(state.tiktokStatus);
    renderGame(state.game);
    diagSignKey.textContent = state.signKeyConfigured ? 'yes ✅' : 'NO ⚠️ (see setup step 4)';
    if (state.dictionary) {
      const d = state.dictionary;
      const sourceLabel = { remote: 'downloaded live ✅', 'disk-cache': 'cached copy ✅', 'fallback-embedded': 'small built-in fallback ⚠️' }[d.source] || d.source;
      diagDictionary.textContent = `${d.totalWords.toLocaleString()} words (${sourceLabel})`;
    }
    testModeToggle.checked = !!state.testModeActive;
    if (state.game && state.game.wordLength) wordLengthSelect.value = String(state.game.wordLength);
    if (state.game && state.game.nextRoundDelayMs) {
      nextRoundDelaySelect.value = String(Math.round(state.game.nextRoundDelayMs / 1000));
    }
  });

  socket.on('game:update', renderGame);
  socket.on('diagnostics:update', renderDiagnostics);
  socket.on('tiktok:status', renderTiktokStatus);
  socket.on('testMode:status', (s) => { testModeToggle.checked = !!s.active; });
  socket.on('guess:rejected', (payload) => showRejectToast(payload.username, payload.guess, payload));

  socket.on('connect_error', () => {
    diagSummary.textContent = 'Cannot reach the server socket. Reload the page.';
  });

  // --------------------------------------------------------------------
  // Diagnostics rendering
  // --------------------------------------------------------------------
  function renderDiagnostics(d) {
    if (!d) return;
    diagEvents.textContent = d.eventsReceived;
    diagRecognized.textContent = d.recognizedCount;
    diagSummary.textContent = `Events: ${d.eventsReceived} · Accepted: ${d.recognizedCount}`;

    if (d.lastReceived) {
      const { username, text, source } = d.lastReceived;
      diagLast.textContent = `[${source}] ${username}: ${truncate(text, 80)}`;
    }

    if (d.rawSamples && d.rawSamples.length) {
      diagRawSamples.textContent = d.rawSamples.map((s) => `--- ${s.eventName} ---\n${s.text}`).join('\n\n');
    }

    diagErrors.textContent = d.errors && d.errors.length
      ? d.errors.map((e) => `[${new Date(e.ts).toLocaleTimeString()}] ${e.context}: ${e.message}`).join('\n')
      : 'No errors logged.';

    if (d.connection) renderTiktokStatus(d.connection);
  }

  function renderTiktokStatus(status) {
    if (!status) return;
    diagConnState.textContent = `${status.state}${status.username ? ' (@' + status.username + ')' : ''} - ${status.message || ''}`;
    diagDot.className = 'status-dot status-' + (status.state || 'idle');
  }

  // --------------------------------------------------------------------
  // Game state rendering
  // --------------------------------------------------------------------
  let lastRenderedRoundNumber = null;
  let lastRenderedAttemptCount = 0;
  // The starter-word row shows the live host's TikTok picture, which can arrive after the round
  // has started - so a change in it forces the board to redraw.
  let lastRenderedStarterAvatar = null;

  function renderGame(game) {
    if (!game) return;
    if (strictFitToggle) strictFitToggle.checked = game.strictFit !== false; // Strict fit is ON unless the host switched it off
    if (keyAutoColorToggle) keyAutoColorToggle.checked = game.keyAutoColor !== false; // ON unless the host switched it off
    if (starterWordToggle) starterWordToggle.checked = game.starterWord !== false; // ON unless the host switched it off
    const keyAutoColorChanged = keyAutoColorOn !== (game.keyAutoColor !== false);
    keyAutoColorOn = game.keyAutoColor !== false;

    roundPill.textContent = game.roundNumber ? `Round ${game.roundNumber}` : 'Round —';
    renderLeaderboardTicker(game.leaderboard || []);

    const round = game.round;

    if (!round) {
      boardEmpty.classList.remove('hidden');
      board.querySelectorAll('.attempt-row').forEach((n) => n.remove());
      roundBanner.classList.add('hidden');
      hintsRow.classList.add('hidden');
      resetKeyboard();
      lastRenderedRoundNumber = null;
      lastRenderedAttemptCount = 0;
      lastRenderedStarterAvatar = null;
      return;
    }

    boardEmpty.classList.add('hidden');

    const isNewRound = round.number !== lastRenderedRoundNumber;
    const attemptCountChanged = round.attempts.length !== lastRenderedAttemptCount;
    const starterAttempt = round.attempts.find((a) => a.isStarter);
    const starterAvatar = (starterAttempt && starterAttempt.avatarUrl) || null;
    const starterAvatarChanged = starterAvatar !== lastRenderedStarterAvatar;

    if (isNewRound) {
      resetKeyboard();
    }

    if (isNewRound || attemptCountChanged || starterAvatarChanged) {
      renderBoard(round, isNewRound || starterAvatarChanged);
      renderKeyboard(round.attempts);
      lastRenderedRoundNumber = round.number;
      lastRenderedAttemptCount = round.attempts.length;
      lastRenderedStarterAvatar = starterAvatar;
    }

    // The host flipped Auto-color keyboard keys: repaint the keys right away.
    if (keyAutoColorChanged) renderKeyboard(round.attempts);

    renderHints(round);
    renderBanner(round, game.leaderboard || []);
  }

  function renderBoard(round, fullRebuild) {
    if (fullRebuild) {
      board.querySelectorAll('.attempt-row').forEach((n) => n.remove());
      const attempts = round.attempts.slice(-MAX_DISPLAYED_ROWS).reverse();
      for (const attempt of attempts) board.appendChild(buildAttemptRow(attempt, false));
      return;
    }
    const freshOnes = round.attempts.slice(lastRenderedAttemptCount);
    for (const attempt of freshOnes.slice().reverse()) {
      board.insertBefore(buildAttemptRow(attempt, true), board.firstChild);
    }
    while (board.querySelectorAll('.attempt-row').length > MAX_DISPLAYED_ROWS) {
      board.removeChild(board.lastChild);
    }
  }

  function buildAttemptRow(attempt, animateIn) {
    const row = document.createElement('div');
    row.className = 'attempt-row' + (attempt.correct ? ' attempt-correct' : '');

    const userDiv = document.createElement('div');
    userDiv.className = 'attempt-user';
    userDiv.appendChild(buildAvatarNode(attempt.username, attempt.avatarUrl, 20));
    userDiv.appendChild(document.createTextNode(attempt.username));
    row.appendChild(userDiv);

    const guessSet = document.createElement('div');
    guessSet.className = 'tile-set';
    for (let i = 0; i < attempt.guess.length; i++) {
      const tile = document.createElement('div');
      tile.className = `tile tile-${attempt.colors[i]}` + (animateIn ? ' tile-new' : '');
      tile.textContent = attempt.guess[i];
      guessSet.appendChild(tile);
    }
    row.appendChild(guessSet);

    const decoySet = document.createElement('div');
    decoySet.className = 'tile-set';
    for (let i = 0; i < attempt.decoy.length; i++) {
      const tile = document.createElement('div');
      tile.className = 'tile tile-decoy' + (animateIn ? ' tile-new' : '');
      tile.textContent = attempt.decoy[i];
      decoySet.appendChild(tile);
    }
    row.appendChild(decoySet);

    return row;
  }

  function renderHints(round) {
    if (!round.hints || round.hints.length === 0) {
      hintsRow.classList.add('hidden');
      return;
    }
    hintsRow.classList.remove('hidden');
    hintsTiles.innerHTML = '';
    const sorted = [...round.hints].sort((a, b) => a.index - b.index);
    for (const h of sorted) {
      const tile = document.createElement('div');
      tile.className = 'hint-tile';
      tile.textContent = h.letter;
      tile.title = `Position ${h.index + 1}`;
      hintsTiles.appendChild(tile);
    }
  }

  let lastBannerStatus = null;
  function renderBanner(round, leaderboardTop) {
    if (round.status === 'active') {
      roundBanner.classList.add('hidden');
      roundBanner.innerHTML = '';
      lastBannerStatus = null;
      return;
    }
    const statusKey = `${round.number}:${round.status}`;
    const changed = lastBannerStatus !== statusKey;
    roundBanner.classList.remove('hidden');
    if (!changed) return; // already showing the right thing - don't re-animate it

    roundBanner.innerHTML = '';

    if (round.status === 'solved') {
      roundBanner.className = 'round-banner win';

      // Row 1: who got it right (larger, the star of the moment).
      const quickTag = round.quickSolve ? ' ⚡' : '';
      const winnerRow = document.createElement('div');
      winnerRow.className = 'banner-row banner-row-winner';
      winnerRow.appendChild(buildAvatarNode(round.solvedBy, round.solvedByAvatar, 26));
      winnerRow.appendChild(document.createTextNode(`🎉 ${round.solvedBy} got it right!${quickTag}`));
      roundBanner.appendChild(winnerRow);

      // Row 2: the answer and points earned (smaller, supporting detail).
      const answerRow = document.createElement('div');
      answerRow.className = 'banner-row banner-row-answer';
      answerRow.textContent = `Answer: ${(round.revealAnswer || '').toUpperCase()} · +${round.solveBonus} pts`;
      roundBanner.appendChild(answerRow);

      fireConfetti();
      triggerWinCelebration(round, leaderboardTop);
    } else {
      roundBanner.className = 'round-banner lose';
      const reason = round.status === 'timeout' ? 'Time ran out!' : 'Round ended.';
      const row = document.createElement('div');
      row.className = 'banner-row banner-row-winner';
      row.textContent = `${reason} The word was "${(round.revealAnswer || '').toUpperCase()}".`;
      roundBanner.appendChild(row);
    }
    lastBannerStatus = statusKey;
  }

  function fireConfetti() {
    const colors = ['#8a5cff', '#4f8dff', '#22e0c9', '#3fd67a', '#ffcf70'];
    for (let i = 0; i < 18; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = Math.random() * 100 + '%';
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = Math.random() * 0.3 + 's';
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;
      roundBanner.appendChild(piece);
      setTimeout(() => piece.remove(), 2200);
    }
  }

  // ----------------------------------------------------------------
  // Win celebration overlay - a full-screen sequence (winner, then the
  // all-time leaderboard) with screen-wide confetti, matching BLINDLE's
  // celebration format. Only fires on an actual SOLVE (never on a
  // skip/reveal/timeout), and walks itself through both stages before
  // auto-dismissing - tapping the overlay (or the ✕) closes it early.
  // ----------------------------------------------------------------
  const CELEB_STAGE_SECONDS = 3;
  const CELEB_CONFETTI_COLORS = ['#8a5cff', '#4f8dff', '#22e0c9', '#3fd67a', '#ffcf70'];
  let celebTimer = null;
  let celebStage = 0;

  function spawnScreenConfetti() {
    for (let i = 0; i < 60; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.left = Math.random() * 100 + 'vw';
      piece.style.background = CELEB_CONFETTI_COLORS[i % CELEB_CONFETTI_COLORS.length];
      const duration = 1.5 + Math.random() * 1.2;
      piece.style.animationDuration = duration + 's';
      piece.style.animationDelay = Math.random() * 0.3 + 's';
      celebConfettiLayer.appendChild(piece);
      setTimeout(() => piece.remove(), (duration + 0.5) * 1000);
    }
  }

  function renderCelebBoard(list) {
    if (!list || !list.length) return '<li class="empty">No scores yet</li>';
    const medals = ['🥇', '🥈', '🥉'];
    return list.map((row, i) =>
      `<li><span class="rank">${medals[i] || '#' + (i + 1)}</span>${avatarChipHtml(row.username, row.avatarUrl, 22)}<span>${escapeHtml(row.username)}</span><span>${row.score} pts</span></li>`
    ).join('');
  }

  function showCelebStage(stageIndex, round, leaderboardTop) {
    celebrationDots.querySelectorAll('.celebDot').forEach((dot) => {
      dot.classList.toggle('active', Number(dot.dataset.stage) === stageIndex);
    });
    if (stageIndex === 0) {
      const quickTag = round.quickSolve ? ' ⚡' : '';
      celebrationBody.innerHTML =
        '<div class="celebLabel">🎉 Winner</div>' +
        `<div class="celebWinnerRow">${avatarChipHtml(round.solvedBy, round.solvedByAvatar, 34)}<span>${escapeHtml(round.solvedBy)}${quickTag}</span></div>` +
        `<div class="celebAnswerRow">${escapeHtml((round.revealAnswer || '').toUpperCase())}</div>` +
        `<div class="celebPoints">+${round.solveBonus} points</div>`;
    } else {
      celebrationBody.innerHTML =
        '<div class="celebBoardTitle">👑 All-time top scorers</div>' +
        `<ul class="celebBoardList">${renderCelebBoard(leaderboardTop)}</ul>`;
    }
  }

  function hideCelebration() {
    clearTimeout(celebTimer);
    celebrationOverlay.classList.add('hidden');
  }

  function advanceCeleb(round, leaderboardTop) {
    celebStage += 1;
    if (celebStage >= 2) { hideCelebration(); return; }
    showCelebStage(celebStage, round, leaderboardTop);
    celebTimer = setTimeout(() => advanceCeleb(round, leaderboardTop), CELEB_STAGE_SECONDS * 1000);
  }

  function triggerWinCelebration(round, leaderboardTop) {
    spawnScreenConfetti();
    celebStage = 0;
    celebrationOverlay.classList.remove('hidden');
    showCelebStage(0, round, leaderboardTop || []);
    clearTimeout(celebTimer);
    celebTimer = setTimeout(() => advanceCeleb(round, leaderboardTop || []), CELEB_STAGE_SECONDS * 1000);
  }

  celebrationCloseBtn.addEventListener('click', hideCelebration);
  celebrationOverlay.addEventListener('click', (e) => { if (e.target === celebrationOverlay) hideCelebration(); });

  // --------------------------------------------------------------------
  // Host control wiring
  // --------------------------------------------------------------------
  connectBtn.addEventListener('click', () => {
    const username = tiktokUsernameInput.value.trim();
    if (!username) { tiktokUsernameInput.focus(); return; }
    socket.emit('tiktok:connect', { username });
  });

  disconnectBtn.addEventListener('click', () => socket.emit('tiktok:disconnect'));

  testModeToggle.addEventListener('change', () => {
    socket.emit(testModeToggle.checked ? 'testMode:start' : 'testMode:stop');
  });

  startRoundBtn.addEventListener('click', () => socket.emit('host:startRound'));
  skipRoundBtn.addEventListener('click', () => socket.emit('host:skipRound'));
  hintBtn.addEventListener('click', () => socket.emit('host:giveHint'));
  revealBtn.addEventListener('click', () => socket.emit('host:revealAnswer'));
  resetLeaderboardBtn.addEventListener('click', () => {
    if (confirm('Reset the leaderboard for everyone? This cannot be undone.')) {
      socket.emit('host:resetLeaderboard');
    }
  });

  // Strict fit applies immediately, without restarting the round.
  if (starterWordToggle) starterWordToggle.addEventListener('change', () => {
    socket.emit('host:setStarterWord', { on: starterWordToggle.checked });
  });
  if (keyAutoColorToggle) keyAutoColorToggle.addEventListener('change', () => {
    socket.emit('host:setKeyAutoColor', { on: keyAutoColorToggle.checked });
  });
  if (strictFitToggle) strictFitToggle.addEventListener('change', () => {
    socket.emit('host:setStrictFit', { on: strictFitToggle.checked });
  });

  wordLengthSelect.addEventListener('change', () => {
    socket.emit('host:setWordLength', { length: Number(wordLengthSelect.value) });
  });

  nextRoundDelaySelect.addEventListener('change', () => {
    socket.emit('host:setNextRoundDelay', { seconds: Number(nextRoundDelaySelect.value) });
  });

  function sendHostSay() {
    const text = hostSayInput.value.trim();
    if (!text) return;
    socket.emit('host:say', { text });
    hostSayInput.value = '';
    hostSayInput.focus();
  }
  hostSayBtn.addEventListener('click', sendHostSay);
  hostSayInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendHostSay(); });
  tiktokUsernameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') connectBtn.click(); });

  // --------------------------------------------------------------------
  // Small helpers
  // --------------------------------------------------------------------
  function truncate(str, n) {
    if (!str) return '';
    return str.length > n ? str.slice(0, n) + '…' : str;
  }
})();
