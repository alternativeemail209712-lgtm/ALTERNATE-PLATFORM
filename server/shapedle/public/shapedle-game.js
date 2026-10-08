// shapedle-game.js — runs in the browser (host view / display view)

function setRealViewportHeight() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
}
setRealViewportHeight();
window.addEventListener("resize", setRealViewportHeight);
window.addEventListener("resize", () => {
  lastTilesSignature = "";
  if (lastState) renderTiles(lastState.game);
});
window.addEventListener("orientationchange", setRealViewportHeight);
window.addEventListener("orientationchange", () => {
  lastTilesSignature = "";
  if (lastState) renderTiles(lastState.game);
});

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

  tilesWrap: document.getElementById("tilesWrap"),
  hintChips: document.getElementById("hintChips"),
  hintExplainer: document.getElementById("hintExplainer"),
  offlineNote: document.getElementById("offlineNote"),
  resultBanner: document.getElementById("resultBanner"),
  resultText: document.getElementById("resultText"),
  playAgainBtn: document.getElementById("playAgainBtn"),
  autoContinueNote: document.getElementById("autoContinueNote"),
  idleBanner: document.getElementById("idleBanner"),
  keyboardSection: document.getElementById("keyboardSection"),
  symbolSection: document.getElementById("symbolSection"),
  symbolRow: document.getElementById("symbolRow"),
  starterWordToggle: document.getElementById("starterWordToggle"),
  symbolPackList: document.getElementById("symbolPackList"),
  symSetsAll: document.getElementById("symSetsAll"),
  symSetsNone: document.getElementById("symSetsNone"),
  symIntensity: document.getElementById("symIntensity"),
  symBrightness: document.getElementById("symBrightness"),
  symSize: document.getElementById("symSize"),
  symRingToggle: document.getElementById("symRingToggle"),
  symAnimToggle: document.getElementById("symAnimToggle"),
  symAnimStyle: document.getElementById("symAnimStyle"),
  symAnimSpeed: document.getElementById("symAnimSpeed"),
  symPreview: document.getElementById("symPreview"),
  symViewersFirstToggle: document.getElementById("symViewersFirstToggle"),
  viewerSummary: document.getElementById("viewerSummary"),
  viewerSearch: document.getElementById("viewerSearch"),
  viewerList: document.getElementById("viewerList"),
  viewerTickAll: document.getElementById("viewerTickAll"),
  viewerUntickAll: document.getElementById("viewerUntickAll"),
  viewerForgetAll: document.getElementById("viewerForgetAll"),
  viewerAllowRemoved: document.getElementById("viewerAllowRemoved"),
  symViewersAutoToggle: document.getElementById("symViewersAutoToggle"),
  keyboard: document.getElementById("keyboard"),

  controls: document.getElementById("controls"),
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
  giveUpBtn: document.getElementById("giveUpBtn"),
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
  leaderboardShowInput: document.getElementById("leaderboardShowInput"),
  rejectionToastShowInput: document.getElementById("rejectionToastShowInput"),
  strictFitToggle: document.getElementById("strictFitToggle"),
  keyAutoColorToggle: document.getElementById("keyAutoColorToggle"),
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
  closeHowTo: document.getElementById("closeHowTo"),
  closeHowTo2: document.getElementById("closeHowTo2")
};

const MODE_LABELS = {
  live: { title: "Live", desc: "Counts for the chat leaderboard" },
  test: { title: "Test", desc: "Practice — scores not saved" },
  offline: { title: "Offline", desc: "Host plays solo" }
};

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
    lastTilesSignature = "";
    if (lastState) renderTiles(lastState.game);
  });
});

// ------------------------------------------------------------
// Keyboard: A-Z in two rows of 13. It is NOT a manual scratchpad - nothing is clickable. Every key
// colors itself with the best color its letter has earned in ANY guess this round (the server
// works it out over every guess and sends it as `letterStates`):
//   0 green, 1 yellow, 2 gray   (priority green > yellow > gray, decided by the server)
// ------------------------------------------------------------
function paintKeyboard() {
  // Host switched "Auto-color keyboard keys" off: keep every key plain.
  if (lastState && lastState.game && lastState.game.keyAutoColor === false) {
    el.keyboard.querySelectorAll(".key").forEach((key) => { key.className = "key"; });
    return;
  }
  const states = (lastState && lastState.game && lastState.game.letterStates) || {};
  el.keyboard.querySelectorAll(".key").forEach((key) => {
    const st = states[key.dataset.letter];
    key.className = "key" + (st === undefined ? "" : " sp" + st);
  });
}

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
    rowEl.appendChild(key);
  }
  el.keyboard.appendChild(rowEl);
}
// The keyboard is 13 keys per row and lives in its own section - it sizes itself to ITS OWN width.
function computeKeyboardMetrics() {
  const pageWidth = (document.documentElement && document.documentElement.clientWidth) || window.innerWidth || 380;
  const sectionPad = 22; // keyboardSection side padding + border
  const containerWidth =
    el.keyboard.clientWidth ||
    (el.keyboardSection.clientWidth ? el.keyboardSection.clientWidth - sectionPad : 0) ||
    (el.tilesWrap && el.tilesWrap.clientWidth) ||
    Math.max(200, pageWidth - 32 - sectionPad);
  const columns = 13;
  const gap = 4;
  const sizeByWidth = Math.floor((containerWidth - gap * (columns - 1)) / columns);
  const size = Math.max(10, Math.min(30, sizeByWidth));
  const height = Math.round(size * 1.1);
  const fontSize = Math.max(8, Math.round(size * 0.46));
  return { size, height, fontSize, gap };
}

