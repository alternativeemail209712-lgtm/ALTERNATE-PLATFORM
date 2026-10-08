// server.js
// BLINDLE - faithful to the real word500.com feedback mechanic:
//   - Each guess only reveals COUNTS: how many letters are green
//     (right letter, right spot), yellow (right letter, wrong spot),
//     and red (not in the word) - never which letters those are.
//
// Adapted for a fully automated TikTok LIVE audience:
//   - Guessing is UNLIMITED. Anyone can guess, any number of times.
//     There is no attempt pool and no per-round voting window - every
//     matching chat comment is evaluated immediately.
//   - The catch: a guess is only accepted if it's logically CONSISTENT
//     with every clue already revealed this round (i.e. it could still
//     be the answer, given what's been learned so far). A guess that
//     contradicts an earlier clue is rejected with a brief on-screen
//     note - this is what keeps unlimited guessing meaningful instead
//     of just spamming random words.
//   - The on-screen keyboard AND each guessed word's letter tiles are
//     a manual, host-only scratchpad - click to cycle red -> yellow ->
//     green -> none. The server never colors anything automatically.
//   - Hints are unlimited and suggest a word consistent with every
//     clue so far - but never the literal secret word.
//   - Difficulty (Normal / Medium / Hard) is a 4-factor score over
//     vocabulary, word structure, candidate ambiguity, and feedback
//     informativeness - see difficulty.js. It controls which secret
//     words are eligible, not how much information is given.
//
// This build also adds three modes for a TikTok LIVE context:
//   - Live    : real TikTok LIVE chat, guesses count toward leaderboards
//   - Test    : simulated fake chat, same mechanics, scores NOT saved
//   - Offline : host types guesses directly, no chat/leaderboard involved
// In Live and Test, the host can also directly set the secret word at
// any time from the bottom control bar.

import "dotenv/config";
import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer } from "ws";
import { TikTokLiveConnection, WebcastEvent, SignConfig } from "tiktok-live-connector";
import { explainTikTokError } from "../shared/tiktok-errors.js";
import { ANSWER_WORDS, MIN_WORD_LENGTH, MAX_WORD_LENGTH } from "./blindle-answers.js";
import { Engagement } from "../engagement/engagement-hub.js";
import { resolveHostAvatar, adoptHostAvatar, isHostUser } from "../shared/host-avatar.js";
import { getStrictFit, setStrictFit } from "../shared/strict-fit-store.js";
import { getStarterWord, setStarterWord } from "../shared/starter-word-store.js";
import { dictionaryState, loadDictionary, isValidGuessWord } from "./blindle-dictionary.js";
import { buildDifficultyIndex, getWordsForDifficulty } from "./blindle-difficulty.js";

process.on("uncaughtException", (err) => {
  console.error("[SAFETY-NET] Uncaught exception (server keeps running):", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[SAFETY-NET] Unhandled rejection (server keeps running):", reason);
});

function safely(label, fn) {
  return (...args) => {
    try {
      fn(...args);
    } catch (err) {
      console.error(`[SAFETY-NET] Error inside "${label}" handler:`, err);
    }
  };
}

function getByPath(obj, dottedPath) {
  const parts = dottedPath.split(".");
  let current = obj;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return current;
}

function extractField(raw, candidatePaths, fallback) {
  for (const p of candidatePaths) {
    const value = getByPath(raw, p);
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return fallback;
}

const USERNAME_PATHS = [
  "uniqueId", "uniqueid", "user.uniqueId", "user.uniqueid", "user.username",
  "username", "nickname", "user.nickname", "author.uniqueId", "author.nickname", "data.uniqueId"
];
const MESSAGE_PATHS = ["comment", "message", "content", "text", "msg", "data.comment", "data.message"];
const AVATAR_PATHS = [
  "user.profilePictureUrl", "user.avatarThumb.urlList.0", "user.avatarMedium.urlList.0",
  "user.avatarLarger.urlList.0", "user.avatarUrl", "profilePictureUrl", "avatarUrl", "avatarThumb.urlList.0"
];

function extractChatFields(raw) {
  const username = String(extractField(raw, USERNAME_PATHS, "viewer"));
  const text = String(extractField(raw, MESSAGE_PATHS, ""));
  const avatarUrl = extractField(raw, AVATAR_PATHS, null);
  return { username, text, avatarUrl };
}

// Remembers each viewer's most-recently-seen profile picture for the
// life of the server process (not tied to any one round), so the real
// TikTok avatar can be shown next to every guess, win, and leaderboard
// row that mentions them — not just the raw chat message that happened
// to carry it. Host-typed guesses and Test/Offline mode simply have no
// entry here, and the client falls back to a colored initial circle.
const knownAvatars = new Map();

// The profile picture of the HOST of the current TikTok LIVE session (the
// account this game is connected to). Shown on the automatic "starter word"
// row instead of a generic initial circle. Null when not connected to a live
// session (Test / Offline mode) or when TikTok didn't provide one.
let hostAvatarUrl = null;

function normalizeGuess(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z]/g, "")
    .trim();
}

