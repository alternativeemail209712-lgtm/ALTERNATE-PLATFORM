// ============================================================================
// CROSSDLE game engine
// ----------------------------------------------------------------------------
// This file has NO knowledge of TikTok, sockets, or HTTP. It is a pure,
// self-contained game state machine. That separation is what makes Test Mode
// possible: the exact same functions run whether a "guess" came from a real
// TikTok viewer or from the built-in simulator.
// ============================================================================

import { WORD_LENGTH_OPTIONS, MIN_WORD_LENGTH, MAX_WORD_LENGTH, randomWord, isKnownWord } from './crossdle-dictionary.js';
import { ANSWER_WORDS as EN_ANSWER_WORDS } from './crossdle-answers.js';
import * as WL from '../shared/word-language.js'; // update 48: word language

// ---- WORD LANGUAGE (update 48) ---------------------------------------------------------------
// The host picks the word language in Settings. The secret word, the decoy word and the pool the
// strict-fit check judges against all come from the chosen language bank.
const WORD_GAME_ID = 'crossdle';
let wordLanguage = WL.getLanguage(WORD_GAME_ID);
let ANSWER_WORDS = WL.getBank(wordLanguage, EN_ANSWER_WORDS).answers;

export function getWordLanguage() {
  return wordLanguage;
}
/** Switches the language bank used by every future round (call GameEngine.setWordLanguage from the host layer). */
function applyWordLanguageBank(mode) {
  const bank = WL.getBank(mode, EN_ANSWER_WORDS);
  wordLanguage = bank.mode;
  ANSWER_WORDS = bank.answers;
  return bank;
}
/** Every secret-word candidate of a length in the current language (for Test Mode's fake chat). */
export function getAnswerPool(length) {
  return ANSWER_WORDS[length] || [];
}
import { getStrictFit, setStrictFit } from '../shared/strict-fit-store.js';
import { getKeyAutoColor, setKeyAutoColor } from '../shared/key-autocolor-store.js';
import { getStarterWord, setStarterWord } from '../shared/starter-word-store.js';

export { WORD_LENGTH_OPTIONS };

const DEFAULT_WORD_LENGTH = 5;

// A single, fixed pace for hints - word length is the only thing the host
// tunes (no more separate "difficulty" levels). There is no round timer:
// a round runs until it's solved, or the host skips/reveals it.
const HINT_EVERY = 4;

// How long after a round ends before the next one auto-starts. Defaults to
// 3 seconds; adjustable live via setNextRoundDelay() / the host panel.
export const NEXT_ROUND_DELAY_OPTIONS = [3, 5, 10, 15, 30, 60];
const DEFAULT_NEXT_ROUND_DELAY_MS = 3000;

// Scoring is intentionally small-numbered - a live chat reads "21 points"
// faster than "84 points", and small numbers make round-to-round swings on
// the leaderboard feel meaningful instead of noisy. The formula still
// rewards the things that should matter:
//   - solving in fewer guesses (decays by attempt count)
//   - solving without leaning on hints (a small penalty per hint used)
//   - solving quickly (a flat bonus for finishing in the round's first third)
const SOLVE_BASE_SCORE = 20;
const SOLVE_SCORE_STEP = 1;
const SOLVE_SCORE_MIN = 5;
const HINT_PENALTY = 2;
const QUICK_SOLVE_BONUS = 5;
const QUICK_SOLVE_MAX_ATTEMPTS = 3; // "quick" now means "solved within the first few guesses" - there's no clock to race anymore
const PARTICIPATION_SCORE = 1;

/**
 * Classic Wordle-style two-pass color comparison of `guess` against a single
 * `target` word (same length as each other). Returns an array of
 * 'green' | 'yellow' | 'grey', one per letter position. Handles duplicate
 * letters correctly. Works for any word length.
 */
