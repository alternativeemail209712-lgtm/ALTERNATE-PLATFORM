// codedle-server.js
// CODEDLE - a BLINDLE sibling built on the SEQUENC-O idea.
//
// THE CODE: at the start of every round the board shows a row of numbers - one per letter of
// the hidden word. Each number is the position its letter would take if the letters of the
// hidden word were SORTED ALPHABETICALLY (1 = the alphabetically first letter). Repeated
// letters are numbered left to right. Example: "tell" sorts to e-l-l-t, so its code is 4 1 2 3.
//
// THE CLUES: after every guess each tile gets one of five colors:
//     green  = right letter in the right spot
//     yellow = the letter is in the word, but in a different spot
//     blue   = the letter is close to the hidden letter of that spot (within 3 letters of the
//              alphabet, e.g. B is close to A..E) - and it is not a yellow letter
//     pink   = BOTH of the above: the letter is in the word AND within 3 letters of the hidden
//              letter of that spot
//     gray   = the letter is not in the word (and not close to that spot's letter)
// Duplicates follow Wordle's counting: greens use up their letter first, then yellows are
// handed out left to right until the hidden word has no unused copies of that letter left.
// A copy that is "used up" can still be blue (if close) or gray. This reproduces every row of
// the SEQUENC-O screenshots.
//
// Everything else follows BLINDLE (and RANGEDLE, which this file was copied from): unlimited
// guesses for the whole chat, an automatic starter word opens each round (switchable), unlimited
// hints, Live / Test / Offline modes, host-set secret word, difficulty tiers, win celebration +
// leaderboards.
//
// Guess rule: any real word of the right length that is not already on the board is accepted
// and colored (it does NOT have to match the code - guesses are probes). The host can switch
// BLINDLE's "must fit every earlier clue" rule on in Settings ("Strict fit").
//
// Differences from BLINDLE:
//   - the clue is one of five colors per LETTER, plus the numeric code row on top of the board
//   - the keyboard is NOT a manual scratchpad: every key colors itself with the best color
//     that letter has earned in any guess this round (green > pink > yellow > blue), except that a
//     letter CONFIRMED gray (not in the word) always shows gray, even if it was blue before
//   - scoring: 1 point for every guess that fits the board, 5 points for solving the round
//
// Transport: like ORACLE / COLORBLINDLE / TEXTLE / RANGEDLE it runs on its own Socket.IO
// namespace "/codedle" (NOT a raw WebSocket path), so it can never collide with BLINDLE's
// WebSocketServer. Mounts at /codedle.

import "dotenv/config";
import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { TikTokLiveConnection, WebcastEvent, SignConfig } from "tiktok-live-connector";
import { ANSWER_WORDS, MIN_WORD_LENGTH, MAX_WORD_LENGTH } from "../blindle/blindle-answers.js";
import { Engagement } from "../engagement/engagement-hub.js";
import { resolveHostAvatar, adoptHostAvatar, isHostUser } from "../shared/host-avatar.js";
import { getStrictFit, setStrictFit } from "../shared/strict-fit-store.js";
import { getStarterWord, setStarterWord } from "../shared/starter-word-store.js";
import { getKeyAutoColor, setKeyAutoColor } from "../shared/key-autocolor-store.js";
import { dictionaryState, loadDictionary, isValidGuessWord } from "../blindle/blindle-dictionary.js";
import { buildDifficultyIndex, getWordsForDifficulty } from "../blindle/blindle-difficulty.js";

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

// ------------------------------------------------------------------
// THE CODE (the numbers shown at the top of the board)
// ------------------------------------------------------------------
// Rank of every letter if the word's letters were sorted alphabetically (ties: left to right).
//   "tell" -> [4, 1, 2, 3]      "adversary" -> [1, 3, 8, 4, 5, 7, 2, 6, 9]
function buildCode(word) {
  const order = word.split("").map((ch, i) => ({ ch, i }));
  order.sort((x, y) => (x.ch < y.ch ? -1 : x.ch > y.ch ? 1 : x.i - y.i));
  const code = new Array(word.length);
  order.forEach((item, rank) => {
    code[item.i] = rank + 1;
  });
  return code;
}

// ------------------------------------------------------------------
// THE CLUE COLORS
// ------------------------------------------------------------------
//   0 = green   1 = yellow   2 = blue   3 = pink   4 = gray
const CLOSE_RANGE = 3; // "close" = within 3 letters of the alphabet (A..D, B..E, ...)
const GREEN = 0, YELLOW = 1, BLUE = 2, PINK = 3, GRAY = 4;

