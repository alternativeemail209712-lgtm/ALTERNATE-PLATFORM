const socket = io("/flagle");

// ---------- Mobile viewport fix ----------
// Phone browsers (esp. Android Chrome) resize their address bar in and out
// as you scroll, which makes "100vh" lie about the real visible height and
// can push bottom content (like the host controls) off-screen. We measure
// the real visible height with JS and feed it back in as a CSS variable.
function setRealViewportHeight() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty("--vh", `${vh}px`);
}
setRealViewportHeight();
window.addEventListener("resize", setRealViewportHeight);
window.addEventListener("orientationchange", setRealViewportHeight);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", setRealViewportHeight);
}

// ---------- Elements ----------
const setupScreen = document.getElementById("setup-screen");
const gameScreen = document.getElementById("game-screen");
const usernameInput = document.getElementById("tiktok-username");
const connectBtn = document.getElementById("connect-btn");
const setupStatus = document.getElementById("setup-status");
const modeTabsEl = document.getElementById("mode-tabs");
const livePanel = document.getElementById("live-panel");
const testPanel = document.getElementById("test-panel");
const offlinePanel = document.getElementById("offline-panel");
const startTestBtn = document.getElementById("start-test-btn");
const startOfflineBtn = document.getElementById("start-offline-btn");

const liveUsernameEl = document.getElementById("live-username");
const heartbeatEl = document.getElementById("heartbeat");
const modeBadgeEl = document.getElementById("mode-badge");
const roundTimerEl = document.getElementById("round-timer");
const flagImg = document.getElementById("flag-image");
const flagPlate = document.querySelector(".flag-plate");
const hintTextEl = document.getElementById("hint-text");
const commentFeedEl = document.getElementById("comment-feed");
const leaderboardEl = document.getElementById("ticker-track");
const tickerWrapEl = document.getElementById("ticker-wrap");
const likesListEl = document.getElementById("likes-list");
const giftsListEl = document.getElementById("gifts-list");
const toastLayer = document.getElementById("toast-layer");
const debugStripEl = document.getElementById("debug-strip");
const debugLastEl = document.getElementById("debug-last");

const settingsBtn = document.getElementById("settings-btn");
const settingsOverlay = document.getElementById("settings-overlay");
const settingsCloseBtn = document.getElementById("settings-close");
const settingRoundSeconds = document.getElementById("setting-round-seconds");
const settingHoldSeconds = document.getElementById("setting-hold-seconds");
const settingBlurPx = document.getElementById("setting-blur-px");
const settingBlurPxValue = document.getElementById("setting-blur-px-value");
const settingRevealPause = document.getElementById("setting-reveal-pause");
const settingsApplyBtn = document.getElementById("settings-apply");
const settingsStatusEl = document.getElementById("settings-status");
const resetSessionScoresBtn = document.getElementById("reset-session-scores");
const resetAllTimeScoresBtn = document.getElementById("reset-alltime-scores");

const hostForm = document.getElementById("host-form");
const hostInput = document.getElementById("host-input");
const skipBtn = document.getElementById("skip-btn");
const hintBtn = document.getElementById("hint-btn");
const fullscreenBtn = document.getElementById("fullscreen-btn");

let countdownInterval = null;

// ---------- Host settings ----------
// Local mirror of the session's settings, kept in sync with the server
// via "session-started" and "settings:update". Sensible fallbacks here
// only matter for the brief moment before the server's first message
// arrives — the server is always the source of truth once connected.
let currentSettings = {
  roundSeconds: 45,
  revealHoldSeconds: 10,
  maxBlurPx: 26,
  revealPauseMs: 6000,
};

function populateSettingsForm(settings) {
  currentSettings = { ...currentSettings, ...settings };
  settingRoundSeconds.value = currentSettings.roundSeconds;
  settingHoldSeconds.value = currentSettings.revealHoldSeconds;
  settingBlurPx.value = currentSettings.maxBlurPx;
  settingBlurPxValue.textContent = currentSettings.maxBlurPx + "px";
  settingRevealPause.value = Math.round(currentSettings.revealPauseMs / 1000);
}