function colorsAgainst(guess, target) {
  const len = target.length;
  const result = new Array(len).fill('grey');
  const targetLetters = target.split('');
  const guessLetters = guess.split('');

  // Pass 1: greens (exact position matches), consuming those target letters.
  for (let i = 0; i < len; i++) {
    if (guessLetters[i] === targetLetters[i]) {
      result[i] = 'green';
      targetLetters[i] = null;
    }
  }

  // Count remaining (unconsumed) target letters for the yellow pass.
  const remaining = {};
  for (let i = 0; i < len; i++) {
    const l = targetLetters[i];
    if (l) remaining[l] = (remaining[l] || 0) + 1;
  }

  // Pass 2: yellows.
  for (let i = 0; i < len; i++) {
    if (result[i] === 'green') continue;
    const l = guessLetters[i];
    if (remaining[l] > 0) {
      result[i] = 'yellow';
      remaining[l]--;
    }
  }

  return result;
}

const RANK = { green: 2, yellow: 1, grey: 0 };

/**
 * Merges two color arrays position-by-position, keeping whichever color
 * ranks higher (green beats yellow beats grey). This is the "ambiguous
 * Wordle" trick that makes CROSSDLE interesting: a tile can be green
 * because of the REAL answer, or because of the DECOY word, and the player
 * can't always tell which one caused it.
 */
function mergeColors(a, b) {
  return a.map((c, i) => (RANK[c] >= RANK[b[i]] ? c : b[i]));
}

// ---------------------------------------------------------------------------
// STRICT FIT (update 25)
// Every row on the board was colored against the REAL answer merged with a secret DECOY word
// (a fresh, never-shown word picked from the curated answer bank for that guess), so viewers can
// never be sure which tiles came from which word. A new guess W "fits" an earlier row when W could
// still be the real answer behind that row: there must be SOME decoy word that, merged with W's
// own colors for that row, gives exactly the colors that were shown. (Unlike BLINDLE the clue is
// deliberately ambiguous, so the test is "could a decoy explain it?", not "is it identical?".)
// The real answer always fits, because its real decoy is one of the bank words tried here.
// ---------------------------------------------------------------------------
const decoyPatternCache = new WeakMap(); // attempt -> every decoy color pattern that could sit under its shown colors

function decoyPatternsFor(attempt, length) {
  let patterns = decoyPatternCache.get(attempt);
  if (patterns) return patterns;
  patterns = [];
  const seen = new Set();
  const pool = ANSWER_WORDS[length] || [];
  const shown = attempt.colors;
  for (const decoy of pool) {
    const p = colorsAgainst(attempt.guess, decoy);
    let possible = true;
    for (let i = 0; i < length; i++) {
      if (RANK[p[i]] > RANK[shown[i]]) { possible = false; break; } // a decoy can never out-rank what was shown
    }
    if (!possible) continue;
    const key = p.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    patterns.push(p);
  }
  decoyPatternCache.set(attempt, patterns);
  return patterns;
}

function fitsRowWithSomeDecoy(candidate, attempt, length) {
  const shown = attempt.colors;
  const own = colorsAgainst(attempt.guess, candidate); // colors this row would show for `candidate` as the real answer
  for (let i = 0; i < length; i++) {
    if (RANK[own[i]] > RANK[shown[i]]) return false;
  }
  const pool = ANSWER_WORDS[length];
  if (!pool || pool.length === 0) return true; // no bank to judge by - never block
  for (const p of decoyPatternsFor(attempt, length)) {
    let ok = true;
    for (let i = 0; i < length; i++) {
      const merged = RANK[own[i]] >= RANK[p[i]] ? own[i] : p[i];
      if (merged !== shown[i]) { ok = false; break; }
    }
    if (ok) return true;
  }
  return false;
}

/** Strict fit check of `candidate` against every row already on the board. */
export function checkStrictFit(candidate, attempts, length) {
  for (let i = 0; i < attempts.length; i++) {
    if (!fitsRowWithSomeDecoy(candidate, attempts[i], length)) {
      return { ok: false, conflictIndex: i, conflictWord: attempts[i].guess };
    }
  }
  return { ok: true };
}

/** Computes the final on-screen colors for one guess row. */
export function computeRowColors(guess, answer, decoy) {
  return mergeColors(colorsAgainst(guess, answer), colorsAgainst(guess, decoy));
}