function applyKeyMetrics() {
  const km = computeKeyboardMetrics();
  el.keyboard.querySelectorAll(".keyRow").forEach((row) => {
    row.style.gap = km.gap + "px";
  });
  el.keyboard.querySelectorAll(".key").forEach((key) => {
    key.style.width = km.size + "px";
    key.style.height = km.height + "px";
    key.style.fontSize = km.fontSize + "px";
  });
}

// Re-size the keys whenever the keyboard's real width changes (window resize,
// section shown after being hidden, etc.) - not only when tiles re-render.
if (typeof ResizeObserver !== "undefined") {
  new ResizeObserver(() => applyKeyMetrics()).observe(el.keyboardSection);
}
window.addEventListener("resize", () => applyKeyMetrics());
applyKeyMetrics();

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
// Keep "from" <= "to" so the range is never inverted.
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
  el.leaderboardShowInput.value = g.leaderboardShowSeconds;
  el.rejectionToastShowInput.value = g.rejectionToastSeconds;
  el.strictFitToggle.checked = g.strictFit !== false; // Strict fit is ON unless the host switched it off
  if (el.keyAutoColorToggle) el.keyAutoColorToggle.checked = g.keyAutoColor !== false; // ON unless the host switched it off
  el.starterWordToggle.checked = g.starterWord !== false;
  syncSymbolSettings(g);
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

// The board is sized from the space left above the host-controls bar, so re-fit it whenever that bar
// opens, collapses or changes height.
let lastControlsHeight = 0;
if (typeof ResizeObserver !== "undefined" && el.controls) {
  new ResizeObserver(() => {
    const h = Math.round(el.controls.getBoundingClientRect().height);
    if (Math.abs(h - lastControlsHeight) < 3) return;
    lastControlsHeight = h;
    lastTilesSignature = "";
    if (lastState) renderTiles(lastState.game);
  }).observe(el.controls);
}

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

let socket = null;
let lastState = null;

// SHAPEDLE talks to the server over its own Socket.IO namespace "/shapedle"
// (Socket.IO reconnects automatically, so no manual retry loop is needed).
function connectSocket() {
  socket = io("/shapedle");

  socket.on("connect", () => setMiniStatus("Connected to game server."));
  socket.on("disconnect", () => setMiniStatus("Reconnecting to game server…"));
  socket.on("connect_error", () => setMiniStatus("Reconnecting to game server…"));

  socket.on("state", (payload) => {
    try { render(payload); } catch (err) { console.error("Couldn't render server state:", err); }
  });
  socket.on("viewer_roster", (payload) => { try { onViewerRoster(payload); } catch (err) { console.error("Couldn't show the audience list:", err); } });
  socket.on("viewer_roster_dirty", () => requestViewerRoster());
  socket.on("connect", () => requestViewerRoster());
  socket.on("offline_guess_result", (payload) => handleOfflineGuessResult(payload));
  socket.on("set_secret_word_result", (payload) => handleSetAnswerResult(payload));
}
connectSocket();

function send(type, payload) {
  if (socket && socket.connected) {
    socket.emit("action", { type: type, payload: payload });
  } else {
    setMiniStatus("Not connected to the game server yet — try again in a moment.");
  }
}
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
    send("apply_settings", { mode: "live" });
  }
  send("connect_tiktok", { username: username });
}
el.connectBtn.addEventListener("click", () => doConnect(el.tiktokUsername));
el.connectBtnBottom.addEventListener("click", () => doConnect(el.tiktokUsernameBottom));
el.disconnectBtn.addEventListener("click", () => send("disconnect_tiktok", {}));