function scoreClue(guess, answer) {
  const n = answer.length;
  const out = new Array(n).fill(GRAY);
  const unused = {}; // copies of each letter of the answer not yet matched

  // Pass 1: greens use up their letter first.
  for (let i = 0; i < n; i++) {
    if (guess[i] === answer[i]) out[i] = GREEN;
    else unused[answer[i]] = (unused[answer[i]] || 0) + 1;
  }
  // Pass 2: everything else, left to right.
  for (let i = 0; i < n; i++) {
    if (out[i] === GREEN) continue;
    const inWord = (unused[guess[i]] || 0) > 0; // yellow condition (a copy is still available)
    if (inWord) unused[guess[i]] -= 1;
    const close = Math.abs(guess.charCodeAt(i) - answer.charCodeAt(i)) <= CLOSE_RANGE; // blue condition
    out[i] = inWord ? (close ? PINK : YELLOW) : close ? BLUE : GRAY;
  }
  return out;
}

function cluesEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

const COLOR_NAMES = ["Green", "Yellow", "Blue", "Pink", "Gray"];
function formatClue(c) {
  return c.map((v) => COLOR_NAMES[v][0]).join(" ");
}

// Keyboard: the color each letter shows, worked out over EVERY guess this round.
//   1. A letter that is CONFIRMED ABSENT always shows GRAY, whatever color it wore before.
//      Confirmed absent = in some guess it got a gray tile and no tile of that same letter in
//      that same guess was green / yellow / pink (so the gray is not just a used-up duplicate
//      copy of a letter that IS in the word). Gray wins over blue - a letter that was blue once
//      and is later confirmed gray turns gray.
//   2. Otherwise the best color earned: green > pink > yellow > blue.
const KEY_PRIORITY = [GREEN, PINK, YELLOW, BLUE, GRAY];
function buildLetterStates(guesses) {
  const best = {};
  const absent = new Set();
  for (const g of guesses) {
    const inWordHere = new Set(); // letters with a green / yellow / pink tile in this guess
    for (let i = 0; i < g.word.length; i++) {
      const c = g.clue[i];
      if (c === GREEN || c === YELLOW || c === PINK) inWordHere.add(g.word[i]);
    }
    for (let i = 0; i < g.word.length; i++) {
      const letter = g.word[i];
      if (g.clue[i] === GRAY && !inWordHere.has(letter)) absent.add(letter);
      const rank = KEY_PRIORITY.indexOf(g.clue[i]);
      if (best[letter] === undefined || rank < KEY_PRIORITY.indexOf(best[letter])) best[letter] = g.clue[i];
    }
  }
  for (const letter of absent) best[letter] = GRAY; // confirmed gray beats any earlier color
  return best;
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

// Points: 1 for every guess that fits the board, 5 for the guess that solves the round.
const WIN_POINTS = 5;
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
  // false (default): any real, not-yet-guessed word is accepted. true: BLINDLE's rule - the guess
  // must also fit the colors of every guess already on the board.
  strictFit: getStrictFit("codedle"),
  // true (default): the on-screen keyboard colors itself from the tiles. Host can switch it off.
  keyAutoColor: getKeyAutoColor("codedle"),
  // true (default): every round opens with one automatic, never-winning starter word so chat has
  // a first set of colors to read. Host can switch it off in Settings (remembered in data/starter-word.json).
  starterWord: getStarterWord("codedle"),
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
    if (!cluesEqual(scoreClue(past.word, word), past.clue)) {
      return { ok: false, conflictIndex: i, conflictWord: past.word, conflictClue: past.clue };
    }
  }
  return { ok: true };
}

