// app.js — runs in the browser (host view). Follows BLINDLE's own
// game.js structure (same drawers, celebration sequence, toast, and
// leaderboard behavior) with TWISTLE's own symbol board rendered using
// twistle-symbols.js and the same adaptive letters/symbols layout as
// the original standalone TWISTLE page.

function setRealViewportHeight() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
}
setRealViewportHeight();
window.addEventListener("resize", setRealViewportHeight);
window.addEventListener("orientationchange", setRealViewportHeight);

TwistleSymbols.buildSprite();

const el = {
  brandDot: document.getElementById("brandDot"),
  modeBadge: document.getElementById("modeBadge"),
  lengthBadge: document.getElementById("lengthBadge"),
  hintBtn: document.getElementById("hintBtn"),
  helpBtn: document.getElementById("helpBtn"),
  leaderboardBtn: document.getElementById("leaderboardBtn"),
  settingsBtn: document.getElementById("settingsBtn"),
  fullscreenBtn: document.getElementById("fullscreenBtn"),

  confettiLayer: document.getElementById("confettiLayer"),
  rejectionToast: document.getElementById("rejectionToast"),

  roundLabel: document.getElementById("roundLabel"),
  roundSub: document.getElementById("roundSub"),
  guessBadge: document.getElementById("guessBadge"),
  keyboardSection: document.getElementById("keyboardSection"),
  keyboard: document.getElementById("keyboard"),
  resetColorsBtn: document.getElementById("resetColorsBtn"),
  grid: document.getElementById("grid"),
  hintChips: document.getElementById("hintChips"),
  hintExplainer: document.getElementById("hintExplainer"),
  hintLine: document.getElementById("hintLine"),
  offlineNote: document.getElementById("offlineNote"),
  resultBanner: document.getElementById("resultBanner"),
  resultText: document.getElementById("resultText"),
  answerTiles: document.getElementById("answerTiles"),
  legendRow: document.getElementById("legendRow"),
  playAgainBtn: document.getElementById("playAgainBtn"),
  autoContinueNote: document.getElementById("autoContinueNote"),
  idleBanner: document.getElementById("idleBanner"),

  controlsHandle: document.getElementById("controlsHandle"),
  controlsBody: document.getElementById("controlsBody"),
  liveControls: document.getElementById("liveControls"),
  testControls: document.getElementById("testControls"),
  offlineControls: document.getElementById("offlineControls"),
  tiktokUsernameBottom: document.getElementById("tiktokUsernameBottom"),
  connectBtnBottom: document.getElementById("connectBtnBottom"),
  setAnswerInputLive: document.getElementById("setAnswerInputLive"),
  setAnswerBtnLive: document.getElementById("setAnswerBtnLive"),
  setAnswerErrorLive: document.getElementById("setAnswerErrorLive"),
  setAnswerInputTest: document.getElementById("setAnswerInputTest"),
  setAnswerBtnTest: document.getElementById("setAnswerBtnTest"),
  setAnswerErrorTest: document.getElementById("setAnswerErrorTest"),
  offlineGuessInput: document.getElementById("offlineGuessInput"),
  offlineGuessBtn: document.getElementById("offlineGuessBtn"),
  offlineError: document.getElementById("offlineError"),
  revealBtn: document.getElementById("revealBtn"),
  miniStatus: document.getElementById("miniStatus"),

  settingsOverlay: document.getElementById("settingsOverlay"),
  closeSettings: document.getElementById("closeSettings"),
  modeChip: document.getElementById("modeChip"),
  connChip: document.getElementById("connChip"),
  modePickerBtn: document.getElementById("modePickerBtn"),
  modePickerLabel: document.getElementById("modePickerLabel"),
  tiktokUsername: document.getElementById("tiktokUsername"),
  connectBtn: document.getElementById("connectBtn"),
  disconnectBtn: document.getElementById("disconnectBtn"),
  wordLengthSelect: document.getElementById("wordLengthSelect"),
  difficultySelect: document.getElementById("difficultySelect"),
  randomLengthToggle: document.getElementById("randomLengthToggle"),
  fixedLengthRow: document.getElementById("fixedLengthRow"),
  randomLengthRow: document.getElementById("randomLengthRow"),
  randomLengthNote: document.getElementById("randomLengthNote"),
  lengthMinSelect: document.getElementById("lengthMinSelect"),
  lengthMaxSelect: document.getElementById("lengthMaxSelect"),
  autoContinueToggle: document.getElementById("autoContinueToggle"),
  delayInput: document.getElementById("delayInput"),
  revealShowInput: document.getElementById("revealShowInput"),
  leaderboardShowInput: document.getElementById("leaderboardShowInput"),
  rejectionToastShowInput: document.getElementById("rejectionToastShowInput"),
  strictFitToggle: document.getElementById("strictFitToggle"),
  starterWordToggle: document.getElementById("starterWordToggle"),
  applyBtn: document.getElementById("applyBtn"),
  diagToggle: document.getElementById("diagToggle"),
  diagGrid: document.getElementById("diagGrid"),
  resetRoundBtn: document.getElementById("resetRoundBtn"),
  resetTotalBtn: document.getElementById("resetTotalBtn"),

  modePickerOverlay: document.getElementById("modePickerOverlay"),

  leaderboardOverlay: document.getElementById("leaderboardOverlay"),
  closeLeaderboard: document.getElementById("closeLeaderboard"),
  celebrationOverlay: document.getElementById("celebrationOverlay"),
  celebrationBody: document.getElementById("celebrationBody"),
  celebrationDots: document.getElementById("celebrationDots"),
  closeCelebration: document.getElementById("closeCelebration"),
  tabThisRound: document.getElementById("tabThisRound"),
  tabAllTime: document.getElementById("tabAllTime"),
  leaderboardList: document.getElementById("leaderboardList"),
  leaderboardNote: document.getElementById("leaderboardNote"),

  howToOverlay: document.getElementById("howToOverlay"),
  howToExample: document.getElementById("howToExample"),
  closeHowTo: document.getElementById("closeHowTo"),
  closeHowTo2: document.getElementById("closeHowTo2")
};