function openSettings() {
  settingsOverlay.hidden = false;
  settingsStatusEl.textContent = "";
}
function closeSettings() {
  settingsOverlay.hidden = true;
}
settingsBtn.addEventListener("click", openSettings);
settingsCloseBtn.addEventListener("click", closeSettings);
settingsOverlay.addEventListener("click", (e) => {
  if (e.target === settingsOverlay) closeSettings();
});
settingBlurPx.addEventListener("input", () => {
  settingBlurPxValue.textContent = settingBlurPx.value + "px";
});

settingsApplyBtn.addEventListener("click", () => {
  const payload = {
    roundSeconds: Number(settingRoundSeconds.value),
    revealHoldSeconds: Number(settingHoldSeconds.value),
    maxBlurPx: Number(settingBlurPx.value),
    revealPauseMs: Number(settingRevealPause.value) * 1000,
  };
  socket.emit("host:updateSettings", payload);
  // Applies right away rather than waiting for the current round to
  // finish naturally, mirroring the other games' "Apply settings &
  // start new round" behavior.
  socket.emit("skip-round");
  settingsStatusEl.textContent = "Applied — starting a new round with these settings.";
  setTimeout(closeSettings, 900);
});

socket.on("settings:update", (settings) => {
  populateSettingsForm(settings);
});

resetSessionScoresBtn.addEventListener("click", () => {
  socket.emit("host:resetSessionScores");
  settingsStatusEl.textContent = "This session's leaderboard was reset.";
});

resetAllTimeScoresBtn.addEventListener("click", () => {
  flagleAllTime = {};
  flagleAllTimeAvatars = {};
  saveFlagleStore();
  saveFlagleAvatarStore();
  settingsStatusEl.textContent = "All-time leaderboard was reset.";
});

socket.on("leaderboard-update", (list) => {
  renderLeaderboard(list);
});

