// textle-server.js
// TEXTLE - an "ARRANG-O"-style TikTok LIVE word game (a sibling of BLINDLE).
//
// Same platform machinery as BLINDLE (unlimited guesses, optional clue-consistency check [OFF by default since Update 21],
// leaderboards, win celebration, Live/Test/Offline modes, hints, difficulty, engagement
// alerts) but with a different clue system - SEGMENTS instead of color counts:
//   - After every guess the guessed word is cut into colored SEGMENTS:
//       GREEN  - letters that match AND whose order corresponds to the hidden word
//                (a green segment is a run of letters that sits side by side in
//                BOTH the guess and the hidden word),
//       YELLOW - the letter is in the hidden word but has to be REARRANGED,
//       GRAY   - the letter is not in the hidden word (or every copy of it is already
//                used up by other letters of the guess). Neighbouring grays are merged.
//   - A green segment that touches the START (or END) of the guess and also sits at the
//     START (or END) of the hidden word gets a rounded edge on that side.
//   - The keyboard colors itself: a letter turns green once it was green in any guess,
//     yellow once it was yellow (and never green), gray once it was only ever gray.
//     There is NO manual coloring.
//   - Hidden words are 4-15 letters long by default (random every round); the host can
//     change the range anywhere from 4 up to 20 letters in Settings.
//
// Transport: runs on its own Socket.IO namespace "/textle" (like STRUCTLE / COLORDLE).
//
// ------------------------------------------------------------------
import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { TikTokLiveConnection, WebcastEvent, SignConfig } from "tiktok-live-connector";
import { explainTikTokError } from "../shared/tiktok-errors.js";
import { ANSWER_WORDS as EN_ANSWER_WORDS, MIN_WORD_LENGTH } from "./textle-answers.js";
import { Engagement } from "../engagement/engagement-hub.js";
import { resolveHostAvatar, adoptHostAvatar, isHostUser } from "../shared/host-avatar.js";
import { getStrictFit, setStrictFit } from "../shared/strict-fit-store.js";
import { getStarterWord, setStarterWord } from "../shared/starter-word-store.js";
import { getKeyAutoColor, setKeyAutoColor } from "../shared/key-autocolor-store.js";
import { dictionaryState, loadDictionary } from "../blindle/blindle-dictionary.js";
import { buildDifficultyIndex } from "../blindle/blindle-difficulty.js";
import * as WL from "../shared/word-language.js"; // update 48: word language

import { PlatformHub } from "../shared/platform-hub.js";
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

// Guesses may be ANY length (shorter or longer than the secret word) so viewers can probe
// letters without the answer's length ever being revealed. Only sane bounds are enforced.
const MIN_GUESS_LENGTH = 4;
const MAX_GUESS_LENGTH = 25;
function isGuessLengthOk(word) {
  return word.length >= MIN_GUESS_LENGTH && word.length <= MAX_GUESS_LENGTH;
}

function normalizeGuess(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z]/g, "")
    .trim();
}

// ---- TEXTLE clue engine (ARRANG-O style segments) -----------------------
// 1) GREEN letters = the longest set of guess letters that appear in the hidden word in the
//    same left-to-right order (a longest-common-subsequence match). Ties are broken by
//    preferring matches that sit side by side in BOTH words (so they merge into one
//    segment), then by using earlier letters of the guess.
// 2) Every other letter is YELLOW if the hidden word still has an unused copy of it
//    (counted left to right), otherwise GRAY.
// 3) Letters are cut into segments: a green run that is contiguous in both words is one
//    segment, consecutive grays are one segment, every yellow is its own segment.
const MATCH_W = 1000000;
const ADJACENT_W = 1000;