const MODE_LABELS = {
  live: { title: "Live", desc: "Counts for the chat leaderboard" },
  test: { title: "Test", desc: "Practice — scores not saved" },
  offline: { title: "Offline", desc: "Host plays solo" }
};

// ------------------------------------------------------------
// Manual, host-only scratchpad coloring — ported from BLINDLE's
// game.js, same mechanism exactly. TWISTLE's real per-letter truth
// stays hidden until a round is revealed, so this is a completely
// separate, manual deduction aid: click a letter (on the keyboard OR
// on any of its tiles in the guess grid) to cycle it through
// absent -> present -> correct -> none. Colors are keyed by LETTER,
// not by tile/key element, so every occurrence of that letter
// everywhere on screen lights up together.
// ------------------------------------------------------------
const CYCLE = [null, "absent", "present", "correct"];
let manualLetterColors = {};

function nextColor(current) {
  const idx = CYCLE.indexOf(current || null);
  return CYCLE[(idx + 1) % CYCLE.length];
}

function cycleLetterColor(letter) {
  const next = nextColor(manualLetterColors[letter] || null);
  if (next) manualLetterColors[letter] = next;
  else delete manualLetterColors[letter];
  paintKeyboard();
  // Bypass the grid's render cache (it only tracks round/guess-count
  // changes) so a pure color change repaints immediately.
  lastGridSig = "";
  if (lastState) renderGrid(lastState.game);
}
function cycleKeyColor(letter) { cycleLetterColor(letter); }
function cycleTileColor(letter) { cycleLetterColor(letter); }

function resetManualColors() {
  manualLetterColors = {};
  paintKeyboard();
  lastGridSig = "";
  if (lastState) renderGrid(lastState.game);
}

function paintKeyboard() {
  const usedLetters = new Set((lastState && lastState.game && lastState.game.usedLetters) || []);
  el.keyboard.querySelectorAll(".key").forEach((key) => {
    const letter = key.dataset.letter;
    const manual = manualLetterColors[letter];
    let cls = "key";
    if (manual) cls += " " + manual;
    else if (usedLetters.has(letter)) cls += " used";
    key.className = cls;
  });
}

// Two balanced rows of 13, alphabetical - a deduction board, not a
// typing keyboard (nobody types on this; it's a host-only
// click-to-mark scratchpad) - identical layout to BLINDLE's keyboard.
const KEYBOARD_ROWS = [
  ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m"],
  ["n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"]
];
for (const row of KEYBOARD_ROWS) {
  const rowEl = document.createElement("div");
  rowEl.className = "keyRow";
  for (const letter of row) {
    const key = document.createElement("div");
    key.className = "key";
    key.dataset.letter = letter;
    key.textContent = letter;
    key.addEventListener("click", () => cycleKeyColor(letter));
    rowEl.appendChild(key);
  }
  el.keyboard.appendChild(rowEl);
}
// The keyboard is 13 keys per row and lives in its own section - it
// sizes itself to ITS OWN available width, not just the guess-tile
// size (which is computed for the widest realistic guess row sharing
// width with its avatar+symbols - applying that directly here would
// often overflow, since 13 keys at that size can be wider than the
// whole screen).
function computeKeyboardMetrics(preferredTileSize) {
  const containerWidth = el.keyboard.clientWidth || el.keyboardSection.clientWidth || 320;
  const columns = 13;
  const gap = 4;
  let sizeByWidth = Math.floor((containerWidth - gap * (columns - 1)) / columns);
  sizeByWidth = Math.max(8, sizeByWidth);
  const size = Math.max(8, Math.min(preferredTileSize, sizeByWidth));
  const height = Math.round(size * 1.05);
  const fontSize = Math.max(7, Math.round(size * 0.42));
  return { size, height, fontSize, gap };
}
function applyKeyMetrics(preferredTileSize) {
  const km = computeKeyboardMetrics(preferredTileSize);
  el.keyboard.querySelectorAll(".keyRow").forEach((row) => {
    row.style.gap = km.gap + "px";
  });
  el.keyboard.querySelectorAll(".key").forEach((key) => {
    key.style.width = km.size + "px";
    key.style.height = km.height + "px";
    key.style.fontSize = km.fontSize + "px";
  });
}
el.resetColorsBtn.addEventListener("click", resetManualColors);

function renderKeyboardVisibility(g) {
  el.keyboardSection.style.display = g.status === "live" ? "block" : "none";
}

let wasFreshRoundStart = false;
function detectFreshRound(g) {
  const isFreshRoundStart = g.status === "live" && g.guessesMade === 0;
  if (isFreshRoundStart && !wasFreshRoundStart) resetManualColors();
  wasFreshRoundStart = isFreshRoundStart;
}

// ------------------------------------------------------------
// Fullscreen toggle (cross-browser, with graceful no-op fallback
// on browsers - notably iOS Safari - that don't support it)
// ------------------------------------------------------------
function isFullscreen() {
  return Boolean(
    document.fullscreenElement || document.webkitFullscreenElement ||
    document.mozFullScreenElement || document.msFullscreenElement
  );
}
function requestFS() {
  const root = document.documentElement;
  const fn = root.requestFullscreen || root.webkitRequestFullscreen || root.mozRequestFullScreen || root.msRequestFullscreen;
  if (!fn) return;
  try {
    const p = fn.call(root);
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* ignore - not supported here */ }
}
function exitFS() {
  const fn = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
  if (!fn) return;
  try {
    const p = fn.call(document);
    if (p && p.catch) p.catch(() => {});
  } catch (e) { /* ignore */ }
}
el.fullscreenBtn.addEventListener("click", () => {
  if (isFullscreen()) exitFS();
  else requestFS();
});
["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"].forEach((evt) => {
  document.addEventListener(evt, () => {
    const fs = isFullscreen();
    el.fullscreenBtn.classList.toggle("active", fs);
    el.fullscreenBtn.setAttribute("aria-label", fs ? "Exit fullscreen" : "Enter fullscreen");
    setRealViewportHeight();
    applyLayout();
  });
});