function scoreCounts(guess, answer) {
  const n = answer.length;
  const guessLetters = guess.split("");
  const answerLetters = answer.split("");
  const remaining = {};
  for (const letter of answerLetters) remaining[letter] = (remaining[letter] || 0) + 1;

  let green = 0;
  const matchedGuessIndex = new Array(n).fill(false);
  for (let i = 0; i < n; i++) {
    if (guessLetters[i] === answerLetters[i]) {
      green++;
      matchedGuessIndex[i] = true;
      remaining[guessLetters[i]] -= 1;
    }
  }
  let yellow = 0;
  for (let i = 0; i < n; i++) {
    if (matchedGuessIndex[i]) continue;
    const letter = guessLetters[i];
    if (remaining[letter] > 0) {
      yellow++;
      remaining[letter] -= 1;
    }
  }
  const red = n - green - yellow;
  return { green, yellow, red };
}

function countsEqual(a, b) {
  return a.green === b.green && a.yellow === b.yellow && a.red === b.red;
}

function formatCounts(c) {
  return `${c.green}g/${c.yellow}y/${c.red}r`;
}

const difficultyIndex = buildDifficultyIndex(ANSWER_WORDS);

const DEFAULT_AUTO_CONTINUE_DELAY = 3;
const DEFAULT_LEADERBOARD_SHOW_SECONDS = 3;
const DEFAULT_REJECTION_TOAST_SECONDS = 4;
// The win celebration always walks through 3 stages (winner, this-round
// leaderboard, all-time leaderboard), each shown for leaderboardShowSeconds.
// Auto-continue must never cut that celebration short, so when a round is
// WON we add this celebration runtime on top of the configured delay (see
// processGuess below). A "give up" / timeout loss has no celebration, so
// it keeps using autoContinueDelaySeconds on its own (see giveUp below).
const CELEBRATION_STAGE_COUNT = 3;

// Points awarded per guess. Solving it is worth 10x a plain wrong-but-
// valid guess (which still earns a small participation point), same
// ratio as the original 100/10 split, just at a smaller scale.
const WIN_POINTS = 10;
const GUESS_POINTS = 1;

const game = {
  mode: "test",
  status: "idle",
  wordLength: 5,
  difficulty: "normal",
  // "fixed" plays game.wordLength every round (as before); "random"
  // picks a new random length inside [lengthMin, lengthMax] (still
  // filtered by `difficulty`) at the start of every round.
  lengthMode: "fixed",
  lengthMin: 4,
  lengthMax: 8,
  secretWord: null,
  guesses: [],
  streak: 0,
  roundNumber: 0, // bumps every time a new round starts - the page uses it to clear its manual colors
  hintsUsed: 0,
  hintSuggestions: [],
  lastRejection: null,
  // STRICT FIT (update 25): ON by default; the host can switch it off in Settings (remembered in
  // data/strict-fit.json). ON = a guess must fit every clue already on the board. OFF = any real
  // word of the right length is accepted and colored, so chat can probe freely.
  strictFit: getStrictFit("blindle"),
  // true (default): every round opens with one automatic, never-winning starter word.
  // The host can switch it off in Settings (remembered in data/starter-word.json).
  starterWord: getStarterWord("blindle"),
  lastWinInfo: null, // { username, points, word } - set the instant a round is won
  recentComments: [],
  usedWords: new Set(),
  roundScores: new Map(),
  totalScores: new Map(),
  autoContinue: false,
  autoContinueDelaySeconds: DEFAULT_AUTO_CONTINUE_DELAY,
  autoContinueAt: null,
  leaderboardShowSeconds: DEFAULT_LEADERBOARD_SHOW_SECONDS,
  rejectionToastSeconds: DEFAULT_REJECTION_TOAST_SECONDS
};

function clampWordLength(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 5;
  return Math.min(MAX_WORD_LENGTH, Math.max(MIN_WORD_LENGTH, Math.round(v)));
}