function greenMatches(guess, answer) {
  const n = guess.length;
  const m = answer.length;
  // best[i][j][a] = best score for guess[i..] vs answer[j..]; a = 1 when guess[i-1] was matched to answer[j-1].
  const best = [];
  for (let i = 0; i <= n; i++) {
    best.push([]);
    for (let j = 0; j <= m; j++) best[i].push([0, 0]);
  }
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      for (let a = 0; a <= 1; a++) {
        let v = Math.max(best[i + 1][j][0], best[i][j + 1][0]);
        if (guess[i] === answer[j]) {
          const take = MATCH_W + (a ? ADJACENT_W : 0) - i + best[i + 1][j + 1][1];
          if (take > v) v = take;
        }
        best[i][j][a] = v;
      }
    }
  }
  // Walk back through the table to read off which guess letters are green (and which answer index they matched).
  const green = new Array(n).fill(-1);
  let i = 0;
  let j = 0;
  let a = 0;
  while (i < n && j < m) {
    const v = best[i][j][a];
    if (guess[i] === answer[j]) {
      const take = MATCH_W + (a ? ADJACENT_W : 0) - i + best[i + 1][j + 1][1];
      if (take === v) {
        green[i] = j;
        i++; j++; a = 1;
        continue;
      }
    }
    if (best[i + 1][j][0] === v) { i++; a = 0; continue; }
    j++; a = 0;
  }
  return green;
}

// Returns an array of segments: { text, status: "green"|"yellow"|"gray", capL, capR }.
function computeClue(guess, answer) {
  const n = guess.length;
  const m = answer.length;
  const green = greenMatches(guess, answer);
  const remaining = {};
  for (const ch of answer) remaining[ch] = (remaining[ch] || 0) + 1;
  for (let i = 0; i < n; i++) if (green[i] >= 0) remaining[guess[i]] -= 1;

  const status = new Array(n);
  for (let i = 0; i < n; i++) {
    if (green[i] >= 0) { status[i] = "green"; continue; }
    const ch = guess[i];
    if (remaining[ch] > 0) { status[i] = "yellow"; remaining[ch] -= 1; } else status[i] = "gray";
  }

  const segments = [];
  let i = 0;
  while (i < n) {
    let k = i;
    if (status[i] === "green") {
      while (k + 1 < n && status[k + 1] === "green" && green[k + 1] === green[k] + 1) k++;
    } else if (status[i] === "gray") {
      while (k + 1 < n && status[k + 1] === "gray") k++;
    }
    segments.push({
      text: guess.slice(i, k + 1),
      status: status[i],
      capL: status[i] === "green" && i === 0 && green[0] === 0,
      capR: status[i] === "green" && k === n - 1 && green[n - 1] === m - 1
    });
    i = k + 1;
  }
  return segments;
}

// A compact string identifying exactly what a clue looks like on screen - two guesses
// "give the same clue" when this string matches.
const SIG_CODE = { green: "G", yellow: "Y", gray: "x" };
function clueSignature(segments) {
  return segments.map((s) => SIG_CODE[s.status] + s.text + (s.capL ? "(" : "") + (s.capR ? ")" : "")).join("|");
}

function formatClue(segments) {
  return segments.map((s) => `${s.text.toUpperCase()}=${s.status}`).join(" ");
}

// Rank used for the keyboard: green beats yellow beats gray.
const STATUS_RANK = { gray: 1, yellow: 2, green: 3 };
function keyStatusFromGuesses(guesses) {
  const best = {};
  for (const g of guesses) {
    for (const seg of g.clue) {
      for (const ch of seg.text) {
        if (!best[ch] || STATUS_RANK[seg.status] > STATUS_RANK[best[ch]]) best[ch] = seg.status;
      }
    }
  }
  return best;
}