for (let n = 4; n <= 20; n++) {
  const opt = document.createElement("option");
  opt.value = String(n);
  opt.textContent = n + " letters";
  if (n === 5) opt.selected = true;
  el.wordLengthSelect.appendChild(opt);
}
for (let n = 4; n <= 20; n++) {
  const optMin = document.createElement("option");
  optMin.value = String(n);
  optMin.textContent = String(n);
  if (n === 4) optMin.selected = true;
  el.lengthMinSelect.appendChild(optMin);

  const optMax = document.createElement("option");
  optMax.value = String(n);
  optMax.textContent = String(n);
  if (n === 8) optMax.selected = true;
  el.lengthMaxSelect.appendChild(optMax);
}

function updateLengthModeUI() {
  const isRandom = el.randomLengthToggle.checked;
  el.fixedLengthRow.hidden = isRandom;
  el.randomLengthRow.hidden = !isRandom;
  el.randomLengthNote.hidden = !isRandom;
}
el.randomLengthToggle.addEventListener("change", updateLengthModeUI);
el.lengthMinSelect.addEventListener("change", () => {
  if (Number(el.lengthMinSelect.value) > Number(el.lengthMaxSelect.value)) {
    el.lengthMaxSelect.value = el.lengthMinSelect.value;
  }
});
el.lengthMaxSelect.addEventListener("change", () => {
  if (Number(el.lengthMaxSelect.value) < Number(el.lengthMinSelect.value)) {
    el.lengthMinSelect.value = el.lengthMaxSelect.value;
  }
});

let stagedMode = "test";

function syncStagedSettingsFromState(g) {
  stagedMode = g.mode;
  el.wordLengthSelect.value = String(g.wordLength);
  el.difficultySelect.value = g.difficulty;
  el.randomLengthToggle.checked = g.lengthMode === "random";
  el.lengthMinSelect.value = String(g.lengthMin || 4);
  el.lengthMaxSelect.value = String(g.lengthMax || 8);
  updateLengthModeUI();
  el.autoContinueToggle.checked = g.autoContinue;
  el.delayInput.value = g.autoContinueDelaySeconds;
  el.revealShowInput.value = g.revealShowSeconds;
  el.leaderboardShowInput.value = g.leaderboardShowSeconds;
  el.rejectionToastShowInput.value = g.rejectionToastSeconds;
  if (el.strictFitToggle) el.strictFitToggle.checked = g.strictFit !== false; // Strict fit is ON unless the host switched it off
  if (el.starterWordToggle) el.starterWordToggle.checked = g.starterWord !== false; // ON unless the host switched it off
  updateModePickerLabel();
}

function updateModePickerLabel() {
  const info = MODE_LABELS[stagedMode];
  el.modePickerLabel.textContent = info.title + " — " + info.desc;
  document.querySelectorAll(".pickerOption").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.mode === stagedMode);
  });
}

el.controlsHandle.addEventListener("click", () => {
  const expanded = el.controlsHandle.getAttribute("aria-expanded") === "true";
  el.controlsHandle.setAttribute("aria-expanded", String(!expanded));
  el.controlsBody.classList.toggle("collapsed", expanded);
});

el.diagToggle.addEventListener("click", () => {
  const showing = el.diagToggle.getAttribute("aria-expanded") === "true";
  el.diagToggle.setAttribute("aria-expanded", String(!showing));
  el.diagToggle.textContent = showing ? "show" : "hide";
  el.diagGrid.style.display = showing ? "none" : "grid";
});

function openDrawer(overlay) { overlay.hidden = false; }
function closeDrawer(overlay) { overlay.hidden = true; }

el.settingsBtn.addEventListener("click", () => {
  if (lastState) syncStagedSettingsFromState(lastState.game);
  openDrawer(el.settingsOverlay);
});
el.closeSettings.addEventListener("click", () => closeDrawer(el.settingsOverlay));
el.settingsOverlay.addEventListener("click", (e) => { if (e.target === el.settingsOverlay) closeDrawer(el.settingsOverlay); });

el.leaderboardBtn.addEventListener("click", () => { openDrawer(el.leaderboardOverlay); renderLeaderboardTab(); });
el.closeLeaderboard.addEventListener("click", () => closeDrawer(el.leaderboardOverlay));
el.leaderboardOverlay.addEventListener("click", (e) => { if (e.target === el.leaderboardOverlay) closeDrawer(el.leaderboardOverlay); });

el.helpBtn.addEventListener("click", () => { el.howToOverlay.hidden = false; });
el.closeHowTo.addEventListener("click", () => { el.howToOverlay.hidden = true; });
el.closeHowTo2.addEventListener("click", () => { el.howToOverlay.hidden = true; });
el.howToOverlay.addEventListener("click", (e) => { if (e.target === el.howToOverlay) el.howToOverlay.hidden = true; });

el.modePickerBtn.addEventListener("click", () => { el.modePickerOverlay.hidden = false; });
el.modePickerOverlay.addEventListener("click", (e) => { if (e.target === el.modePickerOverlay) el.modePickerOverlay.hidden = true; });
document.querySelectorAll(".pickerOption").forEach((btn) => {
  btn.addEventListener("click", () => {
    stagedMode = btn.dataset.mode;
    updateModePickerLabel();
    updateConnectButtons();
    el.modePickerOverlay.hidden = true;
  });
});

let activeLeaderboardTab = "round";
el.tabThisRound.addEventListener("click", () => { activeLeaderboardTab = "round"; renderLeaderboardTab(); });
el.tabAllTime.addEventListener("click", () => { activeLeaderboardTab = "total"; renderLeaderboardTab(); });

// ------------------------------------------------------------
// Socket.IO (namespace /twistle - see server/twistle/twistle.js)
// ------------------------------------------------------------
let lastState = null;
const socket = io("/twistle");

socket.on("connect", () => setMiniStatus("Connected to game server."));
socket.on("disconnect", () => setMiniStatus("Reconnecting to game server…"));
socket.on("state", (payload) => render(payload));

function setMiniStatus(text) { el.miniStatus.textContent = text; }