// ---------- All-time leaderboard (persisted client-side, same convention
// as TRAVLE's store) ----------
// Flagle's server-side scores live only in memory for the current socket
// session, so they reset on reconnect/redeploy. To have a genuine
// "all-time top scorer" across sessions we keep a small persisted tally
// here, updated every time a round is won in Live mode.
const FLAGLE_STORE_KEY = "flagle_tiktok_v1";
const FLAGLE_AVATAR_STORE_KEY = "flagle_tiktok_avatars_v1"; // kept separate so it never breaks older saved score data
function loadFlagleStore() {
  try {
    const raw = localStorage.getItem(FLAGLE_STORE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}
function loadFlagleAvatarStore() {
  try {
    const raw = localStorage.getItem(FLAGLE_AVATAR_STORE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}
let flagleAllTime = loadFlagleStore();
let flagleAllTimeAvatars = loadFlagleAvatarStore();
function saveFlagleStore() {
  try { localStorage.setItem(FLAGLE_STORE_KEY, JSON.stringify(flagleAllTime)); } catch (e) { /* ignore */ }
}
function saveFlagleAvatarStore() {
  try { localStorage.setItem(FLAGLE_AVATAR_STORE_KEY, JSON.stringify(flagleAllTimeAvatars)); } catch (e) { /* ignore */ }
}
function addFlagleAllTimePoints(name, points, avatarUrl) {
  const clean = (name || "").trim();
  if (!clean || !points || points <= 0) return;
  flagleAllTime[clean] = (flagleAllTime[clean] || 0) + points;
  saveFlagleStore();
  if (avatarUrl) {
    flagleAllTimeAvatars[clean] = avatarUrl;
    saveFlagleAvatarStore();
  }
}

// ---------- Fullscreen ----------
if (!document.documentElement.requestFullscreen && !document.documentElement.webkitRequestFullscreen) {
  fullscreenBtn.style.display = "none"; // not supported on this browser — hide rather than show a dead button
}
fullscreenBtn.addEventListener("click", async () => {
  try {
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
    if (!isFullscreen) {
      const el = document.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
    } else {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
  } catch (e) {
    // Some in-app/webview browsers block fullscreen entirely — fail
    // quietly rather than breaking the game.
    console.error("Fullscreen toggle failed:", e);
  }
});
document.addEventListener("fullscreenchange", () => {
  fullscreenBtn.classList.toggle("active", Boolean(document.fullscreenElement));
  setRealViewportHeight(); // fullscreen changes the real visible height
});
document.addEventListener("webkitfullscreenchange", () => {
  fullscreenBtn.classList.toggle("active", Boolean(document.webkitFullscreenElement));
  setRealViewportHeight();
});

// ---------- Mode tabs ----------
const modePanels = { live: livePanel, test: testPanel, offline: offlinePanel };
modeTabsEl.addEventListener("click", (e) => {
  const btn = e.target.closest(".mode-tab");
  if (!btn) return;
  const mode = btn.dataset.mode;
  document.querySelectorAll(".mode-tab").forEach((t) => t.classList.toggle("active", t === btn));
  Object.entries(modePanels).forEach(([m, panel]) => panel.classList.toggle("hidden", m !== mode));
  setupStatus.textContent = "";
});

// ---------- Setup screen ----------
connectBtn.addEventListener("click", () => {
  const username = usernameInput.value.trim();
  if (!username) {
    setupStatus.textContent = "Type your TikTok username first.";
    setupStatus.className = "setup-status";
    return;
  }
  connectBtn.disabled = true;
  setupStatus.textContent = "Connecting to your live chat…";
  setupStatus.className = "setup-status";
  socket.emit("connect-tiktok", { username });
});

startTestBtn.addEventListener("click", () => {
  setupStatus.textContent = "Starting test round…";
  setupStatus.className = "setup-status";
  socket.emit("start-local-mode", { mode: "test" });
});

startOfflineBtn.addEventListener("click", () => {
  setupStatus.textContent = "Starting…";
  setupStatus.className = "setup-status";
  socket.emit("start-local-mode", { mode: "offline" });
});

socket.on("session-started", ({ mode, label, settings }) => {
  if (settings) populateSettingsForm(settings);
  setupStatus.textContent = "Ready! Starting the game…";
  setupStatus.className = "setup-status ok";
  liveUsernameEl.textContent = mode === "live" ? label : "";
  heartbeatEl.textContent = "🎧 0";
  heartbeatEl.classList.toggle("hidden", mode !== "live");
  debugStripEl.classList.toggle("hidden", mode !== "live");

  modeBadgeEl.textContent = mode.toUpperCase();
  modeBadgeEl.className = "mode-badge " + mode;

  latestFanStats = { likes: [], gifts: [] };
  renderFansList();
  renderLeaderboard(null);

  setTimeout(() => {
    setupScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
  }, 500);
});

socket.on("tiktok-error", ({ message }) => {
  connectBtn.disabled = false;
  setupStatus.textContent = message;
  setupStatus.className = "setup-status";
});

socket.on("tiktok-status", ({ message }) => {
  setupStatus.textContent = message;
  setupStatus.className = "setup-status";
});

socket.on("chat-heartbeat", ({ count }) => {
  heartbeatEl.textContent = `🎧 ${count}`;
});

socket.on("debug-last-comment", ({ username, text }) => {
  debugLastEl.textContent = `${username}: "${text}"`;
});

socket.on("tiktok-disconnected", () => {
  gameScreen.classList.add("hidden");
  setupScreen.classList.remove("hidden");
  connectBtn.disabled = false;
  setupStatus.textContent = "Live session ended. Reconnect when you're back live.";
  setupStatus.className = "setup-status";
});

// ---------- Round lifecycle ----------
socket.on("round-start", ({ code, roundSeconds, revealHoldSeconds, maxBlurPx, answer }) => {
  flagImg.src = `https://flagcdn.com/w640/${code}.png`;
  hintTextEl.textContent = "Type the country name in chat to guess.";
  hintTextEl.classList.remove("flash");
  startCountdown(roundSeconds);
  startBlurReveal(roundSeconds, revealHoldSeconds, maxBlurPx);

  if (answer) {
    debugStripEl.classList.remove("hidden");
    debugLastEl.textContent = `TEST — answer: "${answer}"`;
  }
});

socket.on("wrong-guess", ({ guessedName, distanceKm, direction }) => {
  hintTextEl.textContent = `${guessedName} is not it — ${distanceKm.toLocaleString()} km away, head ${direction}.`;
  hintTextEl.classList.add("flash");
});

socket.on("host-hint", ({ message }) => {
  hintTextEl.textContent = message;
  hintTextEl.classList.add("flash");
});

socket.on("round-end", ({ countryName, fact, winner, winnerAvatar, points, leaderboard: lb }) => {
  stopCountdown();
  // Snap instantly to full clarity for the reveal, overriding any
  // in-progress gradual-clear transition so the flag is unmistakably sharp.
  flagImg.style.transition = "filter .3s ease";
  setBlur(0);
  flagPlate.classList.add("revealed");
  setTimeout(() => flagPlate.classList.remove("revealed"), 1200);

  if (winner) {
    showToast(`🎯 ${winner} nailed it — ${countryName} (+${points})`, "win");
    celebrateWinner(winner, winnerAvatar);
    addFlagleAllTimePoints(winner, points, winnerAvatar);
  } else {
    showToast(`⏱ Time's up — it was ${countryName}`, "reveal");
  }

  hintTextEl.innerHTML = `<strong>${escapeHtml(countryName)}</strong> — ${escapeHtml(fact || "")}`;
  hintTextEl.classList.remove("flash");

  renderLeaderboard(lb);
  showRoundCelebration(winner, winnerAvatar, countryName);
});

// ---------- Floating round-result & all-time-top-scorer windows ----------
// Row 1: who got it (or a friendly fallback if nobody did). Row 2: the
// answer itself, deliberately in a larger font so it's unmistakable even
// to someone glancing at a stream overlay. After that window closes, a
// second floating window shows the all-time top scorer, if there is one.
function showRoundCelebration(winner, winnerAvatar, countryName) {
  if (!window.Celebration) return;
  window.Celebration.showCard({
    emoji: winner ? "🎯" : "⏱",
    title: winner ? "Round Winner!" : "Round Result",
    rows: [
      winner ? { primary: winner, avatarUrl: winnerAvatar || null } : { primary: "No one got it this round" },
      { primary: countryName, primaryLarge: true },
    ],
    durationMs: 4000,
  }).then(showFlagleAllTimeTopScorer);
}

function showFlagleAllTimeTopScorer() {
  if (!window.Celebration) return;
  const entries = Object.entries(flagleAllTime).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return;
  const [name, pts] = entries[0];
  window.Celebration.showCard({
    emoji: "🏆",
    title: "All-Time Top Scorer",
    rows: [{ primary: name, avatarUrl: flagleAllTimeAvatars[name] || null, primaryLarge: true, secondary: `${pts} pt${pts === 1 ? "" : "s"}` }],
    durationMs: 4000,
  });
}

// ---------- Top Fans (Likes and Gifts — two independent sections) ----------
let latestFanStats = { likes: [], gifts: [] };

socket.on("fan-stats", (stats) => {
  latestFanStats = stats;
  renderFansList();
});

function renderFanList(listEl, entries, emptyText, valueFn) {
  listEl.innerHTML = "";
  if (!entries || entries.length === 0) {
    listEl.innerHTML = `<li><span style="color:var(--ink-mid)">${emptyText}</span></li>`;
    return;
  }
  entries.forEach((entry, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<b>${i + 1}. ${avatarChipHtml(entry.username, entry.avatarUrl, 20)}${escapeHtml(entry.username)}</b><span class="pts">${valueFn(entry)}</span>`;
    listEl.appendChild(li);
  });
}

function renderFansList() {
  renderFanList(likesListEl, latestFanStats.likes, "No likes yet.", (e) => `❤️ ${e.count}`);
  renderFanList(giftsListEl, latestFanStats.gifts, "No gifts yet.", (e) => `💎 ${e.value}`);
}


// ---------- Chat feed ----------
socket.on("comment-feed", ({ username, text, correct, avatarUrl }) => {
  if (window.PenguinFun) window.PenguinFun.handleChatText(text);
  const row = document.createElement("div");
  row.className = "comment-row" + (correct ? " correct" : "");
  const isHost = username.startsWith("HOST");
  row.innerHTML =
    (isHost ? "" : avatarChipHtml(username, avatarUrl, 18)) +
    `<span class="name${isHost ? " host" : ""}">${escapeHtml(username)}</span> ` +
    `<span class="text">${escapeHtml(text)}</span>`;
  commentFeedEl.appendChild(row);
  commentFeedEl.scrollTop = commentFeedEl.scrollHeight;
  while (commentFeedEl.children.length > 60) {
    commentFeedEl.removeChild(commentFeedEl.firstChild);
  }
});

// ---------- Host controls ----------
hostForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = hostInput.value.trim();
  if (!text) return;
  socket.emit("host-comment", { text });
  hostInput.value = "";
});

skipBtn.addEventListener("click", () => socket.emit("skip-round"));
hintBtn.addEventListener("click", () => socket.emit("request-hint"));

// ---------- Helpers ----------
function setBlur(px) {
  flagPlate.style.setProperty("--blur", `${px}px`);
}

// Clears the flag from fully blurred to fully sharp via a CSS transition,
// timed so it finishes with exactly `holdClearSeconds` left on the clock
// (host-configurable in Settings — viewers should be able to clearly see
// the unblurred flag for that final stretch of every round), then holds
// fully sharp for the remainder. Starting blur strength is also
// host-configurable (harder to guess early on with a stronger blur).
function startBlurReveal(roundSeconds, holdClearSeconds, maxBlurPx) {
  const MAX_BLUR_PX = Number.isFinite(maxBlurPx) ? maxBlurPx : currentSettings.maxBlurPx;
  const MIN_BLUR_PX = 0; // fully unblurred, not just "mostly clear"
  const HOLD_CLEAR_SECONDS = Number.isFinite(holdClearSeconds) ? holdClearSeconds : currentSettings.revealHoldSeconds;
  const revealSeconds = Math.max(roundSeconds - HOLD_CLEAR_SECONDS, 3);
  flagImg.style.transition = "none";
  setBlur(MAX_BLUR_PX);
  // Force the browser to apply the instant reset above before we attach
  // the transition, otherwise it can animate FROM the old value.
  void flagImg.offsetWidth;
  requestAnimationFrame(() => {
    flagImg.style.transition = `filter ${revealSeconds}s linear`;
    setBlur(MIN_BLUR_PX);
  });
}

function startCountdown(seconds) {
  stopCountdown();
  let remaining = seconds;
  roundTimerEl.textContent = remaining;
  countdownInterval = setInterval(() => {
    remaining -= 1;
    roundTimerEl.textContent = Math.max(remaining, 0);
    if (remaining <= 0) stopCountdown();
  }, 1000);
}
function stopCountdown() {
  if (countdownInterval) clearInterval(countdownInterval);
}

function renderLeaderboard(list) {
  if (!list || list.length === 0) {
    leaderboardEl.textContent = "Waiting for the first correct guess…";
  } else {
    const items = list
      .map((e, i) => `<span class="tk-rank">${i + 1}.</span>${avatarChipHtml(e.username, e.avatarUrl, 16)}${escapeHtml(e.username)} — ${e.points}pt`)
      .join('<span class="tk-sep">•</span>');
    leaderboardEl.innerHTML = `🏆 Top explorers ${items}`;
  }
  restartTickerAnimation();
}

// Rebuilding ticker content doesn't automatically restart its CSS
// animation from the beginning — this forces a reflow so updates don't
// look glitchy mid-scroll.
function restartTickerAnimation() {
  leaderboardEl.style.animation = "none";
  void leaderboardEl.offsetWidth;
  leaderboardEl.style.animation = "";
}

function showToast(text, kind) {
  const t = document.createElement("div");
  t.className = "toast " + kind;
  t.textContent = text;
  toastLayer.appendChild(t);
  setTimeout(() => t.remove(), 2700);
}

// Lightweight celebration: a big winner-name banner over the flag plus a
// short confetti burst. Kept cheap on purpose (small fixed particle count,
// pure CSS transforms, nodes removed right after animating) so it stays
// smooth even on a lower-end Android phone mid-broadcast.
function celebrateWinner(username, avatarUrl) {
  const banner = document.createElement("div");
  banner.className = "winner-banner";
  banner.innerHTML = `🏆 ${avatarChipHtml(username, avatarUrl, 28)}<span>${escapeHtml(username)}</span> got it!`;
  document.getElementById("game-screen").appendChild(banner);
  setTimeout(() => banner.remove(), 2200);

  const colors = ["#C99117", "#4B8C3C", "#D9663D", "#3A8FB7", "#7F52B8", "#C9527C"];
  const originX = window.innerWidth / 2;
  const originY = window.innerHeight * 0.32;
  const PARTICLE_COUNT = 22;

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const p = document.createElement("span");
    p.className = "confetti-piece";
    const angle = (Math.PI * 2 * i) / PARTICLE_COUNT + Math.random() * 0.4;
    const distance = 90 + Math.random() * 110;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - 40; // slight upward bias
    p.style.left = `${originX}px`;
    p.style.top = `${originY}px`;
    p.style.background = colors[i % colors.length];
    p.style.setProperty("--dx", `${dx}px`);
    p.style.setProperty("--dy", `${dy}px`);
    p.style.setProperty("--rot", `${Math.random() * 540 - 270}deg`);
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 1000);
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Deterministic colored-initial fallback, same convention used
// platform-wide — shown whenever a viewer's real TikTok profile picture
// isn't available or fails to load.
const AVATAR_PALETTE = ["#e0699c", "#4fa0c4", "#6faa5c", "#e0a934", "#9c6fd1", "#e0724a", "#3aa6a6", "#c4577a"];
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
function avatarColorFor(name) { return AVATAR_PALETTE[hashString(name || "?") % AVATAR_PALETTE.length]; }
function avatarInitial(name) { const c = String(name || "").trim(); return c ? c[0].toUpperCase() : "?"; }
function avatarChipHtml(name, avatarUrl, sizePx) {
  sizePx = sizePx || 18;
  const initial = escapeHtml(avatarInitial(name));
  const color = avatarColorFor(name);
  const title = escapeHtml(name || "Unknown viewer");
  if (avatarUrl) {
    return `<span class="avatarChip" style="width:${sizePx}px;height:${sizePx}px;" title="${title}">` +
      `<img class="avatarChipImg" alt="" referrerpolicy="no-referrer" src="${escapeHtml(avatarUrl)}" ` +
      `onerror="this.parentElement.classList.add('avatarChipFallback');this.parentElement.style.background='${color}';this.replaceWith('${initial}')" /></span>`;
  }
  return `<span class="avatarChip avatarChipFallback" style="width:${sizePx}px;height:${sizePx}px;background:${color};" title="${title}">${initial}</span>`;
}
