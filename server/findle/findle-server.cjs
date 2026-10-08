// =============================================================
// Findle Live — server module
// A TikTok LIVE-powered themed word-search game (the classic word-search
// mechanic): each round shows a theme and a letter grid; several
// theme-related words are hidden in the grid. Viewers find them by
// typing the word as a normal TikTok LIVE comment.
//
// This is the same game logic as the original standalone findle-server.js,
// wrapped as registerFindle(app, rootIO) so it can be mounted on the
// platform's existing Express app + Socket.IO server instead of creating
// its own. Namespaced under Socket.IO namespace "/findle" and static
// routes under "/findle-public", per findle-MERGE-NOTES.md.
// =============================================================

const path = require("path");
const tiktokLib = require("tiktok-live-connector");
const PUZZLES = require("./findle-puzzles.cjs");
const { generatePuzzleGrid } = require("./findle-grid-generator.cjs");

// The tiktok-live-connector library has renamed its main class before
// (WebcastPushConnection -> TikTokLiveConnection) and may do so again.
// Rather than hardcode one name, grab whichever one actually exists.
const TikTokConnectionClass =
  tiktokLib.TikTokLiveConnection ||
  tiktokLib.WebcastPushConnection ||
  tiktokLib.default;
if (!TikTokConnectionClass) {
  console.error("[findle] Could not find a usable class in tiktok-live-connector. Real TikTok connections will fail, but Test Mode will still work.");
}
const CHAT_EVENT_NAME = (tiktokLib.WebcastEvent && tiktokLib.WebcastEvent.CHAT) || "chat";

const COMBO_WINDOW_SECONDS = 14;
const MAX_MSGID_CACHE = 300;
const DEDUP_TEXT_WINDOW_MS = 4000;

// Time to answer is unlimited (see MERGE-NOTES / round-completion notes
// below) - "timeLimit" was removed from here on purpose. Difficulty
// still controls grid size and scoring (basePoints/timeDecay/hintPenalty)
// exactly as before; timeDecay still gently rewards a FASTER find over a
// slower one, it just never forces the round to end.
const DIFFICULTY_SETTINGS = {
  easy:   { gridSize: 9,  basePoints: 8,  perLetter: 1, timeDecay: 0.12, hintPenalty: 1 },
  medium: { gridSize: 10, basePoints: 12, perLetter: 1, timeDecay: 0.10, hintPenalty: 2 },
  hard:   { gridSize: 11, basePoints: 16, perLetter: 1, timeDecay: 0.08, hintPenalty: 2 },
};