function doConnect(usernameInput) {
  const username = usernameInput.value.trim();
  if (!username) { setMiniStatus("Type a TikTok username first."); return; }
  // If Live was only just picked in the Mode dropdown (not saved yet), switch the
  // game to Live right now so Connect works immediately - no "Save/Apply, reopen
  // Settings, then connect" detour. Messages on one socket arrive in order, so the
  // server is already in Live mode by the time it sees the connect request.
  const serverIsLive = lastState && lastState.game && lastState.game.mode === "live";
  if (!serverIsLive && stagedMode === "live") {
    socket.emit("host:applySettings", { mode: "live" });
  }
  socket.emit("host:connectTikTok", { username });
}
el.connectBtn.addEventListener("click", () => doConnect(el.tiktokUsername));
el.connectBtnBottom.addEventListener("click", () => doConnect(el.tiktokUsernameBottom));
el.disconnectBtn.addEventListener("click", () => socket.emit("host:disconnectTikTok"));

el.applyBtn.addEventListener("click", () => {
  socket.emit("host:applySettings", {
    mode: stagedMode,
    wordLength: Number(el.wordLengthSelect.value),
    difficulty: el.difficultySelect.value,
    lengthMode: el.randomLengthToggle.checked ? "random" : "fixed",
    lengthMin: Number(el.lengthMinSelect.value),
    lengthMax: Number(el.lengthMaxSelect.value),
    autoContinue: el.autoContinueToggle.checked,
    autoContinueDelaySeconds: Number(el.delayInput.value) || 3
  });
  closeDrawer(el.settingsOverlay);
});

// These three apply immediately, without restarting the round (unlike
// the rest of Settings, bundled behind "Apply & start new round" above).
el.revealShowInput.addEventListener("change", () => {
  socket.emit("host:setRevealShowSeconds", { seconds: Number(el.revealShowInput.value) || 4 });
});
el.leaderboardShowInput.addEventListener("change", () => {
  socket.emit("host:setLeaderboardShowSeconds", { seconds: Number(el.leaderboardShowInput.value) || 3 });
});
// Strict fit applies immediately, without restarting the round.
// Starter word: ON by default, remembered by the server, used from the next round.
if (el.starterWordToggle) el.starterWordToggle.addEventListener("change", () => {
  socket.emit("host:setStarterWord", { on: el.starterWordToggle.checked });
});
if (el.strictFitToggle) el.strictFitToggle.addEventListener("change", () => {
  socket.emit("host:setStrictFit", { on: el.strictFitToggle.checked });
});
el.rejectionToastShowInput.addEventListener("change", () => {
  socket.emit("host:setRejectionToastSeconds", { seconds: Number(el.rejectionToastShowInput.value) || 4 });
});

el.playAgainBtn.addEventListener("click", () => socket.emit("host:playAgain"));
el.revealBtn.addEventListener("click", () => socket.emit("host:revealAnswer"));
el.hintBtn.addEventListener("click", () => socket.emit("host:useHint"));

el.resetRoundBtn.addEventListener("click", () => socket.emit("host:resetRoundLeaderboard"));
el.resetTotalBtn.addEventListener("click", () => socket.emit("host:resetTotalLeaderboard"));

let pendingSetAnswerSource = null;
function submitSetAnswer(source, inputEl) {
  const word = inputEl.value.trim();
  if (!word) return;
  pendingSetAnswerSource = source;
  socket.emit("host:setSecretWord", { word }, handleSetAnswerResult);
}
el.setAnswerBtnLive.addEventListener("click", () => submitSetAnswer("live", el.setAnswerInputLive));
el.setAnswerInputLive.addEventListener("keydown", (e) => { if (e.key === "Enter") submitSetAnswer("live", el.setAnswerInputLive); });
el.setAnswerBtnTest.addEventListener("click", () => submitSetAnswer("test", el.setAnswerInputTest));
el.setAnswerInputTest.addEventListener("keydown", (e) => { if (e.key === "Enter") submitSetAnswer("test", el.setAnswerInputTest); });

function handleSetAnswerResult(result) {
  const errorEl = pendingSetAnswerSource === "test" ? el.setAnswerErrorTest : el.setAnswerErrorLive;
  const inputEl = pendingSetAnswerSource === "test" ? el.setAnswerInputTest : el.setAnswerInputLive;
  if (result && result.ok) {
    errorEl.textContent = "";
    inputEl.value = "";
  } else {
    errorEl.textContent = (result && result.error) || "Couldn't set that word.";
  }
}

function submitOfflineGuess() {
  const word = el.offlineGuessInput.value.trim();
  if (!word) return;
  socket.emit("host:offlineGuess", { word }, handleOfflineGuessResult);
}
el.offlineGuessBtn.addEventListener("click", submitOfflineGuess);
el.offlineGuessInput.addEventListener("keydown", (e) => { if (e.key === "Enter") submitOfflineGuess(); });

function handleOfflineGuessResult(result) {
  if (result && result.ok) {
    el.offlineError.textContent = "";
    el.offlineGuessInput.value = "";
  } else {
    el.offlineError.textContent = (result && result.error) || "That guess didn't work.";
  }
}

// ------------------------------------------------------------
// Rejection toast - brief but readable, auto-dismissing.
// ------------------------------------------------------------
let lastShownRejectionAt = 0;
let rejectionHideTimer = null;
function maybeShowRejection(g) {
  if (!g.lastRejection || g.lastRejection.at <= lastShownRejectionAt) return;
  lastShownRejectionAt = g.lastRejection.at;

  const seconds = g.rejectionToastSeconds || 4;

  el.rejectionToast.textContent = "✗ " + g.lastRejection.word.toUpperCase() + " — " + g.lastRejection.reason;
  el.rejectionToast.hidden = false;
  el.rejectionToast.style.animation = "none";
  void el.rejectionToast.offsetWidth;
  el.rejectionToast.style.animation = "toast-flash " + seconds + "s ease forwards";

  clearTimeout(rejectionHideTimer);
  rejectionHideTimer = setTimeout(() => { el.rejectionToast.hidden = true; }, seconds * 1000);
}