// Ordinary conversational 5-letter words that show up constantly in chat
// chit-chat ("guess", "hello", "there", "first"...) and would otherwise get
// mistaken for deliberate guesses when the round's word length happens to be
// 5. Excluding this short list is a deliberate design trade-off: it costs a
// handful of legitimate 5-letter answer words but removes the most common
// source of false-positive "guesses". It naturally has no effect on rounds
// using any other word length.
// BUG FIX: 'watch' used to be listed here, which silently ignored every
// chat message containing the word "watch" whenever the round's word
// length was 5 - including as a legitimate guess, AND (worse) whenever
// "watch" itself was the round's secret answer, making that round
// unsolvable by chat since the guess was thrown away before ever being
// tested. Removed - "watch" is a normal playable answer word (see
// crossdle-answers.js) and shouldn't have been in a noise-word list.
const CHAT_NOISE_WORDS = new Set([
  'guess', 'hello', 'there', 'where', 'which', 'their', 'would',
  'could', 'should', 'right', 'still', 'other', 'after', 'about', 'above',
  'first', 'great', 'every', 'maybe', 'think', 'video', 'super', 'doing',
  'going', 'being', 'while', 'again', 'check', 'thank', 'sorry',
  'today', 'later', 'never', 'these', 'those', 'youre',
]);

// The REAL answer and the DECOY word both come from this small curated
// list (same word bank BLINDLE uses for its secret words) rather than
// the full 300,000+ word guess-validation dictionary. This is what keeps
// the word chat is trying to solve — and the decoy word muddying the
// clues — always a common, recognizable word, never an obscure
// dictionary entry nobody would guess. isKnownWord() (used to validate
// viewer guesses) still checks against the full dictionary, unchanged.
function curatedAnswerPoolSize(length) {
  const pool = ANSWER_WORDS[length];
  return pool ? pool.length : 0;
}