function randomWordLengthInRange() {
  const lo = clampWordLength(game.lengthMin);
  const hi = Math.max(lo, clampWordLength(game.lengthMax));
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function pickAnswer(wordLength, difficulty) {
  const candidates = getWordsForDifficulty(ANSWER_WORDS, difficultyIndex, wordLength, difficulty);
  const unused = candidates.filter((w) => !game.usedWords.has(w));
  const list = unused.length > 0 ? unused : candidates;
  if (unused.length === 0) game.usedWords.clear();
  const pick = list[Math.floor(Math.random() * list.length)];
  game.usedWords.add(pick);
  return pick;
}

function awardPoints(caller, points) {
  if (game.mode !== "live" || !caller) return;
  game.roundScores.set(caller, (game.roundScores.get(caller) || 0) + points);
  game.totalScores.set(caller, (game.totalScores.get(caller) || 0) + points);
}

function checkConsistency(word) {
  for (let i = 0; i < game.guesses.length; i++) {
    const past = game.guesses[i];
    if (!countsEqual(scoreCounts(past.word, word), past.counts)) {
      return { ok: false, conflictIndex: i, conflictWord: past.word, conflictCounts: past.counts };
    }
  }
  return { ok: true };
}

function processGuess(word, caller) {
  const counts = scoreCounts(word, game.secretWord);
  const avatarUrl = knownAvatars.get(caller) || null;
  game.guesses.push({ word, counts, caller, avatarUrl });

  if (word === game.secretWord) {
    // Scaled down from the original 100/10 split to 10/1, keeping the
    // same 10x relationship between solving it and a wrong-but-valid
    // guess (which still earns a small participation point).
    const points = game.mode === "live" ? WIN_POINTS : null;
    awardPoints(caller, WIN_POINTS);
    game.status = "won";
    game.streak += 1;
    game.lastWinInfo = { username: caller, points, word, avatarUrl };
  } else {
    awardPoints(caller, GUESS_POINTS);
  }

  if (game.status === "won" && game.autoContinue) {
    // Wait out the full win celebration (winner → this round's leaderboard
    // → all-time leaderboard, each shown for leaderboardShowSeconds) before
    // even starting the configured auto-continue delay, so a new round
    // never interrupts the all-time leaderboard window mid-display.
    const celebrationSeconds = game.leaderboardShowSeconds * CELEBRATION_STAGE_COUNT;
    game.autoContinueAt = Date.now() + (celebrationSeconds + game.autoContinueDelaySeconds) * 1000;
  }
}

function attemptGuess(word, caller) {
  if (game.status !== "live") return { ok: false, error: "No round in progress." };

  // A word already on the board is never accepted twice (otherwise one viewer could farm the
  // 1-point-per-guess reward by repeating a word). Silent for chat; offline shows the message.
  if (game.guesses.some((g) => g.word === word)) {
    return { ok: false, error: "That word is already on the board.", duplicate: true };
  }

  // Strict fit ON (default): the guess must fit the green/yellow/red counts of every guess on the board.
  const consistency = game.strictFit ? checkConsistency(word) : { ok: true };
  if (!consistency.ok) {
    const reason = `Conflicts with guess #${consistency.conflictIndex + 1} (${consistency.conflictWord.toUpperCase()}: ${formatCounts(consistency.conflictCounts)})`;
    game.lastRejection = { word, reason, at: Date.now() };
    return { ok: false, error: reason, rejected: true };
  }

  processGuess(word, caller);
  return { ok: true };
}

// A round used to open on a totally blank board, so the very first
// audience guess had zero information to reason from. Every round now
// opens with one random, automatically-played guess before any audience
// guessing happens - never the secret word itself, and never worth
// points to anyone - so its green/yellow/red counts give viewers an
// immediate starting clue instead of a cold guess.
const STARTER_GUESS_LABEL = "🎲 Starter word";

function pickStarterWord(wordLength) {
  const pool = getWordsForDifficulty(ANSWER_WORDS, difficultyIndex, wordLength, "random")
    .filter((w) => w !== game.secretWord);
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

function seedStarterGuess() {
  if (!game.starterWord) return;
  const starter = pickStarterWord(game.wordLength);
  if (!starter) return; // nothing eligible at this length - round still starts fine, just blank
  const counts = scoreCounts(starter, game.secretWord);
  game.guesses.push({ word: starter, counts, caller: STARTER_GUESS_LABEL, avatarUrl: null, isStarter: true });
}

function startRound(overrideWord) {
  if (!overrideWord && game.lengthMode === "random") {
    game.wordLength = randomWordLengthInRange();
  }
  game.secretWord = overrideWord || pickAnswer(game.wordLength, game.difficulty);
  game.guesses = [];
  game.hintsUsed = 0;
  game.hintSuggestions = [];
  game.lastRejection = null;
  game.lastWinInfo = null;
  game.roundScores.clear();
  game.status = "live";
  game.roundNumber += 1;
  game.autoContinueAt = null;
  seedStarterGuess();
  broadcastState();
}

function validateWord(raw, wordLength) {
  const word = normalizeGuess(raw);
  if (!word) return null;
  if (word.length !== wordLength) return null;
  return word;
}

function applySettings(settings) {
  const mode = settings.mode;
  const wordLength = settings.wordLength;
  const difficulty = settings.difficulty;
  const lengthMode = settings.lengthMode;
  const lengthMin = settings.lengthMin;
  const lengthMax = settings.lengthMax;
  const autoContinue = settings.autoContinue;
  const autoContinueDelaySeconds = settings.autoContinueDelaySeconds;

  if (["live", "test", "offline"].includes(mode)) {
    if (mode !== "live" && game.mode === "live") stopEverything();
    game.mode = mode;
    if (mode !== "live") {
      diagnostics.connectionStatus = mode === "test" ? "test_mode" : "idle";
      diagnostics.lastErrorMessage = null;
    }
  }
  if (wordLength !== undefined) game.wordLength = clampWordLength(wordLength);
  if (["normal", "medium", "hard", "random"].includes(difficulty)) game.difficulty = difficulty;
  if (["fixed", "random"].includes(lengthMode)) game.lengthMode = lengthMode;
  if (lengthMin !== undefined || lengthMax !== undefined) {
    let lo = clampWordLength(lengthMin !== undefined ? lengthMin : game.lengthMin);
    let hi = clampWordLength(lengthMax !== undefined ? lengthMax : game.lengthMax);
    if (lo > hi) [lo, hi] = [hi, lo]; // never let the range invert
    game.lengthMin = lo;
    game.lengthMax = hi;
  }
  if (typeof autoContinue === "boolean") game.autoContinue = autoContinue;
  if (autoContinueDelaySeconds !== undefined) {
    const v = Number(autoContinueDelaySeconds);
    game.autoContinueDelaySeconds = Number.isFinite(v) ? Math.min(120, Math.max(3, Math.round(v))) : DEFAULT_AUTO_CONTINUE_DELAY;
  }

  startRound();
}

function playAgain() {
  startRound();
}

function setSecretWord(rawWord) {
  const validated = validateWord(rawWord, game.wordLength);
  if (!validated) {
    return { ok: false, error: `Must be exactly ${game.wordLength} letters, A-Z only.` };
  }
  startRound(validated);
  return { ok: true };
}

function giveUp() {
  if (game.status !== "live") return;
  game.status = "lost";
  game.streak = 0;
  if (game.autoContinue) game.autoContinueAt = Date.now() + game.autoContinueDelaySeconds * 1000;
  broadcastState();
}

function endGame() {
  game.status = "idle";
  game.secretWord = null;
  game.guesses = [];
  game.autoContinueAt = null;
  broadcastState();
}

function useHint() {
  if (game.status !== "live") return;

  let candidates = getWordsForDifficulty(ANSWER_WORDS, difficultyIndex, game.wordLength, game.difficulty);
  candidates = candidates.filter((w) => w !== game.secretWord);
  for (const g of game.guesses) {
    candidates = candidates.filter((w) => countsEqual(scoreCounts(g.word, w), g.counts));
  }
  candidates = candidates.filter((w) => !game.hintSuggestions.includes(w));

  if (candidates.length === 0) return;
  const suggestion = candidates[Math.floor(Math.random() * candidates.length)];
  game.hintSuggestions.push(suggestion);
  game.hintsUsed += 1;
  broadcastState();
}

function getLeaderboard(map) {
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([username, score]) => ({ username, score, avatarUrl: knownAvatars.get(username) || null }));
}

setInterval(
  safely("auto-continue-tick", () => {
    if (!game.autoContinueAt) return;
    if (Date.now() >= game.autoContinueAt) {
      game.autoContinueAt = null;
      playAgain();
    } else {
      broadcastState(true);
    }
  }),
  1000
);

const diagnostics = {
  rawEventCount: 0,
  lastReceivedUser: null,
  lastReceivedText: null,
  lastReceivedAt: null,
  connectionStatus: "idle",
  retryAttempt: 0,
  maxRetries: 3,
  lastErrorMessage: null,
  signKeyConfigured: Boolean(process.env.EULERSTREAM_API_KEY),
  tiktokUsername: null
};

function handleIncomingRawEvent(raw) {
  diagnostics.rawEventCount += 1;
  const { username, text, avatarUrl } = extractChatFields(raw);
  diagnostics.lastReceivedUser = username;
  diagnostics.lastReceivedText = text;
  diagnostics.lastReceivedAt = Date.now();
  if (avatarUrl) knownAvatars.set(username, avatarUrl);
  if (avatarUrl && !hostAvatarUrl && game.mode === "live" && isHostUser(username, diagnostics.tiktokUsername)) {
    // late fallback: the host's own chat message carries their picture. The server downloads it and
    // serves its own copy (the raw TikTok link is often .heic / expired / blocked in the browser).
    adoptHostAvatar(diagnostics.tiktokUsername, avatarUrl).then((url) => {
      if (url && !hostAvatarUrl && game.mode === "live") {
        hostAvatarUrl = url;
        broadcastState();
      }
    });
  }

  game.recentComments.unshift({ username, text, avatarUrl: knownAvatars.get(username) || null, at: Date.now() });
  if (game.recentComments.length > 30) game.recentComments.length = 30;

  const normalized = normalizeGuess(text);
  if (
    game.status === "live" &&
    game.mode !== "offline" &&
    normalized.length === game.wordLength &&
    (normalized === game.secretWord || isValidGuessWord(normalized))
  ) {
    attemptGuess(normalized, username);
  }
  broadcastState();
}

let liveConnection = null;
let testModeTimer = null;
const RETRY_DELAYS_MS = [2000, 4000, 8000];

if (process.env.EULERSTREAM_API_KEY) {
  SignConfig.apiKey = process.env.EULERSTREAM_API_KEY;
}

function stopEverything() {
  hostAvatarUrl = null;
  if (liveConnection) {
    try {
      liveConnection.disconnect();
    } catch (err) {
      console.error("[SAFETY-NET] Error while disconnecting:", err);
    }
    liveConnection = null;
  }
  if (testModeTimer) {
    clearInterval(testModeTimer);
    testModeTimer = null;
  }
}

async function connectToTikTok(username) {
  if (game.mode !== "live") {
    diagnostics.lastErrorMessage = "Switch to Live mode first, then connect.";
    broadcastState();
    return;
  }
  if (!diagnostics.signKeyConfigured) {
    diagnostics.connectionStatus = "error";
    diagnostics.lastErrorMessage = "No signing key set up yet. Add EULERSTREAM_API_KEY in Render before connecting.";
    broadcastState();
    return;
  }

  stopEverything();
  diagnostics.tiktokUsername = username;
  diagnostics.connectionStatus = "connecting";
  diagnostics.retryAttempt = 0;
  diagnostics.lastErrorMessage = null;
  broadcastState();

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      const connection = new TikTokLiveConnection(username, {
        signApiKey: process.env.EULERSTREAM_API_KEY
      });

      connection.on(WebcastEvent.CHAT, safely("chat-event", (data) => handleIncomingRawEvent(data)));
      connection.on(
        WebcastEvent.DISCONNECTED,
        safely("disconnected-event", () => {
          diagnostics.connectionStatus = "disconnected";
          broadcastState();
        })
      );
      connection.on(
        "reconnected",
        safely("reconnected-event", () => {
          diagnostics.connectionStatus = "live";
          diagnostics.lastErrorMessage = null;
          broadcastState();
        })
      );
      connection.on(
        WebcastEvent.ERROR,
        safely("error-event", (err) => console.error("[TikTok] connection error event:", err))
      );
      connection.on(
        WebcastEvent.STREAM_END,
        safely("stream-end-event", () => {
          diagnostics.connectionStatus = "disconnected";
          diagnostics.lastErrorMessage = "The TikTok LIVE broadcast ended.";
          broadcastState();
        })
      );

      const connectState = await connection.connect();
      liveConnection = connection;
      Engagement.attach(connection, { game: "blindle", tiktokUsername: username });
      diagnostics.connectionStatus = "live";
      diagnostics.lastErrorMessage = null;
      broadcastState();
      // Look up the host's profile picture (for the starter-word row) without
      // holding up the connection; broadcast again once it's known.
      resolveHostAvatar(connection, connectState, username, () => liveConnection !== connection).then((url) => {
        if (url && liveConnection === connection) {
          hostAvatarUrl = url;
          broadcastState();
        }
      });
      return;
    } catch (err) {
      console.error(`[TikTok] Connect attempt ${attempt + 1} failed:`, err?.message || err);
      diagnostics.retryAttempt = attempt + 1;
      diagnostics.lastErrorMessage = "Try " + (attempt + 1) + " failed. " + describeConnectError(err);
      const isLastAttempt = attempt === RETRY_DELAYS_MS.length;
      if (isLastAttempt) {
        diagnostics.connectionStatus = "error";
        diagnostics.lastErrorMessage = describeConnectError(err);
        broadcastState();
        return;
      }
      diagnostics.connectionStatus = "retrying";
      broadcastState();
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
}

function describeConnectError(err) {
  return explainTikTokError(err, (typeof diagnostics !== "undefined" && diagnostics && diagnostics.tiktokUsername) || "");
}
// (older generic wording, no longer used)
function describeConnectErrorLegacy(err) {
  const message = String(err?.message || err || "").toLowerCase();
  if (message.includes("not found") || message.includes("does not exist")) {
    return "That TikTok username couldn't be found. Double-check the spelling.";
  }
  if (message.includes("offline") || message.includes("not live") || message.includes("live_not_found")) {
    return "That account doesn't look like it's LIVE right now.";
  }
  if (message.includes("sign") || message.includes("key") || message.includes("401") || message.includes("403")) {
    return "The signing key was rejected. Check that EULERSTREAM_API_KEY in Render is correct.";
  }
  return "Couldn't connect to TikTok LIVE. Make sure the account is LIVE right now, wait about a minute, then press Connect again (TikTok sometimes limits requests from the server).";
}

const FAKE_USERNAMES = [
  "comet_fan", "wordwiz99", "livstream_lu", "night.owl", "byte_buddy", "quiz.queen", "pixel_pete"
];
const FAKE_JUNK_WORDS = ["hi", "lol", "go team", "so fun", "love this game", "hmm", "wait what"];

function startTestMode() {
  stopEverything();
  diagnostics.connectionStatus = "test_mode";
  diagnostics.lastErrorMessage = null;
  diagnostics.tiktokUsername = null;

  testModeTimer = setInterval(
    safely("test-mode-tick", () => {
      if (game.mode !== "test") return;
      const username = FAKE_USERNAMES[Math.floor(Math.random() * FAKE_USERNAMES.length)];
      const roll = Math.random();
      let text;

      if (game.status === "live" && game.secretWord && roll < 0.06) {
        text = game.secretWord;
      } else if (game.status === "live" && roll < 0.4) {
        const pool = getWordsForDifficulty(ANSWER_WORDS, difficultyIndex, game.wordLength, game.difficulty);
        text = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : FAKE_JUNK_WORDS[0];
      } else {
        text = FAKE_JUNK_WORDS[Math.floor(Math.random() * FAKE_JUNK_WORDS.length)];
      }

      const shapeVariant = Math.floor(Math.random() * 3);
      let fakeRaw;
      if (shapeVariant === 0) fakeRaw = { uniqueId: username, comment: text };
      else if (shapeVariant === 1) fakeRaw = { user: { uniqueId: username, nickname: username }, message: text };
      else fakeRaw = { nickname: username, content: text };

      handleIncomingRawEvent(fakeRaw);
    }),
    900
  );
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// `wss` is created inside mountWord500() below, once the host platform
// hands us its http.Server - broadcastState() and the ws "connection"
// handler both close over this module-level binding.
let wss = null;

function buildStatePayload() {
  return {
    game: {
      mode: game.mode,
      status: game.status,
      wordLength: game.wordLength,
      difficulty: game.difficulty,
      lengthMode: game.lengthMode,
      lengthMin: game.lengthMin,
      lengthMax: game.lengthMax,
      secretWord: game.status === "lost" ? game.secretWord : null,
      // The automatic starter word shows the LIVE host's profile picture.
      guesses: game.guesses.slice(-12).map((g) => (g.isStarter ? { ...g, avatarUrl: hostAvatarUrl } : g)),
      guessesMade: game.guesses.length,
      usedLetters: [...new Set(game.guesses.flatMap((g) => g.word.split("")))],
      roundNumber: game.roundNumber,
      // Letters that are provably NOT in the word: every letter of any guess whose
      // green AND yellow counts are both 0 (so all of its letters are red). Covers
      // every guess this round, not just the last 12 sent in `guesses`. The page
      // paints these red automatically.
      zeroLetters: game.status === "idle"
        ? []
        : [...new Set(game.guesses.filter((g) => g.counts.green === 0 && g.counts.yellow === 0).flatMap((g) => g.word.split("")))],
      streak: game.streak,
      hintsUsed: game.hintsUsed,
      hintSuggestions: game.hintSuggestions,
      lastRejection: game.lastRejection,
      strictFit: game.strictFit,
      starterWord: game.starterWord,
      lastWinInfo: game.lastWinInfo,
      autoContinue: game.autoContinue,
      autoContinueDelaySeconds: game.autoContinueDelaySeconds,
      leaderboardShowSeconds: game.leaderboardShowSeconds,
      rejectionToastSeconds: game.rejectionToastSeconds,
      autoContinueSecondsLeft: game.autoContinueAt ? Math.max(0, Math.ceil((game.autoContinueAt - Date.now()) / 1000)) : 0,
      minWordLength: MIN_WORD_LENGTH,
      maxWordLength: MAX_WORD_LENGTH
    },
    roundLeaderboard: getLeaderboard(game.roundScores),
    totalLeaderboard: getLeaderboard(game.totalScores),
    recentComments: game.recentComments.slice(0, 12),
    diagnostics: {
      ...diagnostics,
      dictionarySource: dictionaryState.source,
      dictionaryWordCount: dictionaryState.wordCount,
      dictionaryLoading: dictionaryState.loading
    }
  };
}

let broadcastPending = false;
function broadcastState(lightweight = false) {
  if (!wss) return; // not mounted yet - nothing to broadcast to
  if (broadcastPending) return;
  broadcastPending = true;
  setTimeout(
    () => {
      broadcastPending = false;
      const payload = JSON.stringify({ type: "state", payload: buildStatePayload() });
      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          try {
            client.send(payload);
          } catch (err) {
            console.error("[SAFETY-NET] Error sending to a client:", err);
          }
        }
      });
    },
    lightweight ? 0 : 100
  );
}