// ------------------------------------------------------------
// Avatars - same deterministic "colored circle + initial" fallback
// convention used platform-wide, shown whenever a real TikTok photo
// isn't available.
// ------------------------------------------------------------
const AVATAR_PALETTE = ["#ff5f9e", "#4fa0c4", "#35e6ab", "#ffcb47", "#8f6bff", "#ff8a2b", "#3aa6a6", "#c4577a"];
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
function avatarColorFor(username) { return AVATAR_PALETTE[hashString(username || "?") % AVATAR_PALETTE.length]; }
function avatarInitial(username) { const c = String(username || "").trim(); return c ? c[0].toUpperCase() : "?"; }

function buildAvatarNode(username, avatarUrl, sizePx, className) {
  const wrap = document.createElement("div");
  wrap.className = className || "rowAvatar";
  wrap.style.width = sizePx + "px";
  wrap.style.height = sizePx + "px";
  wrap.style.fontSize = Math.round(sizePx * 0.46) + "px";
  wrap.title = username || "Unknown viewer";

  function showFallback() {
    wrap.innerHTML = "";
    wrap.style.background = avatarColorFor(username);
    wrap.textContent = avatarInitial(username);
  }
  if (avatarUrl) {
    const img = document.createElement("img");
    img.className = "avatarImg";
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.onerror = showFallback;
    img.src = avatarUrl;
    wrap.appendChild(img);
  } else {
    showFallback();
  }
  return wrap;
}

function avatarChipHtml(username, avatarUrl, sizePx) {
  sizePx = sizePx || 22;
  const initial = escapeHtml(avatarInitial(username));
  const color = avatarColorFor(username);
  const title = escapeHtml(username || "Unknown viewer");
  if (avatarUrl) {
    return (
      '<span class="lbAvatar" style="width:' + sizePx + "px;height:" + sizePx + 'px;" title="' + title + '">' +
      '<img class="avatarImg" alt="" referrerpolicy="no-referrer" src="' + escapeHtml(avatarUrl) + '" ' +
      "onerror=\"this.parentElement.classList.add('lbAvatarFallback');this.parentElement.style.background='" + color + "';this.replaceWith('" + initial + "')\" />" +
      "</span>"
    );
  }
  return (
    '<span class="lbAvatar lbAvatarFallback" style="width:' + sizePx + "px;height:" + sizePx + "px;background:" + color + ';" title="' + title + '">' +
    initial +
    "</span>"
  );
}

// ------------------------------------------------------------
// Win celebration: confetti + winner callout + auto-popup leaderboard
// (same 3-stage sequence and timing as BLINDLE's)
// ------------------------------------------------------------
const CONFETTI_COLORS = ["#ff5f9e", "#ffcb47", "#35e6ab", "#8f6bff", "#f5f5fc"];
function spawnConfetti() {
  const count = 70;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("div");
    piece.className = "confettiPiece";
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    const duration = 1.6 + Math.random() * 1.3;
    piece.style.animationDuration = duration + "s";
    piece.style.animationDelay = (Math.random() * 0.3) + "s";
    el.confettiLayer.appendChild(piece);
    setTimeout(() => piece.remove(), (duration + 0.6) * 1000);
  }
}

let celebrationTimer = null;
let celebrationStage = 0;
const CELEBRATION_STAGES = ["winner", "round", "total"];

function renderCelebBoard(list) {
  if (!list || list.length === 0) return '<li class="empty">No scores yet</li>';
  return list
    .map((row, i) =>
      '<li><span class="rank">#' + (i + 1) + '</span>' + avatarChipHtml(row.username, row.avatarUrl, 22) + '<span class="lbName">' + escapeHtml(row.username) + '</span><span class="lbScore">' + row.score + "</span></li>"
    )
    .join("");
}

function showCelebrationStage(stageIndex, g) {
  const stage = CELEBRATION_STAGES[stageIndex];
  el.celebrationDots.querySelectorAll(".celebDot").forEach((dot) => {
    dot.classList.toggle("active", Number(dot.dataset.stage) === stageIndex);
  });

  if (stage === "winner") {
    const info = g.lastWinInfo;
    const winnerName = (info && info.username) || "Someone";
    const winnerAvatar = info && info.avatarUrl;
    const word = ((info && info.word) || "").toUpperCase();
    const pointsLine = info && typeof info.points === "number" ? '<div class="celebPoints">+' + info.points + " points</div>" : "";
    el.celebrationBody.innerHTML =
      '<div class="celebLabel">🌀 Winner</div>' +
      '<div class="celebWinnerRow">' + avatarChipHtml(winnerName, winnerAvatar, 34) + "<span>" + escapeHtml(winnerName) + "</span></div>" +
      '<div class="celebAnswerRow">' + escapeHtml(word) + "</div>" +
      pointsLine;
  } else if (stage === "round") {
    el.celebrationBody.innerHTML =
      '<div class="celebBoardTitle">🏆 Top scorers this round</div>' +
      '<ul class="celebBoardList">' + renderCelebBoard(lastState ? lastState.roundLeaderboard : []) + "</ul>";
  } else {
    el.celebrationBody.innerHTML =
      '<div class="celebBoardTitle">👑 All-time top scorers</div>' +
      '<ul class="celebBoardList">' + renderCelebBoard(lastState ? lastState.totalLeaderboard : []) + "</ul>";
  }
}

function hideCelebration() {
  clearTimeout(celebrationTimer);
  el.celebrationOverlay.hidden = true;
}

function advanceCelebration(g) {
  celebrationStage += 1;
  if (celebrationStage >= CELEBRATION_STAGES.length) {
    hideCelebration();
    return;
  }
  showCelebrationStage(celebrationStage, g);
  const seconds = g.leaderboardShowSeconds || 3;
  celebrationTimer = setTimeout(() => advanceCelebration(g), seconds * 1000);
}

function triggerWinCelebration(g) {
  spawnConfetti();
  celebrationStage = 0;
  el.celebrationOverlay.hidden = false;
  showCelebrationStage(0, g);
  const seconds = g.leaderboardShowSeconds || 3;
  clearTimeout(celebrationTimer);
  celebrationTimer = setTimeout(() => advanceCelebration(g), seconds * 1000);
}