el.applyBtn.addEventListener("click", () => {
  send("apply_settings", {
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

// Leaderboard-show duration applies immediately, without restarting
// the round (unlike the rest of Settings, which is bundled behind
// the "Apply & start new round" button above).
el.leaderboardShowInput.addEventListener("change", () => {
  send("set_leaderboard_show_seconds", { seconds: Number(el.leaderboardShowInput.value) || 3 });
});

// Same immediate-apply pattern for how long a rejection message stays
// on screen - no need to restart the round for this one either.
el.rejectionToastShowInput.addEventListener("change", () => {
  send("set_rejection_toast_seconds", { seconds: Number(el.rejectionToastShowInput.value) || 4 });
});

// Strict fit applies immediately, without restarting the round.
el.strictFitToggle.addEventListener("change", () => {
  send("set_strict_fit", { on: el.strictFitToggle.checked });
});

// Keyboard auto-color applies immediately; ON by default, the host's choice is remembered by the server.
if (el.keyAutoColorToggle) el.keyAutoColorToggle.addEventListener("change", () => {
  send("set_key_autocolor", { on: el.keyAutoColorToggle.checked });
});

// ---- Symbols settings (Settings -> Symbols), update 29 -----------------------------------------------
// Sets to use (several can be ticked), how they combine, look, motion, and the audience's profile pictures.
// Every change is sent to the server (which remembers it) and comes back to every screen in the next state.
const VIEWERS_SET_ID = "viewers";
const SYMBOL_SET_CHOICES = (window.ShapedleSymbols ? window.ShapedleSymbols.PACKS : []).concat([
  { id: VIEWERS_SET_ID, name: "Audience profile pictures", hint: "Round TikTok pictures of the viewers you pick below" }
]);
let symOpts = null;          // the options last received from the server
let viewerRoster = [];       // the saved audience list (loaded when asked for)
let viewerCountsSig = "";

function sendSymbolOptions(partial) {
  send("set_symbol_options", partial);
  if (symOpts) { symOpts = Object.assign({}, symOpts, partial); applySymbolLook(symOpts); updateSymbolSettingsLabels(); }
}

function buildSymbolPackPicker() {
  if (!el.symbolPackList) return;
  el.symbolPackList.innerHTML = "";
  SYMBOL_SET_CHOICES.forEach((pack) => {
    const row = document.createElement("label");
    row.className = "packBtn";
    row.dataset.pack = pack.id;
    const box = document.createElement("input");
    box.type = "checkbox";
    box.addEventListener("change", () => {
      const now = new Set((symOpts && symOpts.enabledSets) || ["cute"]);
      if (box.checked) now.add(pack.id); else now.delete(pack.id);
      if (now.size === 0) { box.checked = true; setMiniStatus("Keep at least one symbol set ticked."); return; }
      const ordered = SYMBOL_SET_CHOICES.map((c) => c.id).filter((id) => now.has(id));
      sendSymbolOptions({ enabledSets: ordered });
      syncSymbolPackPicker(ordered);
    });
    const preview = document.createElement("span");
    preview.className = "packPreview";
    if (window.ShapedleSymbols) {
      preview.innerHTML = pack.id === VIEWERS_SET_ID
        ? [0, 1, 2].map((i) => '<span class="packSym"><span class="symAvatar symAvatarFallback" style="background:' + ["#e0679c", "#4a9bd8", "#e0a912"][i] + '">' + "ABC"[i] + "</span></span>").join("")
        : [0, 4, 8].map((sl) => '<span class="packSym">' + window.ShapedleSymbols.html(pack.id, sl) + "</span>").join("");
    }
    const label = document.createElement("span");
    label.className = "packLabel";
    label.innerHTML = "<b>" + pack.name + "</b><small>" + pack.hint + "</small>";
    row.appendChild(box);
    row.appendChild(preview);
    row.appendChild(label);
    el.symbolPackList.appendChild(row);
  });
}
function syncSymbolPackPicker(enabled) {
  if (!el.symbolPackList) return;
  const on = new Set(enabled || []);
  el.symbolPackList.querySelectorAll(".packBtn").forEach((row) => {
    const checked = on.has(row.dataset.pack);
    row.classList.toggle("on", checked);
    const box = row.querySelector("input");
    if (box) box.checked = checked;
  });
}
buildSymbolPackPicker();

function updateSymbolSettingsLabels() {
  if (!symOpts) return;
  const out = (id, v) => { const o = document.getElementById(id); if (o) o.textContent = v; };
  out("symIntensityOut", symOpts.colorIntensity + "%");
  out("symBrightnessOut", symOpts.brightness + "%");
  out("symSizeOut", symOpts.size + "%");
  if (el.symAnimStyle) el.symAnimStyle.disabled = !symOpts.animated;
  if (el.symAnimSpeed) el.symAnimSpeed.disabled = !symOpts.animated;
}

// Look + motion on a container (the board's symbol section and the settings preview).
function applySymbolLook(o, target) {
  const targets = target ? [target] : [el.symbolSection, el.symPreview];
  const dur = { slow: "3.2s", normal: "2s", fast: "1.1s" }[o.animSpeed] || "2s";
  targets.forEach((t) => {
    if (!t) return;
    t.style.setProperty("--sym-sat", String(o.colorIntensity / 100));
    t.style.setProperty("--sym-bright", String(o.brightness / 100));
    t.style.setProperty("--sym-scale", String(o.size / 100));
    t.style.setProperty("--sym-dur", dur);
    t.classList.toggle("symRing", Boolean(o.ring));
    t.classList.toggle("symAnim", Boolean(o.animated));
    ["float", "bounce", "wiggle", "pulse", "wave"].forEach((st) => t.classList.toggle("symAnim-" + st, o.animated && o.animStyle === st));
  });
}

function renderSymbolPreview() {
  if (!el.symPreview || !window.ShapedleSymbols) return;
  const enabled = ((symOpts && symOpts.enabledSets) || ["cute"]).filter((id) => id !== VIEWERS_SET_ID);
  const sets = enabled.length ? enabled : ["cute"];
  const withPics = symOpts && (symOpts.enabledSets.indexOf(VIEWERS_SET_ID) >= 0 || symOpts.viewersAuto !== false);
  const readyPics = viewerRoster.filter((v) => v.sel && v.url).slice(0, 2);
  const viewers = {};
  const ids = [];
  readyPics.forEach((v) => { if (withPics) { ids.push("viewers:" + v.u); viewers["viewers:" + v.u] = { n: v.n, url: v.url }; } });
  let n = 0;
  while (ids.length < 6) { ids.push(sets[n % sets.length] + ":" + (3 + n * 5)); n++; }
  el.symPreview.innerHTML = "";
  ids.forEach((id, i) => el.symPreview.appendChild(makeSymbolCell(id, viewers, i, 44, 46, 34)));
}

function syncSymbolSettings(g) {
  const o = g.symbolOptions;
  if (!o) return;
  symOpts = o;
  syncSymbolPackPicker(o.enabledSets);
  document.querySelectorAll('input[name="symCombine"]').forEach((r) => { r.checked = r.value === o.combine; });
  if (el.symIntensity) el.symIntensity.value = o.colorIntensity;
  if (el.symBrightness) el.symBrightness.value = o.brightness;
  if (el.symSize) el.symSize.value = o.size;
  if (el.symRingToggle) el.symRingToggle.checked = Boolean(o.ring);
  if (el.symAnimToggle) el.symAnimToggle.checked = Boolean(o.animated);
  if (el.symAnimStyle) el.symAnimStyle.value = o.animStyle;
  if (el.symAnimSpeed) el.symAnimSpeed.value = o.animSpeed;
  if (el.symViewersFirstToggle) el.symViewersFirstToggle.checked = o.viewersFirst !== false;
  if (el.symViewersAutoToggle) el.symViewersAutoToggle.checked = o.viewersAuto !== false;
  updateSymbolSettingsLabels();
  applySymbolLook(o);
  renderSymbolPreview();
  const c = g.viewerCounts;
  if (c) {
    const sig = [c.total, c.selected, c.ready, c.readySelected, c.removed || 0].join(",");
    if (sig !== viewerCountsSig) { viewerCountsSig = sig; requestViewerRoster(); }
  }
}

document.querySelectorAll('input[name="symCombine"]').forEach((r) => r.addEventListener("change", () => { if (r.checked) sendSymbolOptions({ combine: r.value }); }));
// sliders: update the preview while dragging, save when released
[["symIntensity", "colorIntensity"], ["symBrightness", "brightness"], ["symSize", "size"]].forEach(([id, key]) => {
  const input = el[id];
  if (!input) return;
  input.addEventListener("input", () => { if (symOpts) { symOpts[key] = Number(input.value); applySymbolLook(symOpts); updateSymbolSettingsLabels(); } });
  input.addEventListener("change", () => sendSymbolOptions({ [key]: Number(input.value) }));
});
el.symRingToggle.addEventListener("change", () => sendSymbolOptions({ ring: el.symRingToggle.checked }));
el.symAnimToggle.addEventListener("change", () => sendSymbolOptions({ animated: el.symAnimToggle.checked }));
el.symAnimStyle.addEventListener("change", () => sendSymbolOptions({ animStyle: el.symAnimStyle.value }));
el.symAnimSpeed.addEventListener("change", () => sendSymbolOptions({ animSpeed: el.symAnimSpeed.value }));
el.symViewersFirstToggle.addEventListener("change", () => sendSymbolOptions({ viewersFirst: el.symViewersFirstToggle.checked }));
if (el.symViewersAutoToggle) el.symViewersAutoToggle.addEventListener("change", () => sendSymbolOptions({ viewersAuto: el.symViewersAutoToggle.checked }));
el.symSetsAll.addEventListener("click", () => { const all = SYMBOL_SET_CHOICES.map((c) => c.id); sendSymbolOptions({ enabledSets: all }); syncSymbolPackPicker(all); });
el.symSetsNone.addEventListener("click", () => {
  const keep = (symOpts && symOpts.enabledSets && symOpts.enabledSets[0]) || "cute"; // at least one stays
  sendSymbolOptions({ enabledSets: [keep] }); syncSymbolPackPicker([keep]);
});

// ---- Audience profile pictures list ----
function requestViewerRoster() { if (socket && socket.connected) send("get_viewer_roster", {}); }
function timeAgo(ms) {
  const m = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return m + " min ago";
  const h = Math.round(m / 60);
  if (h < 48) return h + " h ago";
  return Math.round(h / 24) + " days ago";
}
function onViewerRoster(payload) {
  viewerRoster = (payload && payload.viewers) || [];
  const c = (payload && payload.counts) || { total: viewerRoster.length, selected: 0, ready: 0, readySelected: 0 };
  el.viewerSummary.textContent = c.total + " saved · " + c.ready + " with a picture · " + c.selected + " ticked (" + c.readySelected + " ready to use as symbols)" + (c.removed ? " · " + c.removed + " removed by you" : "");
  if (el.viewerAllowRemoved) { el.viewerAllowRemoved.hidden = !c.removed; el.viewerAllowRemoved.textContent = "Allow removed people again (" + (c.removed || 0) + ")"; }
  renderViewerList();
  renderSymbolPreview();
}
function renderViewerList() {
  const q = (el.viewerSearch.value || "").trim().toLowerCase();
  const rows = viewerRoster.filter((v) => !q || v.u.indexOf(q) >= 0 || String(v.n).toLowerCase().indexOf(q) >= 0);
  el.viewerList.innerHTML = "";
  if (rows.length === 0) {
    const empty = document.createElement("div");
    empty.className = "viewerEmpty";
    empty.textContent = viewerRoster.length ? "Nobody matches that search." : "No one saved yet. Connect to your TikTok LIVE - viewers appear here as they join, chat, like or send gifts.";
    el.viewerList.appendChild(empty);
    return;
  }
  rows.slice(0, 400).forEach((v) => {
    const row = document.createElement("div");
    row.className = "viewerRow";
    row.setAttribute("role", "listitem");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = Boolean(v.sel);
    box.addEventListener("change", () => { v.sel = box.checked; send("set_viewers_selected", { usernames: [v.u], on: box.checked }); });
    const pic = document.createElement(v.url ? "img" : "span");
    pic.className = "viewerPic";
    if (v.url) { pic.src = v.url; pic.alt = ""; pic.loading = "lazy"; } else { pic.textContent = (v.n || v.u).charAt(0).toUpperCase(); pic.style.background = avatarColorFor(v.u); }
    const info = document.createElement("span");
    info.className = "viewerInfo";
    const nameEl = document.createElement("b");
    nameEl.textContent = v.n || v.u;
    const sub = document.createElement("small");
    sub.textContent = "@" + v.u + " · seen " + timeAgo(v.last) + (v.url ? "" : " · picture not saved yet" + (v.why ? " (" + v.why + ", still retrying)" : " (retrying)"));
    info.appendChild(nameEl); info.appendChild(sub);
    const del = document.createElement("button");
    del.type = "button"; del.className = "viewerForget"; del.title = "Remove this person (they will not be added back automatically)"; del.textContent = "✕";
    del.addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); send("forget_viewer", { username: v.u }); });
    row.addEventListener("click", (e) => { if (e.target === box || e.target === del) return; box.checked = !box.checked; box.dispatchEvent(new Event("change")); });
    row.appendChild(box); row.appendChild(pic); row.appendChild(info); row.appendChild(del);
    el.viewerList.appendChild(row);
  });
  if (rows.length > 400) {
    const more = document.createElement("div");
    more.className = "viewerEmpty";
    more.textContent = "Showing the 400 most recent of " + rows.length + " - use the search to find anyone else.";
    el.viewerList.appendChild(more);
  }
}
el.viewerSearch.addEventListener("input", renderViewerList);
el.viewerTickAll.addEventListener("click", () => send("set_all_viewers_selected", { on: true, onlyWithPicture: true }));
el.viewerUntickAll.addEventListener("click", () => send("set_all_viewers_selected", { on: false }));
if (el.viewerAllowRemoved) el.viewerAllowRemoved.addEventListener("click", () => send("allow_removed_viewers", {}));
const retryPicsBtn = document.getElementById("viewerRetryPics");
if (retryPicsBtn) retryPicsBtn.addEventListener("click", () => send("retry_viewer_pictures", {}));
el.viewerForgetAll.addEventListener("click", () => {
  if (window.confirm("Forget everyone, delete all saved profile pictures and clear your removed-people list? Anyone who joins or chats afterwards is added (and ticked) again. This cannot be undone.")) send("forget_all_viewers", {});
});
// a picture that cannot load falls back to a colored initial (same look as a viewer without a picture)
document.addEventListener("error", (e) => {
  const t = e.target;
  if (!t || !t.classList || !t.classList.contains("symAvatar") || t.tagName !== "IMG") return;
  const fb = document.createElement("span");
  fb.className = "symAvatar symAvatarFallback";
  const name = t.getAttribute("data-n") || "?";
  fb.textContent = name.charAt(0).toUpperCase();
  fb.style.background = avatarColorFor(name);
  t.replaceWith(fb);
}, true);

// One symbol cell (shared by the board and the settings preview): sized, scaled and animated by the look settings.
function makeSymbolCell(id, viewers, index, width, height, fontPx) {
  const cell = document.createElement("div");
  cell.className = "symbolCell";
  cell.style.width = width + "px";
  cell.style.height = height + "px";
  cell.style.fontSize = fontPx + "px";
  cell.style.setProperty("--i", String(index));
  const scale = document.createElement("div");
  scale.className = "symScale";
  const move = document.createElement("div");
  move.className = "symMove";
  move.innerHTML = window.ShapedleSymbols ? window.ShapedleSymbols.htmlById(id, viewers) : "";
  scale.appendChild(move);
  cell.appendChild(scale);
  return cell;
}

// Starter word: ON by default, remembered by the server, used from the next round.
el.starterWordToggle.addEventListener("change", () => {
  send("set_starter_word", { on: el.starterWordToggle.checked });
});

el.playAgainBtn.addEventListener("click", () => send("play_again", {}));
el.giveUpBtn.addEventListener("click", () => send("give_up", {}));
el.hintBtn.addEventListener("click", () => send("use_hint", {}));

el.resetRoundBtn.addEventListener("click", () => send("reset_round_leaderboard", {}));
el.resetTotalBtn.addEventListener("click", () => send("reset_total_leaderboard", {}));

let pendingSetAnswerSource = null;
function submitSetAnswer(source, inputEl) {
  const word = inputEl.value.trim();
  if (!word) return;
  pendingSetAnswerSource = source;
  send("set_secret_word", { word: word });
}
el.setAnswerBtnLive.addEventListener("click", () => submitSetAnswer("live", el.setAnswerInputLive));
el.setAnswerInputLive.addEventListener("keydown", (e) => { if (e.key === "Enter") submitSetAnswer("live", el.setAnswerInputLive); });
el.setAnswerBtnTest.addEventListener("click", () => submitSetAnswer("test", el.setAnswerInputTest));
el.setAnswerInputTest.addEventListener("keydown", (e) => { if (e.key === "Enter") submitSetAnswer("test", el.setAnswerInputTest); });

function handleSetAnswerResult(result) {
  const errorEl = pendingSetAnswerSource === "test" ? el.setAnswerErrorTest : el.setAnswerErrorLive;
  const inputEl = pendingSetAnswerSource === "test" ? el.setAnswerInputTest : el.setAnswerInputLive;
  if (result.ok) {
    errorEl.textContent = "";
    inputEl.value = "";
  } else {
    errorEl.textContent = result.error || "Couldn't set that word.";
  }
}

function submitOfflineGuess() {
  const word = el.offlineGuessInput.value.trim();
  if (!word) return;
  send("submit_offline_guess", { word: word });
}
el.offlineGuessBtn.addEventListener("click", submitOfflineGuess);
el.offlineGuessInput.addEventListener("keydown", (e) => { if (e.key === "Enter") submitOfflineGuess(); });

function handleOfflineGuessResult(result) {
  if (result.ok) {
    el.offlineError.textContent = "";
    el.offlineGuessInput.value = "";
  } else {
    el.offlineError.textContent = result.error || "That guess didn't work.";
  }
}

// ------------------------------------------------------------
// Rejection toast - brief but readable, auto-dismissing.
// This is a floating overlay (see .rejectionToast in style.css) so it
// never affects document flow - showing/hiding it never pushes the
// guessed-words section up or down. Its on-screen duration is
// host-configurable (Settings → "Show rejection message for").
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
// Win celebration: confetti + winner callout + auto-popup leaderboard
// ------------------------------------------------------------
const CONFETTI_COLORS = ["#ffb100", "#ff3b4e", "#16d976", "#7c5cff", "#f6f4ef"];
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
  if (!list || list.length === 0) {
    return '<li class="empty">No scores yet</li>';
  }
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
      '<div class="celebLabel">🎉 Winner</div>' +
      '<div class="celebWinnerRow">' + avatarChipHtml(winnerName, winnerAvatar, 34) + '<span>' + escapeHtml(winnerName) + "</span></div>" +
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
// Rendering
// ------------------------------------------------------------
const CONNECTION_LABELS = {
  idle: "Idle", connecting: "Connecting…", retrying: "Retrying…",
  live: "LIVE", test_mode: "Simulating (Test Mode)", error: "Connection issue", disconnected: "Disconnected"
};

let lastTilesSignature = "";

function render(state) {
  lastState = state;
  detectWinTransition(state.game);
  renderHeader(state);
  renderModeUI(state.game);
  renderLengthBadge(state.game);
  renderKeyboardVisibility(state.game);
  applyKeyMetrics();
  renderTiles(state.game);
  renderHintChips(state.game);
  renderModeNotes(state.game);
  renderBanners(state.game);
  paintKeyboard();
  maybeShowRejection(state.game);
  renderSettingsChips(state);
  renderDiagnostics(state.diagnostics);
  if (!el.leaderboardOverlay.hidden) renderLeaderboardTab();
}

function renderHeader(state) {
  const connStatus = state.diagnostics.connectionStatus || "idle";
  el.brandDot.className = "brandDot " + (state.game.mode === "test" ? "test_mode" : connStatus);
  el.modeBadge.textContent = state.game.mode.toUpperCase();
  el.modeBadge.className = "modeBadge " + state.game.mode;
  el.hintBtn.disabled = state.game.status !== "live";
}

function renderModeUI(g) {
  el.liveControls.hidden = g.mode !== "live";
  el.testControls.hidden = g.mode !== "test";
  el.offlineControls.hidden = g.mode !== "offline";
}

function renderLengthBadge(g) {
  el.lengthBadge.textContent = g.status === "idle" ? "— letters" : g.wordLength + " letters";
}

// Tile sizing combines two constraints so guesses always sit on one
// line AND every guess made this round is visible without scrolling:
//   - width:  sized as if the word were at least 17 letters long, so
//             sizing stays visually consistent across rounds instead
//             of ballooning for short words
//   - height: shrinks further if there are enough guess rows that
//             they wouldn't otherwise all fit in the visible area
// The keyboard is sized to match exactly (see applyKeyMetrics).
function computeAvailableTilesHeight() {
  const viewportH = window.innerHeight;
  const top = el.tilesWrap.getBoundingClientRect().top;
  // Reserve the REAL height of the sticky host-controls bar (it is tall when open and a thin
  // strip when collapsed) plus a small margin, instead of a fixed guess.
  const footerH = el.controls ? el.controls.getBoundingClientRect().height : 190;
  const reserveBelow = Math.round(footerH) + 24;
  return Math.max(110, viewportH - top - reserveBelow);
}

// Sizes a tile row so it always fits on one line, using the "as if
// at least 17 letters" doubled baseline, clamped by whatever the
// actual word length needs.
function widthConstrainedTileSize(usableWidth, wordLength, hGap) {
  const baselineLength = 17;
  let baselineSize = Math.floor((usableWidth - hGap * (baselineLength - 1)) / baselineLength);
  baselineSize = Math.max(8, baselineSize) * 2;
  baselineSize = Math.min(90, baselineSize);

  let actualFitSize = Math.floor((usableWidth - hGap * (wordLength - 1)) / wordLength);
  actualFitSize = Math.max(8, actualFitSize);

  return Math.min(baselineSize, actualFitSize);
}

function computeTileMetrics(wordLength, rowCount) {
  const containerWidth = el.tilesWrap.clientWidth || 320;
  const hGap = 2;
  const avatarGap = 8;

  // SHAPEDLE has no count badges - the whole row is just the avatar and the colored letters.
  const badgeColumns = 0;
  const extraBadgeGaps = 0;

  // Pass 1: rough avatar-size estimate to bootstrap a tile size.
  let avatarReserve = 40;
  let tileSizeByWidth = widthConstrainedTileSize(
    Math.max(100, containerWidth - avatarReserve - extraBadgeGaps),
    wordLength + badgeColumns,
    hGap
  );

  // Pass 2: the avatar scales off the tile HEIGHT (see the final
  // formula below) - now that pass 1 gives a rough tile size, redo the
  // fit once more with a much closer avatar-size estimate.
  const tileHeightGuess = Math.round(tileSizeByWidth * 1.18);
  avatarReserve = Math.max(14, Math.round(tileHeightGuess * 0.82)) + avatarGap;
  tileSizeByWidth = widthConstrainedTileSize(
    Math.max(100, containerWidth - avatarReserve - extraBadgeGaps),
    wordLength + badgeColumns,
    hGap
  );

  const availableHeight = computeAvailableTilesHeight();
  const vGap = 8;
  const rows = Math.max(1, rowCount);
  const rowHeightBudget = Math.floor((availableHeight - vGap * (rows - 1)) / rows);
  let tileSizeByHeight = Math.floor(rowHeightBudget / 1.18);
  tileSizeByHeight = Math.max(8, Math.min(90, tileSizeByHeight));

  const tileSize = Math.max(8, Math.min(tileSizeByWidth, tileSizeByHeight));
  const tileHeight = Math.round(tileSize * 1.18);
  const fontSize = Math.max(7, Math.round(tileSize * 0.42));

  const avatarSize = Math.max(14, Math.round(tileHeight * 0.82));
  const avatarFontSize = Math.max(7, Math.round(avatarSize * 0.46));

  return { tileSize, tileHeight, fontSize, gap: hGap, avatarSize, avatarFontSize };
}

// ------------------------------------------------------------
// Per-guesser avatar - a deterministic "colored circle + initial"
// generated from the username (TikTok chat events don't reliably give
// us a hotlinkable profile-photo URL here, so this is a stable stand-in
// that's always the same color/letter for the same person every time).
// ------------------------------------------------------------
const AVATAR_PALETTE = [
  "#e0699c", "#4fa0c4", "#6faa5c", "#e0a934", "#9c6fd1",
  "#e0724a", "#3aa6a6", "#c4577a", "#5c8ae0", "#8aa63a"
];
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
function avatarColorFor(username) {
  return AVATAR_PALETTE[hashString(username || "?") % AVATAR_PALETTE.length];
}
function avatarInitial(username) {
  const clean = String(username || "").trim();
  return clean ? Array.from(clean)[0].toUpperCase() : "?"; // Array.from keeps emoji (the 🎲 starter label) intact
}

// Builds an actual DOM avatar node (used inside the guess grid, where
// rows are built as real elements, not innerHTML strings). Shows the
// viewer's real TikTok profile picture when we have one; if the image
// URL is missing, blocked, or fails to load, it falls back to the
// deterministic colored-initial circle instead of leaving a blank hole.
function buildAvatarNode(username, avatarUrl, sizePx, fontPx, className) {
  const wrap = document.createElement("div");
  wrap.className = className || "guessAvatar";
  wrap.style.width = sizePx + "px";
  wrap.style.height = sizePx + "px";
  wrap.title = username || "Unknown viewer";

  function showFallback() {
    wrap.innerHTML = "";
    wrap.style.background = avatarColorFor(username);
    wrap.style.fontSize = fontPx + "px";
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

// Same idea as buildAvatarNode, but returns an HTML string for spots
// that build their markup with innerHTML (leaderboard rows, the win
// celebration banner) rather than individual DOM nodes.
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

const CLUE_TITLES = [
  "Green: right letter, right spot",
  "Yellow: in the word, wrong spot",
  "Gray: not in the word"
];

function buildGuessBlock(guess, wordLength, metrics) {
  const block = document.createElement("div");
  block.className = "guessBlock";

  if (guess) {
    const avatar = buildAvatarNode(guess.caller, guess.avatarUrl, metrics.avatarSize, metrics.avatarFontSize, "guessAvatar");
    block.appendChild(avatar);
  } else {
    // Keeps the "current" (still-typing) row's tiles aligned under the
    // guessed rows above/below it, instead of shifting left with no
    // avatar column reserved.
    const spacer = document.createElement("div");
    spacer.className = "guessAvatarSpacer";
    spacer.style.width = metrics.avatarSize + "px";
    spacer.style.height = metrics.avatarSize + "px";
    block.appendChild(spacer);
  }

  const rowEl = document.createElement("div");
  rowEl.className = "tileRow";
  rowEl.style.gap = metrics.gap + "px";
  for (let c = 0; c < wordLength; c++) {
    const tile = document.createElement("div");
    tile.style.width = metrics.tileSize + "px";
    tile.style.height = metrics.tileHeight + "px";
    tile.style.fontSize = metrics.fontSize + "px";
    if (guess) {
      // clue color per letter: 0 green, 1 yellow, 2 gray
      tile.className = "tile filled sp" + guess.clue[c];
      tile.textContent = guess.word[c];
      tile.title = CLUE_TITLES[guess.clue[c]];
    } else {
      tile.className = "tile current";
    }
    rowEl.appendChild(tile);
  }
  block.appendChild(rowEl);

  return block;
}

// The symbol row: one symbol per tile column, built with the SAME avatar spacer, tile width and gap
// as the guess rows so every symbol sits exactly above its column. A repeated letter repeats a symbol.
function renderSymbols(g, metrics) {
  el.symbolRow.innerHTML = "";
  if (!g.symbolRow || g.symbolRow.length === 0) return;
  const spacer = document.createElement("div");
  spacer.className = "guessAvatarSpacer";
  spacer.style.width = metrics.avatarSize + "px";
  spacer.style.height = "1px";
  el.symbolRow.appendChild(spacer);

  const cells = document.createElement("div");
  cells.className = "symbolCells";
  cells.style.gap = metrics.gap + "px";
  const emojiFont = Math.max(12, Math.round(metrics.tileSize * 0.78));
  g.symbolRow.forEach((id, i) => {
    cells.appendChild(makeSymbolCell(id, g.symbolViewers || {}, i, metrics.tileSize, Math.round(metrics.tileSize * 1.05), emojiFont));
  });
  el.symbolRow.appendChild(cells);
  if (g.symbolOptions) applySymbolLook(g.symbolOptions, el.symbolSection);
}

function renderTiles(g) {
  // The starter word's picture (the live host's TikTok avatar) can arrive after the round has
  // started, so it is part of the cache key.
  const starterRow = g.guesses.find((x) => x.isStarter);
  const starterAvatar = (starterRow && starterRow.avatarUrl) || "";
  const symbolKey = (g.symbolRow || []).join(",") + "@" + JSON.stringify(g.symbolViewers || {});
  const signature = starterAvatar + "|" + g.status + "|" + g.wordLength + "|" + g.guessesMade + "|" + symbolKey;
  if (signature === lastTilesSignature) return;
  lastTilesSignature = signature;

  el.tilesWrap.innerHTML = "";
  el.symbolRow.innerHTML = "";
  if (g.status === "idle") return;

  const rowCount = g.guesses.length + (g.status === "live" ? 1 : 0) + 1; // +1 for the symbol row
  const metrics = computeTileMetrics(g.wordLength, rowCount);
  renderSymbols(g, metrics);

  if (g.status === "live") {
    el.tilesWrap.appendChild(buildGuessBlock(null, g.wordLength, metrics));
  }
  const reversed = g.guesses.slice().reverse();
  reversed.forEach((guess) => {
    el.tilesWrap.appendChild(buildGuessBlock(guess, g.wordLength, metrics));
  });
}

function renderHintChips(g) {
  const hasHints = g.hintSuggestions && g.hintSuggestions.length > 0;
  el.hintExplainer.hidden = !hasHints;
  if (!hasHints) {
    el.hintChips.innerHTML = "";
    return;
  }
  el.hintChips.innerHTML = g.hintSuggestions
    .map((word) => '<span class="hintChip">Try: ' + escapeHtml(word.toUpperCase()) + "</span>")
    .join("");
}

function renderModeNotes(g) {
  el.offlineNote.hidden = !(g.status === "live" && g.mode === "offline");
}

function renderBanners(g) {
  el.idleBanner.hidden = g.status !== "idle";
  el.resultBanner.hidden = g.status !== "won" && g.status !== "lost";

  if (g.status === "won") {
    const lastGuess = g.guesses[g.guesses.length - 1];
    const word = (g.lastWinInfo && g.lastWinInfo.word) || (lastGuess && lastGuess.word) || "";
    el.resultBanner.className = "resultBanner win";
    if (g.lastWinInfo && g.lastWinInfo.username) {
      const pointsPart = typeof g.lastWinInfo.points === "number" ? " — +" + g.lastWinInfo.points + " points" : "";
      el.resultText.textContent = "🎉 " + g.lastWinInfo.username + ' solved it! "' + word.toUpperCase() + '"' + pointsPart;
    } else {
      el.resultText.textContent = '🎉 Solved it! The word was "' + word.toUpperCase() + '".';
    }
  } else if (g.status === "lost") {
    el.resultBanner.className = "resultBanner lost";
    el.resultText.textContent = '⏱ Round ended. The word was "' + ((g.secretWord || "").toUpperCase()) + '".';
  }

  if ((g.status === "won" || g.status === "lost") && g.autoContinue) {
    el.autoContinueNote.hidden = false;
    el.autoContinueNote.textContent = "Auto-continuing in " + g.autoContinueSecondsLeft + "s…";
  } else {
    el.autoContinueNote.hidden = true;
  }
}

// The legend, the self-coloring keyboard and the symbol row stay on screen for the whole
// round (also after it ends, so the final colors stay visible); hidden only while idle.
function renderKeyboardVisibility(g) {
  const show = g.status !== "idle";
  const display = show ? "block" : "none";
  if (el.keyboardSection.style.display !== display) lastTilesSignature = "";
  el.keyboardSection.style.display = display;
  el.symbolSection.style.display = display;
}

function renderSettingsChips(state) {
  const g = state.game;
  const modeInfo = MODE_LABELS[g.mode];
  el.modeChip.textContent = "Mode: " + modeInfo.title + " — " + modeInfo.desc;
  el.modeChip.className = "statusChip " + (g.mode === "live" ? "good" : "");

  const connStatus = state.diagnostics.connectionStatus;
  el.connChip.textContent = "TikTok: " + (CONNECTION_LABELS[connStatus] || connStatus);
  el.connChip.className = "statusChip " + (connStatus === "live" ? "good" : connStatus === "error" ? "bad" : "");

  updateConnectButtons();
}

// The drawer's Connect button is usable as soon as "Live" is chosen in the Mode
// dropdown (even before Apply/Save); the bottom-bar one only exists in Live mode.
function updateConnectButtons() {
  const serverIsLive = !!(lastState && lastState.game && lastState.game.mode === "live");
  el.connectBtn.disabled = !(serverIsLive || stagedMode === "live");
  el.connectBtnBottom.disabled = !serverIsLive;
}

function renderDiagnostics(diag) {
  const dictLabel = diag.dictionaryLoading
    ? "Loading…"
    : diag.dictionaryWordCount.toLocaleString() + " words (" + (diag.dictionarySource === "full" ? "full list" : "fallback list") + ")";
  const dictTone = diag.dictionaryLoading ? "warn" : diag.dictionarySource === "full" ? "good" : "bad";

  const rows = [
    ["Raw events received", diag.rawEventCount, "good"],
    ["Last received", diag.lastReceivedUser ? diag.lastReceivedUser + ": " + (diag.lastReceivedText || "(empty)") : "—", null],
    ["Connection status", CONNECTION_LABELS[diag.connectionStatus] || diag.connectionStatus, statusTone(diag.connectionStatus)],
    ["Signing key set up?", diag.signKeyConfigured ? "Yes" : "No — see setup guide", diag.signKeyConfigured ? "good" : "bad"],
    ["Word dictionary", dictLabel, dictTone],
    ["Retry attempts", diag.retryAttempt + " / " + diag.maxRetries, diag.retryAttempt > 0 ? "warn" : null],
    ["Last message", diag.lastErrorMessage || "—", diag.lastErrorMessage ? "bad" : null]
  ];

  el.diagGrid.innerHTML = rows
    .map(([key, val, tone]) =>
      '<div class="diagRow"><span class="diagKey">' + escapeHtml(key) + '</span><span class="diagVal ' + (tone || "") + '">' + escapeHtml(String(val)) + "</span></div>"
    )
    .join("");
}

function statusTone(status) {
  if (status === "live" || status === "test_mode") return "good";
  if (status === "error" || status === "disconnected") return "bad";
  if (status === "connecting" || status === "retrying") return "warn";
  return null;
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