// ---- WORD LANGUAGE (update 48) -------------------------------------------------------------
// The host picks the word language in Settings (English / Indonesian / Bahasa Melayu / 4 mixes).
// ANSWER_WORDS, MAX_WORD_LENGTH and the difficulty index follow that choice.
const WORD_GAME_ID = "textle";
let wordLanguage = WL.getLanguage(WORD_GAME_ID);
let ANSWER_WORDS = WL.getBank(wordLanguage, EN_ANSWER_WORDS).answers;
let MAX_WORD_LENGTH = WL.getBank(wordLanguage, EN_ANSWER_WORDS).maxLength;
let difficultyIndex = buildDifficultyIndex(ANSWER_WORDS);
const getWordsForDifficulty = WL.getWordsForDifficulty;
function isValidGuessWord(word) {
  return WL.isValidGuess(wordLanguage, word);
}
function applyWordLanguage(mode) {
  const bank = WL.getBank(mode, EN_ANSWER_WORDS);
  wordLanguage = bank.mode;
  ANSWER_WORDS = bank.answers;
  MAX_WORD_LENGTH = bank.maxLength;
  difficultyIndex = buildDifficultyIndex(ANSWER_WORDS);
  game.usedWords.clear();
  game.wordLength = clampWordLength(game.wordLength);
  if (game.lengthMin !== undefined) game.lengthMin = clampWordLength(game.lengthMin);
  if (game.lengthMax !== undefined) game.lengthMax = clampWordLength(game.lengthMax);
}

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
  lengthMode: "random",
  lengthMin: 4,
  lengthMax: 15,
  secretWord: null,
  guesses: [],
  streak: 0,
  roundNumber: 0, // bumps every time a new round starts - the page uses it to redraw the board
  hintsUsed: 0,
  hintSuggestions: [],
  lastRejection: null,
  // STRICT FIT (update 25): ON by default; the host can switch it off in Settings (remembered in
  // data/strict-fit.json). ON = a guess must fit every clue already on the board. OFF = any real
  // word of the right length is accepted and colored, so chat can probe freely.
  strictFit: getStrictFit("textle"),
  // true (default): every round opens with one automatic, never-winning starter word.
  // The host can switch it off in Settings (remembered in data/starter-word.json).
  starterWord: getStarterWord("textle"),
  // true (default): the on-screen keyboard colors itself from the tiles. Host can switch it off.
  keyAutoColor: getKeyAutoColor("textle"),
  lastWinInfo: null, // { username, points, word } - set the instant a round is won
  recentComments: [],
  usedWords: new Set(),
  roundScores: new Map(),
  totalScores: new Map(),
  autoContinue: false,
  autoContinueDelaySeconds: DEFAULT_AUTO_CONTINUE_DELAY,
  autoContinueAt: null,
  leaderboardShowSeconds: DEFAULT_LEADERBOARD_SHOW_SECONDS,
  rejectionToastSeconds: DEFAULT_REJECTION_TOAST_SECONDS,
  // Length-hint visibility. Both are OFF by default so the word's length is not given away;
  // the host can switch either on from Settings (they apply instantly).
  showLengthBadge: false, // the "N letters" badge in the top toolbar
  showEmptyTiles: false   // the empty glowing "next guess" tile row
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

// (update 25) The old TEXTLE_STRICT_CLUES environment variable is replaced by the host's "Strict fit"
// switch in Settings (ON by default).

function checkConsistency(word) {
  for (let i = 0; i < game.guesses.length; i++) {
    const past = game.guesses[i];
    if (clueSignature(computeClue(past.word, word)) !== past.sig) {
      return { ok: false, conflictIndex: i, conflictWord: past.word, conflictClue: past.clue };
    }
  }
  return { ok: true };
}