el.closeCelebration.addEventListener("click", hideCelebration);
el.celebrationOverlay.addEventListener("click", (e) => { if (e.target === el.celebrationOverlay) hideCelebration(); });

let wasWon = false;
function detectWinTransition(g) {
  const isWon = g.status === "won";
  if (isWon && !wasWon) triggerWinCelebration(g);
  wasWon = isWon;
}

// ------------------------------------------------------------
// Adaptive board layout. The guess row's letters and its symbols
// ALWAYS sit side by side on one single line - this never stacks them,
// no matter how long the word is. As a word gets longer, or the
// screen gets narrower, the shared tile/symbol size just shrinks to
// fit (down to a small legible floor); if an extremely long word still
// wouldn't fit even at that floor on a narrow screen, the row scrolls
// horizontally within its own bounds (see .guessRow's overflow-x in
// style.css) instead of wrapping or spilling out of the game section.
// ------------------------------------------------------------
const MIN_CELL = 12; // absolute floor - small but still legible/tappable
const CELL_CAP = 72;
const SIDE_GAP = 16; // gap between the letters block and the symbols block (--sp)
const AVATAR_RESERVE = 34; // the row's avatar chip (26px) + its 8px gap to the tiles
const px = (n) => Math.floor(n * 10) / 10;

function fitLine(n, W, cap, gap) {
  // Still used for the post-round revealed-answer tiles (letters only,
  // no symbols row alongside them) - that element is free to wrap
  // across a couple of lines since there's nothing it needs to stay
  // aligned with on the same row.
  let lines = 1, cols = n, cell;
  for (;;) {
    cols = Math.ceil(n / lines);
    cell = (W - (cols - 1) * gap) / cols;
    if (cell >= 30 || cols <= 3 || lines >= 8) break;
    lines++;
  }
  return { cell: px(Math.max(14, Math.min(cap, cell))), cols };
}

function computeLayout(n, W) {
  const usable = Math.max(60, W - AVATAR_RESERVE);
  // update 39: with "Auto-resize tiles" switched off, a word longer than 15 letters keeps the 15-letter size
  // (the row then scrolls sideways) instead of shrinking; `n` stays the real length for the column count.
  const nFit = window.TileFit ? window.TileFit.fitLength(n) : n;
  let gap = 4;
  let side = (usable - SIDE_GAP - (2 * nFit - 2) * gap) / (2 * nFit);
  if (side >= 44) {
    gap = 6;
    side = (usable - SIDE_GAP - (2 * nFit - 2) * gap) / (2 * nFit);
  }
  const cell = px(Math.max(MIN_CELL, Math.min(CELL_CAP, side)));
  return { cell, cols: n, gap };
}

let layoutN = 5;
function applyLayout(n) {
  if (n) layoutN = n;
  const W = el.grid.clientWidth;
  if (W < 120) return;
  const L = computeLayout(layoutN, W);
  el.grid.style.setProperty("--cell", L.cell + "px");
  el.grid.style.setProperty("--cols", L.cols);
  el.grid.style.setProperty("--gap", L.gap + "px");
  const A = fitLine(layoutN, W, 60, 5);
  el.answerTiles.style.setProperty("--cell", A.cell + "px");
  el.answerTiles.style.setProperty("--cols", A.cols);
  applyKeyMetrics(L.cell);
}
if (window.ResizeObserver) new ResizeObserver(() => applyLayout()).observe(el.grid);
window.addEventListener("resize", () => applyLayout());

function stateColors(state, legend) {
  if (state === "absent") return { border: "#2b2e5c", bg: "#0b0c1e" };
  return { border: "var(--mint)", bg: "rgba(53, 230, 171, 0.2)" };
}

let lastGridSig = "";
let lastGridRound = null;
let lastRowCount = 0;