function handleClientAction(ws, msg) {
  const type = msg && msg.type;
  const payload = msg && msg.payload;
  switch (type) {
    case "connect_tiktok":
      if (testModeTimer) {
        clearInterval(testModeTimer);
        testModeTimer = null;
      }
      connectToTikTok(String((payload && payload.username) || "").trim().replace(/^@/, ""));
      break;
    case "disconnect_tiktok":
      stopEverything();
      diagnostics.connectionStatus = "idle";
      diagnostics.tiktokUsername = null;
      broadcastState();
      break;
    case "apply_settings":
      applySettings(payload || {});
      if (game.mode === "test") {
        startTestMode();
      } else if (game.mode === "live") {
        // Stay connected if we already were - only stop the Test Mode
        // simulator (if it happened to still be running). This was the
        // bug: previously ANY apply_settings while in Live mode force-
        // disconnected TikTok, requiring a manual reconnect every time.
        if (testModeTimer) {
          clearInterval(testModeTimer);
          testModeTimer = null;
        }
      } else {
        stopEverything();
      }
      break;
    case "play_again":
      playAgain();
      break;
    case "give_up":
      giveUp();
      break;
    case "end_game":
      endGame();
      break;
    case "use_hint":
      useHint();
      break;
    case "set_secret_word": {
      const result = setSecretWord(String((payload && payload.word) || ""));
      ws.send(JSON.stringify({ type: "set_secret_word_result", payload: result }));
      break;
    }
    case "submit_offline_guess": {
      const word = normalizeGuess(String((payload && payload.word) || ""));
      let result;
      if (word.length !== game.wordLength) {
        result = { ok: false, error: `Guess must be ${game.wordLength} letters.` };
      } else if (word !== game.secretWord && !isValidGuessWord(word)) {
        result = { ok: false, error: "That's not in the word list." };
      } else {
        result = attemptGuess(word, "Host");
        broadcastState();
      }
      ws.send(JSON.stringify({ type: "offline_guess_result", payload: result }));
      break;
    }
    case "reset_round_leaderboard":
      game.roundScores.clear();
      broadcastState();
      break;
    case "reset_total_leaderboard":
      game.totalScores.clear();
      broadcastState();
      break;
    case "set_leaderboard_show_seconds": {
      const v = Number(payload && payload.seconds);
      game.leaderboardShowSeconds = Number.isFinite(v) ? Math.min(30, Math.max(1, Math.round(v))) : DEFAULT_LEADERBOARD_SHOW_SECONDS;
      broadcastState();
      break;
    }
    case "set_starter_word":
      game.starterWord = setStarterWord("blindle", Boolean(payload && payload.on));
      broadcastState();
      break;
    case "set_strict_fit":
      game.strictFit = setStrictFit("blindle", Boolean(payload && payload.on));
      broadcastState();
      break;
    case "set_rejection_toast_seconds": {
      const v = Number(payload && payload.seconds);
      game.rejectionToastSeconds = Number.isFinite(v) ? Math.min(30, Math.max(1, Math.round(v))) : DEFAULT_REJECTION_TOAST_SECONDS;
      broadcastState();
      break;
    }
    default:
      break;
  }
}