function processGuess(word, caller) {
  const clue = computeClue(word, game.secretWord);
  const avatarUrl = knownAvatars.get(caller) || null;
  game.guesses.push({ word, clue, sig: clueSignature(clue), caller, avatarUrl });

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

  // A word already on the board is never accepted twice (no farming the 1-point-per-guess reward).
  if (game.guesses.some((g) => g.word === word)) {
    return { ok: false, error: "That word is already on the board.", duplicate: true };
  }

  // Strict fit ON (default, update 25): the guess must agree with the segment clue (green / yellow /
  // gray boxes) of every guess already on the board. Strict fit OFF (host's choice, as in update 21):
  // ANY real word is accepted onto the board so viewers can probe freely.
  if (game.strictFit) {
    const consistency = checkConsistency(word);
    if (!consistency.ok) {
      const reason = `Conflicts with the clue from guess #${consistency.conflictIndex + 1} (${consistency.conflictWord.toUpperCase()})`;
      game.lastRejection = { word, reason, at: Date.now() };
      return { ok: false, error: reason, rejected: true };
    }
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
// Update 27: the starter word is a host switch again (Settings -> Starter word), ON by default.

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
  const clue = computeClue(starter, game.secretWord);
  game.guesses.push({ word: starter, clue, sig: clueSignature(clue), caller: STARTER_GUESS_LABEL, avatarUrl: null, isStarter: true });
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

  // Suggestions come from words of ANY length that fit every clue so far, so a hint never
  // reveals how long the secret word is. Lengths are tried in random order; stop once we
  // have a handful of fits (keeps this fast on big word lists).
  const lengths = [];
  for (let L = MIN_GUESS_LENGTH; L <= MAX_WORD_LENGTH; L++) lengths.push(L);
  for (let i = lengths.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lengths[i], lengths[j]] = [lengths[j], lengths[i]];
  }
  const fits = [];
  for (const L of lengths) {
    let pool = getWordsForDifficulty(ANSWER_WORDS, difficultyIndex, L, game.difficulty) || [];
    pool = pool.filter((w) => w !== game.secretWord && !game.hintSuggestions.includes(w));
    for (const w of pool) {
      let ok = true;
      for (const g of game.guesses) {
        if (clueSignature(computeClue(g.word, w)) !== g.sig) { ok = false; break; }
      }
      if (ok) fits.push(w);
    }
    if (fits.length >= 12) break;
  }
  if (fits.length === 0) return;
  const suggestion = fits[Math.floor(Math.random() * fits.length)];
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
  lastErrorDetail: null,
  connectAttempt: 0, // bumps on every Connect press so the page can ignore stale statuses
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
    isGuessLengthOk(normalized) &&
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
  diagnostics.connectAttempt += 1;
  diagnostics.lastErrorDetail = null;
  if (!username) {
    diagnostics.connectionStatus = "error";
    diagnostics.lastErrorMessage = "No TikTok username was entered.";
    broadcastState();
    return;
  }
  if (game.mode !== "live") {
    diagnostics.connectionStatus = "error";
    diagnostics.lastErrorMessage = "The game isn't in Live mode yet. Switch to Live mode, then connect.";
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
      Engagement.attach(connection, { game: "textle", tiktokUsername: username });
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
        diagnostics.lastErrorDetail = String((err && err.message) || err || "").slice(0, 240) || null;
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
  if (message.includes("not found") || message.includes("does not exist") || message.includes("user_not_found")) {
    return "That TikTok username couldn't be found. Double-check the spelling (no @).";
  }
  if (message.includes("offline") || message.includes("not live") || message.includes("live_not_found") || message.includes("isn't live") || message.includes("not currently live")) {
    return "That account isn't LIVE right now. Start your TikTok LIVE first, then press Connect.";
  }
  if (message.includes("429") || message.includes("rate limit") || message.includes("too many")) {
    return "Too many connection attempts - TikTok or the signing service is rate-limiting. Wait a minute and try again.";
  }
  if (message.includes("sign") || message.includes("key") || message.includes("401") || message.includes("403")) {
    return "The signing key was rejected. Check that EULERSTREAM_API_KEY in Render is correct.";
  }
  if (message.includes("timeout") || message.includes("timed out") || message.includes("etimedout") || message.includes("econnreset") || message.includes("enotfound") || message.includes("econnrefused")) {
    return "Network problem reaching TikTok (timeout / connection refused). Check the server's internet access and try again.";
  }
  if (message.includes("age") || message.includes("restricted") || message.includes("private")) {
    return "TikTok is restricting this LIVE (age-restricted or private), so it can't be joined from here.";
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
        // Simulated viewers guess words of many different lengths, like real chat would.
        const testLen = 3 + Math.floor(Math.random() * 10);
        const pool = getWordsForDifficulty(ANSWER_WORDS, difficultyIndex, testLen, "random");
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

// `nsp` is the Socket.IO namespace "/textle", created inside mountTextle()
// below - broadcastState() and the "connection" handler both close over it.
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
      guesses: game.guesses.slice(-12).map((g) => ({
        word: g.word,
        clue: g.clue,
        caller: g.caller,
        // The automatic starter word shows the LIVE host's profile picture.
        avatarUrl: g.isStarter ? hostAvatarUrl : g.avatarUrl,
        isStarter: Boolean(g.isStarter)
      })),
      guessesMade: game.guesses.length,
      roundNumber: game.roundNumber,
      // Keyboard colors, computed from EVERY guess this round (not just the last 12 sent in
      // `guesses`): letter -> "green" | "yellow" | "gray". The page just paints these.
      keyStatus: game.status === "idle" ? {} : keyStatusFromGuesses(game.guesses),
      streak: game.streak,
      hintsUsed: game.hintsUsed,
      hintSuggestions: game.hintSuggestions,
      lastRejection: game.lastRejection,
      strictFit: game.strictFit,
      wordLanguage,
      wordLanguages: WL.languageOptionsForClient(),
      wordLanguageInfo: WL.describeLanguage(wordLanguage),
      starterWord: game.starterWord,
      keyAutoColor: game.keyAutoColor,
      lastWinInfo: game.lastWinInfo,
      autoContinue: game.autoContinue,
      autoContinueDelaySeconds: game.autoContinueDelaySeconds,
      leaderboardShowSeconds: game.leaderboardShowSeconds,
      rejectionToastSeconds: game.rejectionToastSeconds,
      showLengthBadge: game.showLengthBadge,
      showEmptyTiles: game.showEmptyTiles,
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
      if (!isGuessLengthOk(word)) {
        result = { ok: false, error: `Guess must be ${MIN_GUESS_LENGTH}-${MAX_GUESS_LENGTH} letters (A-Z).` };
      } else if (word !== game.secretWord && !isValidGuessWord(word)) {
        result = { ok: false, error: "That's not in the word list." };
      } else {
        result = attemptGuess(word, "Host");
        broadcastState();
      }
      ws.emit("offline_guess_result", result);
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
    case "set_hint_visibility": {
      // Applies instantly (no new round): which length hints the host wants shown.
      if (payload && typeof payload.showLengthBadge === "boolean") game.showLengthBadge = payload.showLengthBadge;
      if (payload && typeof payload.showEmptyTiles === "boolean") game.showEmptyTiles = payload.showEmptyTiles;
      broadcastState(true);
      break;
    }
    case "set_key_autocolor":
      game.keyAutoColor = setKeyAutoColor("textle", Boolean(payload && payload.on));
      broadcastState();
      break;
    case "set_starter_word":
      game.starterWord = setStarterWord("textle", Boolean(payload && payload.on));
      broadcastState();
      break;
    case "set_word_language": {
      const prevLanguage = wordLanguage;
      const nextLanguage = WL.setLanguage(WORD_GAME_ID, payload && payload.mode);
      if (nextLanguage !== prevLanguage) {
        applyWordLanguage(nextLanguage);
        if (game.status === "live") playAgain(); // the running round's word is in the old language
      }
      broadcastState();
      break;
    }
    case "set_strict_fit":
      game.strictFit = setStrictFit("textle", Boolean(payload && payload.on));
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
// Mounting into the platform
// ============================================================
//   import { mountTextle } from "./server/textle/textle-server.js";
//   await mountTextle(app, io, { mountPath: "/textle" });
//
// `app` is the shared Express app, `io` the shared Socket.IO Server. TEXTLE serves its own
// static folder at `mountPath` and talks to its page over the Socket.IO namespace "/textle".
// Call once per process. (It reuses BLINDLE's dictionary module, which only ever loads once.)
export async function mountTextle(app, io, options = {}) {
  const mountPath = options.mountPath || "/textle";

  app.use(mountPath, express.static(path.join(__dirname, "public")));
  app.get(mountPath, (req, res) => {
    res.sendFile(path.join(__dirname, "public", "textle-index.html"));
  });

  nsp = io.of("/textle");
  nsp.on(
    "connection",
    safely("textle-connection", (socket) => {
      socket.emit("state", buildStatePayload());
      socket.on(
        "action",
        safely("textle-action", (msg) => {
          if (!msg || typeof msg !== "object") return;
          handleClientAction(socket, msg);
        })
      );
    })
  );

  await loadDictionary();
  console.log(
    `[TEXTLE] Mounted at ${mountPath} (Socket.IO namespace /textle). ` +
      (diagnostics.signKeyConfigured
        ? "EulerStream signing key detected - TikTok connections are ready."
        : "No EULERSTREAM_API_KEY found - Test Mode will work, but live TikTok connections will not.")
  );

  return { mountPath };
}

// Update 42: the HOME page's shared TikTok connection links this game by itself - no need to open the game and press
// Connect. Uses the same actions the game's own buttons send (switch to Live, then connect), only when not linked yet.
PlatformHub.registerGame(
  "textle",
  (username) => {
    const ws = { emit() {}, send() {} };
    if (game.mode !== "live") handleClientAction(ws, { type: "apply_settings", payload: { mode: "live" } });
    handleClientAction(ws, { type: "connect_tiktok", payload: { username } });
  },
  (username) => {
    const u = String(username || "").replace(/^@/, "").toLowerCase();
    const cur = String(diagnostics.tiktokUsername || "").replace(/^@/, "").toLowerCase();
    return game.mode === "live" && ["live", "connecting", "retrying"].includes(diagnostics.connectionStatus) && (!cur || cur === u);
  }
);