function renderGrid(g) {
  const rows = g.rows || [];
  const sig = [g.roundNumber, g.status, rows.map((r) => r.word + (r.states ? "*" : "") + (r.avatarUrl ? "@" + r.avatarUrl : "")).join(",")].join("|");
  if (sig === lastGridSig) return;
  lastGridSig = sig;

  const firstRender = lastGridRound === null;
  const sameRound = lastGridRound === g.roundNumber;
  const prevCount = sameRound ? lastRowCount : rows.length;
  lastGridRound = g.roundNumber;
  lastRowCount = rows.length;

  el.grid.innerHTML = "";
  if (!rows.length) return;

  rows.forEach((row, r) => {
    const n = row.word.length;
    const step = Math.min(90, Math.floor(1400 / n));
    const isNew = r >= prevCount;

    const rowEl = document.createElement("div");
    rowEl.className = "guessRow";

    rowEl.appendChild(buildAvatarNode(row.caller, row.avatarUrl, 26, "rowAvatar"));

    const growEl = document.createElement("div");
    growEl.className = "grow" + (isNew ? " new" : "");
    const letsEl = document.createElement("div");
    letsEl.className = "lets";
    const symsEl = document.createElement("div");
    symsEl.className = "syms";

    for (let i = 0; i < n; i++) {
      const letter = row.word[i];
      const tile = document.createElement("div");
      tile.className = "tile filled";
      tile.style.setProperty("--i", i);
      tile.textContent = letter;
      if (row.states) {
        const col = stateColors(row.states[i], g.legend);
        tile.classList.add("flip");
        tile.style.setProperty("--d", i * step + "ms");
        tile.style.setProperty("--to-border", col.border);
        tile.style.setProperty("--to-bg", col.bg);
      } else {
        // Real colors are hidden until the round is revealed - until
        // then, a tile's letter can be clicked as a manual deduction
        // aid, same as BLINDLE's tiles (stays in sync with the
        // keyboard above since both key off the same letter map).
        const manual = manualLetterColors[letter];
        if (manual) tile.classList.add(manual);
        tile.addEventListener("click", () => cycleTileColor(letter));
      }
      letsEl.appendChild(tile);

      const sym = document.createElement("div");
      sym.className = "sym";
      sym.style.setProperty("--i", i);
      sym.innerHTML = TwistleSymbols.svg(row.symbols[i]);
      symsEl.appendChild(sym);
    }
    growEl.appendChild(letsEl);
    growEl.appendChild(symsEl);
    rowEl.appendChild(growEl);
    el.grid.appendChild(rowEl);
  });

  if (rows.length > prevCount || (firstRender && rows.length)) {
    requestAnimationFrame(() => el.grid.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  }
}

function renderHintChips(g) {
  const hasHints = g.hintSuggestions && g.hintSuggestions.length > 0;
  el.hintExplainer.hidden = !hasHints;
  el.hintChips.innerHTML = hasHints
    ? g.hintSuggestions.map((word) => '<span class="hintChip">Try: ' + escapeHtml(word.toUpperCase()) + "</span>").join("")
    : "";
}

function renderHintLine(g) {
  if (g.status === "idle") {
    el.hintLine.innerHTML = 'Tap <strong>Settings</strong> (⚙️) to choose a mode, word length, and difficulty, then <strong>Apply</strong> to begin.';
    return;
  }
  if (g.status !== "live") { el.hintLine.innerHTML = ""; return; }
  const n = g.wordLength;
  el.hintLine.innerHTML = g.guessesMade === 0
    ? `Type a <strong>${n}-letter word</strong> in chat — a valid one goes straight onto the board. Type the <strong>secret word</strong> to win!`
    : "";
}

const CONCEPT_TEXT = { correct: "Right spot", misplaced: "Wrong spot", absent: "Not in your guess" };
const REASON_TEXT = { revealed: "The host revealed the answer.", guessed: "Solved!" };

function renderBanners(g) {
  el.idleBanner.hidden = g.status !== "idle";
  el.resultBanner.hidden = g.status !== "won" && g.status !== "lost";

  if (g.status === "won" || g.status === "lost") {
    el.resultBanner.className = "resultBanner " + (g.status === "won" ? "win" : "lost");
    if (g.status === "won" && g.lastWinInfo && g.lastWinInfo.username) {
      const pointsPart = typeof g.lastWinInfo.points === "number" ? " — +" + g.lastWinInfo.points + " points" : "";
      el.resultText.textContent = "🎉 " + g.lastWinInfo.username + ' solved it! "' + (g.secretWord || "").toUpperCase() + '"' + pointsPart;
    } else if (g.status === "won") {
      el.resultText.textContent = '🎉 Solved it! The word was "' + (g.secretWord || "").toUpperCase() + '".';
    } else {
      el.resultText.textContent = '⏱ Round ended. The word was "' + (g.secretWord || "").toUpperCase() + '".';
    }

    el.answerTiles.innerHTML = (g.secretWord || "").split("").map((ch) => `<div class="tile">${escapeHtml(ch)}</div>`).join("");
    el.legendRow.innerHTML = g.legend
      ? ["correct", "misplaced", "absent"].map((c) =>
          '<span class="legendChip"><span class="sym">' + TwistleSymbols.svg(g.legend[c]) + "</span>" + CONCEPT_TEXT[c] + "</span>"
        ).join("")
      : "";
  }

  if ((g.status === "won" || g.status === "lost") && g.autoContinue) {
    el.autoContinueNote.hidden = false;
    el.autoContinueNote.textContent = "Auto-continuing in " + g.autoContinueSecondsLeft + "s…";
  } else {
    el.autoContinueNote.hidden = true;
  }
}

function renderModeUI(g) {
  el.liveControls.hidden = g.mode !== "live";
  el.testControls.hidden = g.mode !== "test";
  el.offlineControls.hidden = g.mode !== "offline";
  el.offlineNote.hidden = !(g.status === "live" && g.mode === "offline");
}

function renderHeader(state) {
  const connStatus = (state.diagnostics.connection && state.diagnostics.connection.state) || "idle";
  el.brandDot.className = "brandDot " + (state.game.mode === "test" ? "test_mode" : connStatus === "connected" ? "live" : connStatus);
  el.modeBadge.textContent = state.game.mode.toUpperCase();
  el.modeBadge.className = "modeBadge " + state.game.mode;
  el.lengthBadge.textContent = state.game.status === "idle" ? "— letters" : state.game.wordLength + " letters";
  el.hintBtn.disabled = state.game.status !== "live";

  if (state.game.status === "idle") {
    el.roundLabel.textContent = "TWISTLE";
    el.roundSub.textContent = "waiting to start";
  } else {
    el.roundLabel.textContent = "TWISTLE";
    el.roundSub.textContent = "";
  }
  el.guessBadge.hidden = true;
}

const CONNECTION_LABELS = {
  idle: "Idle", connecting: "Connecting…", reconnecting: "Reconnecting…",
  connected: "LIVE", error: "Connection issue"
};

function renderSettingsChips(state) {
  const g = state.game;
  const modeInfo = MODE_LABELS[g.mode];
  el.modeChip.textContent = "Mode: " + modeInfo.title + " — " + modeInfo.desc;
  el.modeChip.className = "statusChip " + (g.mode === "live" ? "good" : "");

  const connStatus = (state.diagnostics.connection && state.diagnostics.connection.state) || "idle";
  el.connChip.textContent = "TikTok: " + (g.mode === "test" ? "Simulating (Test Mode)" : (CONNECTION_LABELS[connStatus] || connStatus));
  el.connChip.className = "statusChip " + (connStatus === "connected" ? "good" : connStatus === "error" ? "bad" : "");

  updateConnectButtons();
}

// The drawer's Connect button is usable as soon as "Live" is chosen in the Mode
// dropdown (even before Apply/Save); the bottom-bar one only exists in Live mode.
function updateConnectButtons() {
  const serverIsLive = !!(lastState && lastState.game && lastState.game.mode === "live");
  el.connectBtn.disabled = !(serverIsLive || stagedMode === "live");
  el.connectBtnBottom.disabled = !serverIsLive;
}

function statusTone(status) {
  if (status === "connected") return "good";
  if (status === "error") return "bad";
  if (status === "connecting" || status === "reconnecting") return "warn";
  return null;
}

function renderDiagnostics(diag) {
  const dictLabel = diag.dictionaryLoading
    ? "Loading…"
    : diag.dictionaryWordCount.toLocaleString() + " words (" + (diag.dictionarySource === "full" ? "full list" : "fallback list") + ")";
  const dictTone = diag.dictionaryLoading ? "warn" : diag.dictionarySource === "full" ? "good" : "bad";
  const connState = (diag.connection && diag.connection.state) || "idle";
  const connMessage = (diag.connection && diag.connection.message) || "—";
  const lastErr = diag.errors && diag.errors.length ? diag.errors[0].message : "—";

  const rows = [
    ["Chat events received", diag.eventsReceived, "good"],
    ["Recognized as guesses", diag.recognizedCount, null],
    ["Last received", diag.lastReceived ? diag.lastReceived.username + ": " + (diag.lastReceived.text || "(empty)") : "—", null],
    ["Connection status", connMessage, statusTone(connState)],
    ["Signing key set up?", diag.signKeyConfigured ? "Yes" : "No — see setup guide", diag.signKeyConfigured ? "good" : "bad"],
    ["Word dictionary (shared with BLINDLE)", dictLabel, dictTone],
    ["Last error", lastErr, lastErr !== "—" ? "bad" : null]
  ];

  el.diagGrid.innerHTML = rows
    .map(([key, val, tone]) =>
      '<div class="diagRow"><span class="diagKey">' + escapeHtml(key) + '</span><span class="diagVal ' + (tone || "") + '">' + escapeHtml(String(val)) + "</span></div>"
    )
    .join("");
}

function renderLeaderboardTab() {
  el.tabThisRound.classList.toggle("active", activeLeaderboardTab === "round");
  el.tabAllTime.classList.toggle("active", activeLeaderboardTab === "total");
  if (!lastState) return;

  const g = lastState.game;
  const list = activeLeaderboardTab === "round" ? lastState.roundLeaderboard : lastState.totalLeaderboard;

  if (g.mode === "test") {
    el.leaderboardList.innerHTML = "";
    el.leaderboardNote.hidden = false;
    el.leaderboardNote.textContent = "Test Mode scores aren't saved to the leaderboard.";
    return;
  }
  if (g.mode === "offline") {
    el.leaderboardList.innerHTML = "";
    el.leaderboardNote.hidden = false;
    el.leaderboardNote.textContent = "Offline mode is solo — there's no chat leaderboard here.";
    return;
  }

  el.leaderboardNote.hidden = true;
  if (!list || list.length === 0) {
    el.leaderboardList.innerHTML = '<li class="empty">No scores yet — guesses made in Live mode will show up here.</li>';
    return;
  }
  el.leaderboardList.innerHTML = list
    .map((row, i) =>
      '<li><span class="rank">#' + (i + 1) + '</span>' + avatarChipHtml(row.username, row.avatarUrl, 22) + '<span class="lbName">' + escapeHtml(row.username) + '</span><span class="lbScore">' + row.score + "</span></li>"
    )
    .join("");
}

function escapeHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function render(state) {
  lastState = state;
  if (window.ScoreTicker) window.ScoreTicker.update(state); // update 47: scrolling top-scorers ticker
  if (window.WordLanguage) window.WordLanguage.update(state.game, (mode) => socket.emit("host:setWordLanguage", { mode })); // update 48: word language
  detectWinTransition(state.game);
  detectFreshRound(state.game);
  renderHeader(state);
  renderModeUI(state.game);
  applyLayout(state.game.wordLength || 5);
  renderGrid(state.game);
  paintKeyboard();
  renderKeyboardVisibility(state.game);
  renderHintChips(state.game);
  renderHintLine(state.game);
  renderBanners(state.game);
  maybeShowRejection(state.game);
  renderSettingsChips(state);
  renderDiagnostics(state.diagnostics);
  if (!el.leaderboardOverlay.hidden) renderLeaderboardTab();
}

// ------------------------------------------------------------
// How-to-play worked example (SHAKE guessed, THICK is the secret word
// - the same example from the original TWISTLE README).
// ------------------------------------------------------------
(function buildHowToExample() {
  const answer = "thick";
  const guess = "shake";
  const symbolMap = { correct: "heart", misplaced: "star", absent: "cloud" };
  const n = answer.length;
  const states = [];
  const symbols = [];
  const unmatched = {};
  for (let i = 0; i < n; i++) {
    if (guess[i] === answer[i]) { states[i] = "correct"; symbols[i] = "correct"; }
    else { unmatched[answer[i]] = (unmatched[answer[i]] || 0) + 1; symbols[i] = "absent"; states[i] = "absent"; }
  }
  const spare = { ...unmatched };
  for (let i = 0; i < n; i++) {
    if (states[i] === "correct") continue;
    if (spare[guess[i]] > 0) { states[i] = "misplaced"; spare[guess[i]] -= 1; }
  }
  const toMark = {};
  for (const letter of Object.keys(unmatched)) toMark[letter] = unmatched[letter] - spare[letter];
  for (let i = 0; i < n; i++) {
    if (symbols[i] === "correct") continue;
    if (toMark[answer[i]] > 0) { symbols[i] = "misplaced"; toMark[answer[i]] -= 1; }
  }

  let tiles = "", syms = "";
  for (let i = 0; i < n; i++) {
    tiles += `<div class="tile filled">${guess[i].toUpperCase()}</div>`;
    syms += `<div class="sym">${TwistleSymbols.svg(symbolMap[symbols[i]])}</div>`;
  }
  el.howToExample.innerHTML =
    `<p class="sectionNote" style="margin:0">Example: the secret word is <strong>THICK</strong>. Someone guesses <strong>SHAKE</strong>:</p>` +
    `<div class="grow" style="--cols:${n}"><div class="lets" style="grid-template-columns:repeat(${n}, 34px)">${tiles}</div><div class="syms" style="grid-template-columns:repeat(${n}, 34px)">${syms}</div></div>` +
    `<p class="sectionNote" style="margin:0">The 2nd symbol means "right spot" (THICK's 2nd letter, H, is also SHAKE's 2nd letter). The 4th means "wrong spot" (THICK has a K, just not 4th). The rest mean "not in this guess."</p>`;
})();
