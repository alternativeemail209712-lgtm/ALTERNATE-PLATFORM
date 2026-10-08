// ============================================================================
// TWISTLE - the rules, in one place (pure functions, no state, no I/O).
//
// The round flow (secret-word selection, difficulty tiers, points,
// leaderboards, celebration timing, auto-continue) lives in twistle.js and
// deliberately follows BLINDLE's system. This file is ONLY the Twistle-
// specific rules, so it can be tested on its own.
//
// * Every round, 3 symbols are drawn at random and each is secretly assigned
//   one meaning:  "correct spot", "wrong spot", or "not in the guess".
//   Nobody is told which symbol means what - players have to work it out.
//   The 3 symbols are always picked to look VERY different from each other
//   (different colour AND different silhouette) so they can't be confused.
// * When a word is guessed, the board shows one symbol per letter next to it.
//   Symbol #1 describes the SECRET word's 1st letter, symbol #2 its 2nd
//   letter, and so on (NOT the letters of the guess!):
//       correct   -> the guess has that same letter in that same position
//       misplaced -> the guess contains that letter, but somewhere else
//       absent    -> the guess doesn't contain that letter (or no spare copy)
// * Duplicate letters: a misplaced letter is marked on the EARLIEST matching
//   letter of the secret word that isn't already "correct".
// * The colours of the guessed tiles stay hidden until the round is over.
// ============================================================================

export const CONCEPTS = ['correct', 'misplaced', 'absent'];

// ---------------------------------------------------------------------------
// Symbols. Ids must match the SVG symbols drawn in public/twistle/symbols.js.
//   hue   - the symbol's main colour as an angle on the colour wheel (0-360).
//           null = white/neutral.
//   tone  - 'light' or 'mid'. Two light symbols are never used together
//           (e.g. a yellow star next to a white cloud would blur together).
//   shape - silhouette family. Two symbols of the same family are never used
//           together (the clover and the cloud are both "lobed", for example).
// ---------------------------------------------------------------------------
export const SYMBOL_INFO = {
  heart:    { hue: 348,  tone: 'mid',   shape: 'heart' },
  star:     { hue: 45,   tone: 'light', shape: 'spiky' },
  moon:     { hue: 258,  tone: 'mid',   shape: 'crescent' },
  drop:     { hue: 216,  tone: 'mid',   shape: 'teardrop' },
  clover:   { hue: 145,  tone: 'mid',   shape: 'lobed' },
  cat:      { hue: 27,   tone: 'mid',   shape: 'ears' },
  gem:      { hue: 180,  tone: 'mid',   shape: 'faceted' },
  donut:    { hue: 325,  tone: 'mid',   shape: 'ring' },
  cloud:    { hue: null, tone: 'light', shape: 'lobed' },
  frog:     { hue: 100,  tone: 'mid',   shape: 'frog' },
  mushroom: { hue: 4,    tone: 'mid',   shape: 'mushroom' },
  ghost:    { hue: 292,  tone: 'mid',   shape: 'ghost' },
};
export const SYMBOL_POOL = Object.keys(SYMBOL_INFO);
export const MIN_HUE_GAP = 70; // degrees on the colour wheel between any two symbols in a round

/** True if two symbols are too alike in colour or shape to share a round. */
export function symbolsClash(idA, idB) {
  const a = SYMBOL_INFO[idA], b = SYMBOL_INFO[idB];
  if (a.shape === b.shape) return true;
  if (a.hue === null || b.hue === null) return a.tone === 'light' && b.tone === 'light';
  const gap = Math.abs(a.hue - b.hue);
  return Math.min(gap, 360 - gap) < MIN_HUE_GAP;
}

/** Every group of 3 symbols where no two of them clash. */
export const SYMBOL_TRIPLES = (() => {
  const out = [];
  for (let i = 0; i < SYMBOL_POOL.length; i++)
    for (let j = i + 1; j < SYMBOL_POOL.length; j++)
      for (let k = j + 1; k < SYMBOL_POOL.length; k++) {
        const t = [SYMBOL_POOL[i], SYMBOL_POOL[j], SYMBOL_POOL[k]];
        if (!symbolsClash(t[0], t[1]) && !symbolsClash(t[0], t[2]) && !symbolsClash(t[1], t[2])) out.push(t);
      }
  return out;
})();

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Draw this round's secret symbol assignment:
 *   { correct: 'sun', misplaced: 'drop', absent: 'heart' }
 * (always a clearly-different-looking trio, each given one meaning).
 */
export function pickSymbolMap() {
  const symbols = shuffle(SYMBOL_TRIPLES[Math.floor(Math.random() * SYMBOL_TRIPLES.length)]);
  const concepts = shuffle(CONCEPTS);
  const map = {};
  concepts.forEach((concept, i) => { map[concept] = symbols[i]; });
  return map;
}

// ---------------------------------------------------------------------------
// Chat parsing
// ---------------------------------------------------------------------------

/**
 * Turn a chat comment into a guess, or null if it isn't one.
 * Accepts "crane", "Crane!", "crane \u{1F602}", "!guess crane", "!g crane".
 * Only a single word of exactly `length` letters counts; anything else
 * ("lol", "i think crane", "omg so hard") is normal chatter and is ignored.
 */
export function parseGuess(text, length = 5) {
  const tokens = String(text || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length && /^[!/](g|guess)$/i.test(tokens[0])) tokens.shift();
  // Tokens with no letters at all (an emoji, "!!!", "...") are decoration, not words.
  const words = tokens.filter((t) => /[A-Za-z]/.test(t));
  if (words.length !== 1) return null;
  const word = words[0].replace(/^[^A-Za-z]+/, '').replace(/[^A-Za-z]+$/, '');
  return word.length === length && /^[A-Za-z]+$/.test(word) ? word.toLowerCase() : null;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/**
 * Score one guess against the answer (both lowercase, same length).
 *   states[i]  - status of the i-th GUESSED letter (Wordle style; hidden until the end)
 *   symbols[i] - status of the i-th letter of the ANSWER (what the symbol column shows)
 * Each is 'correct' | 'misplaced' | 'absent'.
 */
export function evaluateGuess(answer, guess) {
  const n = answer.length;
  const states = new Array(n).fill('absent');
  const symbols = new Array(n).fill('absent');
  const unmatched = {}; // letter -> how many copies in the answer aren't "correct" yet

  for (let i = 0; i < n; i++) {
    if (guess[i] === answer[i]) {
      states[i] = 'correct';
      symbols[i] = 'correct';
    } else {
      unmatched[answer[i]] = (unmatched[answer[i]] || 0) + 1;
    }
  }

  // Guess side: hand out "misplaced" left to right while spare copies remain.
  const spare = { ...unmatched };
  for (let i = 0; i < n; i++) {
    if (states[i] === 'correct') continue;
    if (spare[guess[i]] > 0) {
      states[i] = 'misplaced';
      spare[guess[i]] -= 1;
    }
  }

  // Answer side: each misplaced guess letter marks the EARLIEST unmatched copy in the answer.
  const toMark = {};
  for (const letter of Object.keys(unmatched)) toMark[letter] = unmatched[letter] - spare[letter];
  for (let i = 0; i < n; i++) {
    if (symbols[i] === 'correct') continue;
    if (toMark[answer[i]] > 0) {
      symbols[i] = 'misplaced';
      toMark[answer[i]] -= 1;
    }
  }
  return { states, symbols };
}

/** True if two symbol-meaning rows (arrays of concepts) are identical. */
export function conceptsEqual(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