function registerFindle(app, rootIO) {
  const io = rootIO.of("/findle");

  app.use("/findle-public", require("express").static(path.join(__dirname, "findle-public")));
  app.get(["/findle", "/findle/"], (req, res) => res.redirect("/findle-public/findle-host.html"));
  app.get(["/findle/display", "/findle/display/"], (req, res) => res.redirect("/findle-public/findle-display.html"));

  // ---- state ----
  const state = {
    connection: {
      mode: "idle",
      tiktokUsername: null,
      statusMessage: "Not connected yet.",
      eventCount: 0,
      lastReceived: null,
      rawSamplesLogged: 0,
    },
    game: {
      status: "waiting",
      difficulty: "easy",
      theme: null,
      gridSize: 0,
      grid: null,
      words: [],
      hintsUsed: 0,
      roundStartedAt: null,
      pauseStartedAt: null,
      usedThemes: [],
      comboCount: 0,
      lastFindAt: 0,
      bestCombo: 0,
    },
    leaderboard: {},
    feed: [],
    settings: {
      autoAdvanceDelaySeconds: 3,
      leaderboardDisplaySeconds: 3,
    },
  };

  const recentMsgIds = new Set();
  const recentMsgIdOrder = [];
  let recentTextSignatures = [];

  let autoAdvanceTimer = null;
  let testModeTimer = null;
  let tiktokConnection = null;

  function resetDedupCaches() {
    recentMsgIds.clear();
    recentMsgIdOrder.length = 0;
    recentTextSignatures = [];
  }

  function isDuplicateEvent(rawData, username, text) {
    const msgId = getFirst(rawData, ["msgId", "common.msgId", "data.msgId", "data.common.msgId", "messageId"]);
    if (msgId) {
      const key = String(msgId);
      if (recentMsgIds.has(key)) return true;
      recentMsgIds.add(key);
      recentMsgIdOrder.push(key);
      if (recentMsgIdOrder.length > MAX_MSGID_CACHE) {
        recentMsgIds.delete(recentMsgIdOrder.shift());
      }
      return false;
    }
    const now = Date.now();
    const sig = username + "\u0001" + (text || "").trim().toLowerCase();
    recentTextSignatures = recentTextSignatures.filter((e) => now - e.time <= DEDUP_TEXT_WINDOW_MS);
    const isDup = recentTextSignatures.some((e) => e.sig === sig);
    recentTextSignatures.push({ sig, time: now });
    return isDup;
  }

  function comboMultiplier(count) {
    if (count >= 4) return 1.5;
    if (count === 3) return 1.3;
    if (count === 2) return 1.15;
    return 1;
  }

  function safeMsg(err) {
    try { return (err && err.message) ? err.message : String(err); } catch (e) { return "unknown error"; }
  }

  function computeClearedGrid(gridSize, words) {
    const usedByAnyWord = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));
    const remainingUsers = Array.from({ length: gridSize }, () => Array(gridSize).fill(0));
    words.forEach((w) => {
      w.cells.forEach(([r, c]) => {
        usedByAnyWord[r][c] = true;
        if (!w.found) remainingUsers[r][c]++;
      });
    });
    return Array.from({ length: gridSize }, (_, r) =>
      Array.from({ length: gridSize }, (_, c) => usedByAnyWord[r][c] && remainingUsers[r][c] === 0)
    );
  }

  function broadcastState() {
    io.emit("state", buildPublicState());
  }

  function buildPublicState() {
    const g = state.game;
    return {
      connection: state.connection,
      settings: state.settings,
      game: {
        status: g.status,
        difficulty: g.difficulty,
        theme: g.theme,
        gridSize: g.gridSize,
        grid: g.grid,
        words: g.words.map((w) => ({
          length: w.length,
          found: w.found,
          foundBy: w.foundBy,
          foundByAvatar: w.found ? w.foundByAvatar || null : null,
          cells: w.found ? w.cells : null,
          word: w.found ? w.word : null,
          hint: buildHintString(w),
        })),
        wordsFound: g.words.filter((w) => w.found).length,
        wordsTotal: g.words.length,
        clearedGrid: g.grid ? computeClearedGrid(g.gridSize, g.words) : null,
        combo: { count: g.comboCount, multiplier: comboMultiplier(g.comboCount) },
      },
      leaderboard: getTopN(10),
      feed: state.feed.slice(0, 30),
    };
  }

  function buildHintString(w) {
    if (w.found) return w.word;
    return w.hintMask.map((revealed, i) => (revealed ? w.word[i] : "_")).join("");
  }

  function getTopN(n) {
    return Object.entries(state.leaderboard)
      .map(([username, v]) => ({ username, score: v.score, name: v.name || username, avatarUrl: v.avatarUrl || null }))
      .sort((a, b) => b.score - a.score)
      .slice(0, n);
  }

  function broadcastDiagnostic(level, message) {
    io.emit("diagnostic", { level, message, time: Date.now() });
  }

  function pushFeed(entry) {
    state.feed.unshift(entry);
    if (state.feed.length > 50) state.feed.pop();
  }

  function pickPuzzle(difficulty) {
    const bank = PUZZLES[difficulty] || PUZZLES.easy;
    const unused = bank.filter((p) => !state.game.usedThemes.includes(p.theme));
    const pool = unused.length ? unused : bank;
    if (!unused.length) state.game.usedThemes = [];
    const puzzle = pool[Math.floor(Math.random() * pool.length)];
    state.game.usedThemes.push(puzzle.theme);
    return puzzle;
  }

  function startRound() {
    clearTimeout(autoAdvanceTimer);

    const settings = DIFFICULTY_SETTINGS[state.game.difficulty] || DIFFICULTY_SETTINGS.easy;
    const puzzle = pickPuzzle(state.game.difficulty);
    const { grid, placements, size } = generatePuzzleGrid(puzzle.words, settings.gridSize);

    state.game.status = "playing";
    state.game.theme = puzzle.theme;
    state.game.gridSize = size;
    state.game.grid = grid;
    state.game.hintsUsed = 0;
    state.game.roundStartedAt = Date.now();
    state.game.comboCount = 0;
    state.game.lastFindAt = 0;
    state.game.bestCombo = 0;
    state.game.words = puzzle.words.map((word) => {
      const upper = word.toUpperCase();
      return {
        word: upper,
        length: upper.length,
        cells: placements[upper] || [],
        found: false,
        foundBy: null,
        points: 0,
        hintMask: new Array(upper.length).fill(false),
      };
    });

    pushFeed({ type: "system", text: `New puzzle: "${puzzle.theme}" — find ${state.game.words.length} hidden words!`, time: Date.now() });
    broadcastState();
  }

  // Time to answer is unlimited: there is no round clock/countdown of any
  // kind anymore, and a round only ends when every word has been found
  // ("cleared" - see handleGuess below) or the host stops/skips it.
  // pause/resume still exist as plain host actions (e.g. to freeze the
  // board without a time penalty) - they just no longer coordinate with
  // any timer.
  function pauseRound() {
    const g = state.game;
    if (g.status !== "playing") return;
    g.status = "paused";
    g.pauseStartedAt = Date.now();
    broadcastState();
  }

  function resumeRound() {
    const g = state.game;
    if (g.status !== "paused") return;
    if (g.pauseStartedAt) {
      const pausedMs = Date.now() - g.pauseStartedAt;
      g.roundStartedAt += pausedMs;
      g.pauseStartedAt = null;
    }
    g.status = "playing";
    broadcastState();
  }

  function stopRound() {
    clearTimeout(autoAdvanceTimer);
    const g = state.game;
    g.status = "waiting";
    g.theme = null;
    g.grid = null;
    g.gridSize = 0;
    g.words = [];
    g.comboCount = 0;
    g.lastFindAt = 0;
    g.bestCombo = 0;
    pushFeed({ type: "system", text: "⏹ Game stopped by host.", time: Date.now() });
    broadcastState();
  }

  function revealOneHintLetter() {
    const g = state.game;
    if (g.status !== "playing") return;
    const candidates = g.words.filter((w) => {
      if (w.found) return false;
      const hiddenCount = w.hintMask.filter((h) => !h).length;
      return hiddenCount > 1;
    });
    if (!candidates.length) return;
    const target = candidates[Math.floor(Math.random() * candidates.length)];
    const hiddenIdx = target.hintMask
      .map((revealed, i) => (revealed ? -1 : i))
      .filter((i) => i !== -1);
    const idx = hiddenIdx[Math.floor(Math.random() * hiddenIdx.length)];
    target.hintMask[idx] = true;
    g.hintsUsed++;
  }

  function endRound(reason) {
    const g = state.game;
    g.status = "roundEnd";

    // "timeout" can no longer happen (no more clock), but the branch is
    // kept as a no-op fallback rather than removed outright, in case a
    // host action from an older client build somewhere still sends it.
    if (reason === "timeout") {
      const remaining = g.words.filter((w) => !w.found);
      remaining.forEach((w) => { w.found = true; w.foundBy = null; });
    } else {
      const comboNote = g.bestCombo >= 2 ? ` (best combo x${comboMultiplier(g.bestCombo)})` : "";
      pushFeed({ type: "win", text: `🎉 Puzzle cleared! Great teamwork, chat!${comboNote}`, time: Date.now() });
    }

    const recap = g.words
      .filter((w) => w.foundBy)
      .map((w) => ({ word: w.word, foundBy: w.foundBy, points: w.points }));

    broadcastState();
    io.emit("puzzleComplete", {
      cleared: reason === "cleared",
      bestCombo: g.bestCombo,
      recap,
      theme: g.theme,
      leaderboard: getTopN(10),
      leaderboardDisplaySeconds: state.settings.leaderboardDisplaySeconds,
    });

    autoAdvanceTimer = setTimeout(() => startRound(), state.settings.autoAdvanceDelaySeconds * 1000);
  }

  function computeWordScore(settings, word, hintsUsedAtGuessTime, elapsedSeconds) {
    const base = settings.basePoints + word.length * settings.perLetter;
    const timePenalty = Math.min(elapsedSeconds * settings.timeDecay, base * 0.5);
    const hintPenalty = hintsUsedAtGuessTime * settings.hintPenalty;
    return Math.max(3, Math.round(base - timePenalty - hintPenalty));
  }

  function handleGuess(username, displayName, rawText) {
    const g = state.game;
    if (g.status !== "playing") return false;
    const guess = (rawText || "").trim().toLowerCase();
    if (!guess) return false;

    const target = g.words.find((w) => !w.found && w.word.toLowerCase() === guess);
    if (!target) return false;

    const settings = DIFFICULTY_SETTINGS[g.difficulty] || DIFFICULTY_SETTINGS.easy;
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - g.roundStartedAt) / 1000);
    const basePoints = computeWordScore(settings, target.word, g.hintsUsed, elapsedSeconds);

    const withinWindow = g.lastFindAt && (now - g.lastFindAt) / 1000 <= COMBO_WINDOW_SECONDS;
    g.comboCount = withinWindow ? g.comboCount + 1 : 1;
    g.lastFindAt = now;
    g.bestCombo = Math.max(g.bestCombo, g.comboCount);
    const multiplier = comboMultiplier(g.comboCount);
    const points = Math.round(basePoints * multiplier);

    target.found = true;
    target.foundBy = displayName || username;
    target.foundByAvatar = knownAvatars.get(username) || null;
    target.points = points;

    if (!state.leaderboard[username]) state.leaderboard[username] = { score: 0, name: displayName };
    state.leaderboard[username].score += points;
    state.leaderboard[username].name = displayName || username;
    state.leaderboard[username].avatarUrl = knownAvatars.get(username) || null;

    const comboTag = multiplier > 1 ? ` 🔥 combo x${multiplier}` : "";
    pushFeed({ type: "win", text: `✅ ${target.foundBy} found "${target.word}" (+${points} pts)${comboTag}`, time: Date.now() });
    io.emit("wordFound", { word: target.word, foundBy: target.foundBy, foundByAvatar: target.foundByAvatar, points, comboCount: g.comboCount, multiplier });

    const allFound = g.words.every((w) => w.found);
    if (allFound) {
      endRound("cleared");
    } else {
      broadcastState();
    }
    return true;
  }

  function getFirst(obj, paths) {
    for (const p of paths) {
      try {
        const parts = p.split(".");
        let cur = obj;
        for (const part of parts) {
          if (cur == null) break;
          cur = cur[part];
        }
        if (cur !== undefined && cur !== null && cur !== "") return cur;
      } catch (e) { /* try next path */ }
    }
    return null;
  }

  function extractComment(data) {
    return getFirst(data, ["comment", "text", "content", "message", "data.comment", "data.text"]);
  }
  function extractUsername(data) {
    return getFirst(data, [
      "uniqueId", "userId",
      "user.uniqueId", "user.uniqueid", "user.userId", "user.id",
      "author.uniqueId", "data.uniqueId", "data.user.uniqueId",
    ]);
  }
  function extractDisplayName(data) {
    return getFirst(data, [
      "nickname", "user.nickname", "user.nickName", "displayName",
      "author.nickname", "data.nickname", "data.user.nickname",
    ]) || extractUsername(data) || "viewer";
  }
  function extractAvatar(data) {
    return getFirst(data, [
      "user.profilePictureUrl", "user.avatarThumb.urlList.0", "user.avatarMedium.urlList.0",
      "user.avatarLarger.urlList.0", "user.avatarUrl", "profilePictureUrl", "avatarUrl", "avatarThumb.urlList.0",
    ]);
  }

  // Remembers each viewer's most-recently-seen profile picture for the
  // life of the server process, so the real TikTok avatar can be shown
  // next to their name on the found-word credit and the leaderboard, not
  // just on the raw chat message that happened to carry it.
  const knownAvatars = new Map();

  function processIncomingChat(rawData, source) {
    try {
      const username = extractUsername(rawData) || "unknown";
      const displayName = extractDisplayName(rawData);
      const text = extractComment(rawData) || "";
      const avatarUrl = extractAvatar(rawData);
      if (avatarUrl) knownAvatars.set(username, avatarUrl);

      if (isDuplicateEvent(rawData, username, text)) return;

      state.connection.eventCount++;

      if (state.connection.rawSamplesLogged < 5) {
        state.connection.rawSamplesLogged++;
        console.log(`[findle RAW SAMPLE #${state.connection.rawSamplesLogged}]`, JSON.stringify(rawData));
        broadcastDiagnostic("raw", `Raw sample #${state.connection.rawSamplesLogged}: ${JSON.stringify(rawData).slice(0, 800)}`);
      }

      state.connection.lastReceived = { user: displayName, text, time: Date.now() };
      pushFeed({ type: "chat", user: displayName, text, time: Date.now() });

      const matched = handleGuess(username, displayName, text);
      if (!matched) broadcastState();
    } catch (err) {
      console.error(`[findle:processIncomingChat:${source}] error:`, err);
      broadcastDiagnostic("error", "A chat message caused an error but was safely skipped.");
    }
  }

  async function connectToTikTok(username, attempt = 1) {
    const MAX_ATTEMPTS = 3;
    state.connection.mode = "connecting";
    state.connection.tiktokUsername = username;
    state.connection.statusMessage = `Connecting to @${username} (attempt ${attempt} of ${MAX_ATTEMPTS})...`;
    state.connection.eventCount = 0;
    resetDedupCaches();
    state.connection.rawSamplesLogged = 0;
    broadcastState();

    try {
      if (tiktokConnection) {
        try { tiktokConnection.disconnect(); } catch (e) {}
      }

      if (!TikTokConnectionClass) {
        throw new Error("The tiktok-live-connector library did not load correctly (no connection class found).");
      }

      const options = {};
      if (process.env.EULERSTREAM_API_KEY || process.env.TIKTOK_SIGN_API_KEY) {
        options.signApiKey = process.env.EULERSTREAM_API_KEY || process.env.TIKTOK_SIGN_API_KEY;
      }

      tiktokConnection = new TikTokConnectionClass(username, options);

      tiktokConnection.on(CHAT_EVENT_NAME, (data) => processIncomingChat(data, "chat"));

      tiktokConnection.on("streamEnd", () => {
        state.connection.statusMessage = "The TikTok LIVE stream ended.";
        state.connection.mode = "idle";
        broadcastState();
      });

      tiktokConnection.on("disconnected", () => {
        if (state.connection.mode === "live") {
          state.connection.statusMessage = "Disconnected from TikTok LIVE.";
          state.connection.mode = "idle";
          broadcastState();
        }
      });

      tiktokConnection.on("error", (err) => {
        console.error("[findle:tiktokConnection:error]", err);
        broadcastDiagnostic("error", "TikTok connection reported an error: " + safeMsg(err));
      });

      await tiktokConnection.connect();

      try {
        const { Engagement } = await import("../engagement/engagement-hub.js");
        Engagement.attach(tiktokConnection, { game: "findle", tiktokUsername: username });
      } catch (engErr) {
        console.error("[findle] Could not attach shared Engagement module:", engErr);
      }

      state.connection.mode = "live";
      state.connection.statusMessage = `✅ Connected! Reading live chat from @${username}.`;
      broadcastState();
    } catch (err) {
      console.error(`[findle:connectToTikTok] attempt ${attempt} failed:`, err);
      if (attempt < MAX_ATTEMPTS) {
        const backoffMs = attempt * 2000;
        state.connection.statusMessage = `Connection attempt ${attempt} failed. Retrying in ${backoffMs / 1000}s...`;
        broadcastState();
        setTimeout(() => connectToTikTok(username, attempt + 1), backoffMs);
      } else {
        state.connection.mode = "error";
        state.connection.statusMessage =
          "Could not connect after 3 tries. Common causes: the account is not currently LIVE, the username is misspelled, or the sign-in key (EulerStream) is missing/invalid. " +
          friendlyErrorHint(err);
        broadcastState();
      }
    }
  }

  function friendlyErrorHint(err) {
    const msg = safeMsg(err).toLowerCase();
    if (msg.includes("live") || msg.includes("offline")) return "That account does not look like it is live right now.";
    if (msg.includes("sign") || msg.includes("key") || msg.includes("401") || msg.includes("403")) return "This usually means the EulerStream sign-in key is missing or incorrect.";
    return "";
  }

  function disconnectTikTok() {
    if (tiktokConnection) {
      try { tiktokConnection.disconnect(); } catch (e) {}
    }
    tiktokConnection = null;
    state.connection.mode = "idle";
    state.connection.statusMessage = "Disconnected.";
    broadcastState();
  }

  const FAKE_USERS = ["alex_98", "gamerqueen", "tiktok_fan22", "wordwiz", "night_owl", "sunnyday", "quickfox", "letterluv"];
  const FAKE_CHATTER = ["hi!", "this is fun", "hmm let me think", "lol", "gogogo", "not sure", "🔥🔥🔥", "wait i see one"];

  function startTestMode() {
    stopTestMode();
    state.connection.mode = "test";
    state.connection.tiktokUsername = null;
    state.connection.statusMessage = "🧪 Test Mode running — simulated viewers are commenting.";
    state.connection.eventCount = 0;
    resetDedupCaches();
    state.connection.rawSamplesLogged = 0;
    broadcastState();

    testModeTimer = setInterval(() => {
      try {
        const user = FAKE_USERS[Math.floor(Math.random() * FAKE_USERS.length)];
        let text;
        const g = state.game;
        const unfound = g.status === "playing" ? g.words.filter((w) => !w.found) : [];
        if (unfound.length && Math.random() < 0.18) {
          text = unfound[Math.floor(Math.random() * unfound.length)].word;
        } else {
          text = FAKE_CHATTER[Math.floor(Math.random() * FAKE_CHATTER.length)];
        }
        processIncomingChat({ uniqueId: user, nickname: user, comment: text }, "testmode");
      } catch (err) {
        console.error("[findle:testMode] error:", err);
      }
    }, 1200);
  }

  function stopTestMode() {
    clearInterval(testModeTimer);
    testModeTimer = null;
  }

  io.on("connection", (socket) => {
    socket.emit("state", buildPublicState());

    socket.on("host:connectTikTok", (payload) => {
      const username = (payload && payload.username || "").trim().replace(/^@/, "");
      if (!username) {
        broadcastDiagnostic("error", "Please enter a TikTok username first.");
        return;
      }
      stopTestMode();
      connectToTikTok(username);
    });

    socket.on("host:disconnectTikTok", () => disconnectTikTok());

    socket.on("host:toggleTestMode", () => {
      if (state.connection.mode === "test") {
        stopTestMode();
        state.connection.mode = "idle";
        state.connection.statusMessage = "Test Mode stopped.";
        broadcastState();
      } else {
        disconnectTikTok();
        startTestMode();
      }
    });

    socket.on("host:setDifficulty", (payload) => {
      const d = payload && payload.difficulty;
      if (["easy", "medium", "hard"].includes(d)) {
        state.game.difficulty = d;
        broadcastState();
      }
    });

    socket.on("host:startGame", () => startRound());
    socket.on("host:nextWord", () => startRound());
    socket.on("host:pauseGame", () => pauseRound());
    socket.on("host:resumeGame", () => resumeRound());
    socket.on("host:stopGame", () => stopRound());

    socket.on("host:revealHint", () => {
      revealOneHintLetter();
      broadcastState();
    });

    socket.on("host:resetLeaderboard", () => {
      state.leaderboard = {};
      broadcastState();
    });

    socket.on("host:updateSettings", (payload) => {
      const clamp = (n, min, max, fallback) => {
        const v = Number(n);
        if (!Number.isFinite(v)) return fallback;
        return Math.min(max, Math.max(min, Math.round(v)));
      };
      if (payload && payload.autoAdvanceDelaySeconds !== undefined) {
        state.settings.autoAdvanceDelaySeconds = clamp(payload.autoAdvanceDelaySeconds, 1, 30, state.settings.autoAdvanceDelaySeconds);
      }
      if (payload && payload.leaderboardDisplaySeconds !== undefined) {
        state.settings.leaderboardDisplaySeconds = clamp(payload.leaderboardDisplaySeconds, 1, 30, state.settings.leaderboardDisplaySeconds);
      }
      broadcastState();
    });

    socket.on("host:sendMessage", (payload) => {
      const text = (payload && payload.text || "").trim();
      if (!text) return;
      pushFeed({ type: "host", user: "HOST", text, time: Date.now() });
      io.emit("hostMessage", { text, time: Date.now() });
    });

    socket.on("disconnect", () => {});
  });

  console.log("[findle] registered on namespace /findle (static at /findle-public)");
}

module.exports = { registerFindle };