function pickWord(length, exclude = []) {
  const curatedPool = ANSWER_WORDS[length];
  if (curatedPool && curatedPool.length > 0) {
    const ex = new Set(exclude);
    // mixed language modes: every language gets a fair share (see shared/word-language.js)
    const weighted = WL.getWordsForDifficulty(ANSWER_WORDS, null, length, 'random');
    const available = weighted.filter((w) => !ex.has(w));
    const pool = available.length > 0 ? available : curatedPool;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  // Defensive fallback only — BLINDLE's curated list already covers
  // every length from 4 to 20, so this should never actually trigger.
  return randomWord(length, exclude);
}

/**
 * Pulls a guess word matching `wordLength` out of a free-form chat message,
 * while deliberately erring on the side of NOT recognizing a message rather
 * than misreading ordinary chatter as a guess. TikTok comments are messy
 * ("ITS APPLE!!", "guess: apple", "apple?", "hi there how's it going") so:
 *   1. Very long messages (more than 6 words) are treated as chatter, not a
 *      one-word guess wrapped in a sentence.
 *   2. If MORE THAN ONE distinct word of the right length appears, the
 *      message is ambiguous - we skip it rather than risk grabbing the
 *      wrong one (e.g. "guess: apple" contains both "guess" and "apple").
 *   3. Common conversational 5-letter words ("guess", "hello", "there"...)
 *      are ignored so ordinary chatting doesn't flood the board (only
 *      matters when wordLength is 5).
 */
export function extractGuessWord(text, wordLength) {
  if (!text || typeof text !== 'string') return null;
  const tokens = text.match(/[a-zA-Z]+/g);
  if (!tokens || tokens.length === 0 || tokens.length > 6) return null;

  const matching = [...new Set(tokens.filter((t) => t.length === wordLength).map((t) => t.toLowerCase()))];
  if (matching.length !== 1) return null;

  const candidate = matching[0];
  if (wordLength === 5 && CHAT_NOISE_WORDS.has(candidate)) return null;
  return candidate;
}

/**
 * Requirement: unlimited guesses, but only guesses that are an actual "fit"
 * (a real word from our dictionary, at the round's chosen length) get tested
 * and added to the board. Random keyboard-mash never becomes a row.
 */
export function isAcceptableGuess(word, wordLength) {
  for (const part of WL.modeInfo(wordLanguage).parts) {
    if (part === 'en') {
      if (isKnownWord(word, wordLength)) return true;
    } else if (WL.isValidGuess(part, word)) {
      return true;
    }
  }
  return false;
}

function scoreForSolve(attemptCountIncludingSolve, hintsUsedCount, quickSolve) {
  let score = SOLVE_BASE_SCORE
    - SOLVE_SCORE_STEP * (attemptCountIncludingSolve - 1)
    - HINT_PENALTY * hintsUsedCount;
  score = Math.max(SOLVE_SCORE_MIN, score);
  if (quickSolve) score += QUICK_SOLVE_BONUS;
  return score;
}

/**
 * GameEngine holds one live round at a time plus the persistent leaderboard.
 * `onChange(reason)` is called after every mutation so the host layer can
 * decide what to broadcast.
 */
export class GameEngine {
  constructor({ onChange } = {}) {
    this.onChange = onChange || (() => {});
    this.wordLength = DEFAULT_WORD_LENGTH;
    this.leaderboard = new Map(); // username -> { username, score, solves }
    this.round = null;
    this.roundNumber = 0;
    // Profile picture of the LIVE host, set by crossdle.js while connected to TikTok;
    // shown on the automatic starter-word row (see getPublicState).
    this.hostAvatarUrl = null;
    this.tickTimer = null;
    this._nextRoundAt = null;
    this.nextRoundDelayMs = DEFAULT_NEXT_ROUND_DELAY_MS;
    // Strict fit is ON by default; the host's choice is remembered in data/strict-fit.json.
    this.strictFit = getStrictFit('crossdle');
    // Keyboard auto-color is ON by default; the host's choice is remembered in data/key-autocolor.json.
    this.keyAutoColor = getKeyAutoColor('crossdle');
    // Starter word is ON by default; the host's choice is remembered in data/starter-word.json.
    this.starterWord = getStarterWord('crossdle');
  }

  /** Host switch: ON = every round opens with one automatic starter row; OFF = blank board. Used from the next round. */
  setStarterWord(on) {
    this.starterWord = setStarterWord('crossdle', Boolean(on));
    this.onChange('settings');
  }

  /** Host switch: ON = keyboard keys take their letter's tile color; OFF = plain keys. */
  setKeyAutoColor(on) {
    this.keyAutoColor = setKeyAutoColor('crossdle', Boolean(on));
    this.onChange('settings');
  }

  /** Host switch: ON = a guess must still fit every row on the board; OFF = any real word is tested. */
  setStrictFit(on) {
    this.strictFit = setStrictFit('crossdle', Boolean(on));
    this.onChange('settings');
  }

  /** Longest word length that has words in the current language. */
  getMaxWordLength() {
    return WL.getBank(wordLanguage, EN_ANSWER_WORDS).maxLength;
  }

  /** Host switch (update 48): the word language. Takes effect from the next round (a running round is restarted). */
  setWordLanguage(mode) {
    const prev = wordLanguage;
    const next = WL.setLanguage(WORD_GAME_ID, mode);
    if (next === prev) {
      this.onChange('settings');
      return false;
    }
    const bank = applyWordLanguageBank(next);
    if (this.wordLength > bank.maxLength) this.wordLength = bank.maxLength;
    this.onChange('settings');
    return true;
  }

  /** Host-adjustable word length (4-20 letters) used for future rounds. */
  setWordLength(n) {
    const len = Number(n);
    if (!Number.isInteger(len) || len < MIN_WORD_LENGTH || len > Math.min(MAX_WORD_LENGTH, this.getMaxWordLength())) return;
    if (curatedAnswerPoolSize(len) < 2) return; // guard against an empty/near-empty answer bank
    this.wordLength = len;
    this.onChange('settings');
  }

  /** Host-adjustable delay (in whole seconds) before the next round auto-starts. */
  setNextRoundDelay(seconds) {
    const n = Number(seconds);
    if (!Number.isFinite(n) || n < 1 || n > 600) return;
    this.nextRoundDelayMs = Math.round(n * 1000);
    this.onChange('settings');
  }

  /** Starts a fresh round, replacing any round currently in progress. */
  startRound() {
    this._clearTimers();
    this.roundNumber += 1;
    const length = this.wordLength;
    const answer = pickWord(length);
    this.round = {
      number: this.roundNumber,
      wordLength: length,
      answer,
      attempts: [], // { username, guess, colors, decoy, ts } - unlimited length
      hints: [], // revealed positions, e.g. [{ index, letter }]
      solved: false,
      solvedBy: null,
      startedAt: Date.now(),
      participants: new Set(),
      status: 'active', // active | solved | skipped | revealed
      revealAnswer: null, // set when round ends
    };
    this._seedStarterGuess();
    this._nextRoundAt = null;
    this.tickTimer = setInterval(() => this._tick(), 1000);
    this.onChange('roundStart');
  }

  /**
   * A round used to open on a totally blank board, so the very first
   * audience guess had zero information to reason from. Every round now
   * opens with one random, automatically-played guess before any audience
   * guessing happens — never the actual answer (so it's never a free win),
   * and never worth points to anyone — so its row of green/yellow/grey
   * tiles gives viewers an immediate starting clue instead of a cold guess.
   */
  _seedStarterGuess() {
    if (!this.starterWord) return;
    const length = this.round.wordLength;
    const starter = pickWord(length, [this.round.answer]);
    if (!starter || starter === this.round.answer) return; // extremely small word bank at this length — skip rather than risk a free win
    const decoy = pickWord(length, [this.round.answer, starter]);
    const colors = computeRowColors(starter, this.round.answer, decoy);
    this.round.attempts.push({
      username: '🎲 Starter word',
      avatarUrl: null,
      guess: starter,
      decoy,
      colors,
      correct: false,
      isStarter: true,
      ts: Date.now(),
    });
  }

  /** Ends the round early and schedules the next one (host "skip" action). */
  skipRound(status = 'skipped') {
    if (!this.round || this.round.status !== 'active') return;
    this._endRound(status);
  }

  /** Immediately reveals the answer to end the round (host action). */
  revealAnswer() {
    if (!this.round || this.round.status !== 'active') return;
    this._endRound('revealed');
  }

  /** Force-reveals the next hint letter (host action, independent of the timer). */
  giveHint() {
    if (!this.round || this.round.status !== 'active') return;
    this._revealNextHint();
    this.onChange('hint');
  }

  _revealNextHint() {
    const { answer, hints } = this.round;
    const revealedIdx = new Set(hints.map((h) => h.index));
    const candidates = [];
    for (let i = 0; i < answer.length; i++) {
      if (!revealedIdx.has(i)) candidates.push(i);
    }
    if (candidates.length <= 1) return; // never give away the whole word
    const idx = candidates[Math.floor(Math.random() * candidates.length)];
    hints.push({ index: idx, letter: answer[idx] });
  }

  // NOTE: rounds no longer have a time limit - viewers can guess for as
  // long as it takes until someone solves it (or the host skips/reveals
  // it). This tick only exists to auto-start the next round after the
  // host-configured delay once a round HAS ended. It deliberately does
  // NOT call onChange() for the common case, to avoid re-triggering a
  // full board re-render every second (that was a real bug once - see
  // public/app.js for how any time-based UI is computed independently on
  // the client instead).
  _tick() {
    if (!this.round) return;
    if (this._nextRoundAt && Date.now() >= this._nextRoundAt) {
      this.startRound();
    }
  }

  _endRound(status) {
    this.round.status = status;
    this.round.revealAnswer = this.round.answer;
    this._nextRoundAt = Date.now() + this.nextRoundDelayMs;
    this.onChange('roundEnd');
  }

  _clearTimers() {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = null;
  }

  stop() {
    this._clearTimers();
  }

  _bumpScore(username, delta, avatarUrl) {
    const key = username.toLowerCase();
    const existing = this.leaderboard.get(key) || { username, score: 0, solves: 0, avatarUrl: null };
    existing.score += delta;
    existing.username = username; // keep latest display casing
    if (avatarUrl) existing.avatarUrl = avatarUrl; // keep latest known photo, never overwrite with a blank
    this.leaderboard.set(key, existing);
  }

  getLeaderboardTop(n = 10) {
    return [...this.leaderboard.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, n);
  }

  resetLeaderboard() {
    this.leaderboard.clear();
    this.onChange('leaderboard');
  }

  /**
   * The heart of the game: called for EVERY chat message (real or simulated)
   * that has already been through diagnostics counting. Returns a small
   * result object describing what happened - the actual state change is
   * applied internally and broadcast via onChange.
   */
  submitGuess(username, rawText, avatarUrl) {
    if (!this.round || this.round.status !== 'active') return { recognized: false, reason: 'no-active-round' };

    const length = this.round.wordLength;
    const guess = extractGuessWord(rawText, length);
    if (!guess) return { recognized: false };

    // Unlimited guessing, but only a real dictionary word is "fit" enough
    // to be tested against the answer and added to the board. A non-word
    // is quietly ignored rather than wasting a board row - the `guess` is
    // still returned here so the UI can show a brief, readable explanation
    // of why it wasn't accepted.
    if (!isAcceptableGuess(guess, length)) return { recognized: false, reason: 'not-a-word', guess };

    // Strict fit ON (default): the guess must still be a possible answer given every row already on
    // the board (see checkStrictFit). The real answer always passes.
    if (this.strictFit && guess !== this.round.answer) {
      const fit = checkStrictFit(guess, this.round.attempts, length);
      if (!fit.ok) {
        return { recognized: false, reason: 'no-fit', guess, conflictIndex: fit.conflictIndex, conflictWord: fit.conflictWord };
      }
    }

    const decoy = pickWord(length, [this.round.answer, guess]);
    const colors = computeRowColors(guess, this.round.answer, decoy);
    const isCorrect = guess === this.round.answer;

    const attempt = {
      username,
      avatarUrl: avatarUrl || null,
      guess,
      decoy,
      colors,
      correct: isCorrect,
      ts: Date.now(),
    };
    this.round.attempts.push(attempt);

    const key = username.toLowerCase();
    if (!this.round.participants.has(key)) {
      this.round.participants.add(key);
      this._bumpScore(username, PARTICIPATION_SCORE, avatarUrl);
    } else if (avatarUrl) {
      this._bumpScore(username, 0, avatarUrl); // no new points, just refresh their photo
    }

    if (isCorrect) {
      const quickSolve = this.round.attempts.length <= QUICK_SOLVE_MAX_ATTEMPTS;
      const bonus = scoreForSolve(this.round.attempts.length, this.round.hints.length, quickSolve);
      this._bumpScore(username, bonus, avatarUrl);
      const entry = this.leaderboard.get(key);
      if (entry) entry.solves = (entry.solves || 0) + 1;
      this.round.solved = true;
      this.round.solvedBy = username;
      this.round.solvedByAvatar = avatarUrl || null;
      this.round.solveBonus = bonus;
      this.round.quickSolve = quickSolve;
      this._endRound('solved');
      this.onChange('solved');
      return { recognized: true, correct: true, bonus };
    }

    // Reveal a hint every N attempts (unlimited guessing means this is the
    // only thing that paces the round besides the clock).
    if (this.round.attempts.length % HINT_EVERY === 0) {
      this._revealNextHint();
    }

    this.onChange('attempt');
    return { recognized: true, correct: false };
  }

  /** Serializes state safely for the client - the secret answer is NEVER
   *  included unless the round has actually ended. */
  getPublicState() {
    const r = this.round;
    return {
      roundNumber: this.roundNumber,
      wordLength: this.wordLength,
      nextRoundDelayMs: this.nextRoundDelayMs,
      strictFit: this.strictFit,
      wordLanguage,
      wordLanguages: WL.languageOptionsForClient(),
      wordLanguageInfo: WL.describeLanguage(wordLanguage),
      maxWordLength: WL.getBank(wordLanguage, EN_ANSWER_WORDS).maxLength,
      keyAutoColor: this.keyAutoColor,
      starterWord: this.starterWord,
      leaderboard: this.getLeaderboardTop(10),
      round: r && {
        number: r.number,
        wordLength: r.wordLength,
        // The automatic starter word shows the LIVE host's profile picture.
        attempts: r.attempts.map((a) => (a.isStarter ? { ...a, avatarUrl: this.hostAvatarUrl || null } : a)),
        hints: r.hints,
        solved: r.solved,
        solvedBy: r.solvedBy,
        solvedByAvatar: r.solvedByAvatar || null,
        solveBonus: r.solveBonus,
        quickSolve: r.quickSolve,
        status: r.status,
        startedAt: r.startedAt,
        revealAnswer: r.status === 'active' ? null : r.revealAnswer,
        nextRoundAt: this._nextRoundAt,
      },
    };
  }
}

export { DEFAULT_NEXT_ROUND_DELAY_MS };