// ============================================================
// Mounting into a host platform
// ============================================================
// Everything above this point is game logic only - no assumptions
// about routes, ports, or where this sits in a bigger app. This is
// the ONLY function another codebase needs to call:
//
//   import { mountBlindle } from "./games/blindle/blindle-server.js";
//   await mountBlindle(app, httpServer);
//
// `app` is your existing Express app, `httpServer` is the
// http.Server instance that app is (or will be) listening on - the
// same object you'd normally pass to app.listen() or that
// http.createServer(app) returns. BLINDLE is entirely namespaced
// under `mountPath` (default "/games/blindle") for its HTTP routes
// and static assets, and under `wsPath` (default "/blindle-ws") for
// its WebSocket traffic, so it will not collide with routes, static
// files, or other WebSocketServers belonging to other games mounted
// on the same app/server - each ws library WebSocketServer only
// reacts to upgrade requests whose URL matches its own `path`, so
// multiple games can each run their own WebSocketServer on one
// shared http.Server safely, as long as every game uses a distinct
// wsPath (this file's default of "/blindle-ws" is already
// game-specific and safe to leave as-is).
//
// Call this once per process. Calling it twice would start a second
// dictionary load and a second auto-continue timer against the same
// shared game state, which is never what you want.
//
// This is `async` and awaits the real ~370,000-word dictionary before
// returning, so the game never accepts live chat guesses during the
// few seconds where only the small built-in fallback list is loaded
// (which would otherwise make correctly-spelled guesses get rejected
// as "not a recognized word" right after a fresh deploy).
export async function mountBlindle(app, httpServer, options = {}) {
  const mountPath = options.mountPath || "/games/blindle";
  const wsPath = options.wsPath || "/blindle-ws";

  app.use(mountPath, express.static(path.join(__dirname, "public")));
  app.get(mountPath, (req, res) => {
    res.sendFile(path.join(__dirname, "public", "blindle-index.html"));
  });

  wss = new WebSocketServer({ server: httpServer, path: wsPath });
  wss.on(
    "connection",
    safely("ws-connection", (ws) => {
      ws.send(JSON.stringify({ type: "state", payload: buildStatePayload() }));
      ws.on(
        "message",
        safely("ws-message", (raw) => {
          let msg;
          try {
            msg = JSON.parse(raw.toString());
          } catch {
            return;
          }
          handleClientAction(ws, msg);
        })
      );
    })
  );

  await loadDictionary();
  console.log(
    `[BLINDLE] Mounted at ${mountPath} (WebSocket at ${wsPath}). ` +
      (diagnostics.signKeyConfigured
        ? "EulerStream signing key detected - TikTok connections are ready."
        : "No EULERSTREAM_API_KEY found - Test Mode will work, but live TikTok connections will not.")
  );

  return { mountPath, wsPath };
}

// ============================================================
// Standalone mode
// ============================================================
// Lets you test this game entirely on its own (`node blindle-server.js`)
// without touching your platform's code at all. This block only runs
// when the file is EXECUTED DIRECTLY, never when it's imported by
// mountBlindle above - importing it (the normal merge path) never
// opens a port or starts listening on its own.
const isRunDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isRunDirectly) {
  const standaloneApp = express();
  const standaloneServer = http.createServer(standaloneApp);
  // Mounted at "/" here so it behaves like a normal standalone site
  // when you're just testing it in isolation.
  await mountBlindle(standaloneApp, standaloneServer, { mountPath: "/", wsPath: "/blindle-ws" });
  const PORT = process.env.PORT || 3000;
  standaloneServer.listen(PORT, () => {
    console.log(`[BLINDLE] Standalone test server listening on port ${PORT}`);
  });
}