function processGuess(word, caller) {
  const clue = scoreClue(word, game.secretWord);
  const avatarUrl = knownAvatars.get(caller) || null;
  game.guesses.push({ word, clue, caller, avatarUrl });

  if (word === game.secretWord) {
    // Solving the round is worth WIN_POINTS (5) instead of the 1 point a plain valid guess earns.
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

  const consistency = game.strictFit ? checkConsistency(word) : { ok: true };
  if (!consistency.ok) {
    const reason = `Doesn't fit the colors of guess #${consistency.conflictIndex + 1} (${consistency.conflictWord.toUpperCase()}: ${formatClue(consistency.conflictClue)})`;
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
// points to anyone - so its per-letter colors give viewers an
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
  const clue = scoreClue(starter, game.secretWord);
  game.guesses.push({ word: starter, clue, caller: STARTER_GUESS_LABEL, avatarUrl: null, isStarter: true });
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
  if (typeof settings.starterWord === "boolean") game.starterWord = setStarterWord("codedle", settings.starterWord);

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

// Hint: suggests a word that BEST FITS everything on the board - it prefers words whose own code
// equals the hidden word's code (the numbers on screen), then words that reproduce as many of the
// colors on the board as possible. Never the answer itself, never a word already on the board and
// never the same hint twice. Picked at random among the few best fits so repeated hints vary.
function useHint() {
  if (game.status !== "live") return;

  let candidates = getWordsForDifficulty(ANSWER_WORDS, difficultyIndex, game.wordLength, game.difficulty);
  if (candidates.length === 0) candidates = ANSWER_WORDS[game.wordLength] || [];
  const onBoard = new Set(game.guesses.map((g) => g.word));
  candidates = candidates.filter(
    (w) => w !== game.secretWord && !onBoard.has(w) && !game.hintSuggestions.includes(w)
  );
  if (candidates.length === 0) return;

  const secretCode = buildCode(game.secretWord);
  const scored = candidates.map((w) => {
    let fit = cluesEqual(buildCode(w), secretCode) ? 1000 : 0;
    for (const g of game.guesses) {
      const c = scoreClue(g.word, w);
      for (let i = 0; i < c.length; i++) if (c[i] === g.clue[i]) fit++;
    }
    return { w, fit };
  });
  scored.sort((a, b) => b.fit - a.fit);
  const top = scored.slice(0, Math.min(5, scored.length));
  const suggestion = top[Math.floor(Math.random() * top.length)].w;
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
      Engagement.attach(connection, { game: "codedle", tiktokUsername: username });
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

// `nsp` is the Socket.IO namespace "/codedle", created inside mountCodedle() below -
// broadcastState() and the namespace's "connection" handler both close over it.
let nsp = null;

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
      roundNumber: game.roundNumber,
      // THE CODE shown above the board (null while idle). It is the clue of the round, not the answer.
      code: game.status === "idle" || !game.secretWord ? null : buildCode(game.secretWord),
      // Best color of every letter used in ANY guess this round (covers every guess, not just the
      // last 12 sent in `guesses`). The page paints the keyboard from this.
      letterStates: game.status === "idle" ? {} : buildLetterStates(game.guesses),
      streak: game.streak,
      hintsUsed: game.hintsUsed,
      hintSuggestions: game.hintSuggestions,
      lastRejection: game.lastRejection,
      strictFit: game.strictFit,
      keyAutoColor: game.keyAutoColor,
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
  if (!nsp) return; // not mounted yet - nothing to broadcast to
  if (broadcastPending) return;
  broadcastPending = true;
  setTimeout(
    () => {
      broadcastPending = false;
      try {
        nsp.emit("state", buildStatePayload());
      } catch (err) {
        console.error("[SAFETY-NET] Error broadcasting state:", err);
      }
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
      ws.emit("set_secret_word_result", result);
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
      ws.emit("offline_guess_result", result);
      break;
    }
    case "set_key_autocolor":
      game.keyAutoColor = setKeyAutoColor("codedle", Boolean(payload && payload.on));
      broadcastState();
      break;
    case "set_starter_word":
      game.starterWord = setStarterWord("codedle", Boolean(payload && payload.on));
      broadcastState();
      break;
    case "set_strict_fit":
      game.strictFit = setStrictFit("codedle", Boolean(payload && payload.on));
      broadcastState();
      break;
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
// Mounting into the platform
// ============================================================
//   import { mountCodedle } from "./server/codedle/codedle-server.js";
//   await mountCodedle(app, io, { mountPath: "/codedle" });
//
// `app` is the shared Express app, `io` the shared Socket.IO Server. CODEDLE serves its own
// static folder at `mountPath` and talks to its page over the Socket.IO namespace "/codedle".
// Call once per process (a second call would start a second dictionary load and a second
// auto-continue timer against the same shared game state).
export async function mountCodedle(app, io, options = {}) {
  const mountPath = options.mountPath || "/codedle";

  app.use(mountPath, express.static(path.join(__dirname, "public")));
  app.get(mountPath, (req, res) => {
    res.sendFile(path.join(__dirname, "public", "codedle-index.html"));
  });

  nsp = io.of("/codedle");
  nsp.on(
    "connection",
    safely("codedle-connection", (socket) => {
      socket.emit("state", buildStatePayload());
      socket.on(
        "action",
        safely("codedle-action", (msg) => {
          if (!msg || typeof msg !== "object") return;
          handleClientAction(socket, msg);
        })
      );
    })
  );

  // Awaited so the real ~370,000-word dictionary is loaded before the server starts
  // accepting live chat guesses (otherwise correctly spelled guesses could be rejected
  // right after a fresh deploy).
  await loadDictionary();
  console.log(
    `[CODEDLE] Mounted at ${mountPath} (Socket.IO namespace /codedle). ` +
      (diagnostics.signKeyConfigured
        ? "EulerStream signing key detected - TikTok connections are ready."
        : "No EULERSTREAM_API_KEY found - Test Mode will work, but live TikTok connections will not.")
  );

  return { mountPath };
}

// ============================================================
// Standalone mode
// ============================================================
// Lets you test this game entirely on its own (`node codedle-server.js`)
// without touching your platform's code at all. This block only runs
// when the file is EXECUTED DIRECTLY, never when it's imported by
// mountCodedle above - importing it (the normal merge path) never
// opens a port or starts listening on its own.
const isRunDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isRunDirectly) {
  const { Server } = await import("socket.io");
  const standaloneApp = express();
  const standaloneServer = http.createServer(standaloneApp);
  const standaloneIo = new Server(standaloneServer);
  await mountCodedle(standaloneApp, standaloneIo, { mountPath: "/" });
  const PORT = process.env.PORT || 3000;
  standaloneServer.listen(PORT, () => {
    console.log(`[CODEDLE] Standalone test server listening on port ${PORT}`);
  });
}
