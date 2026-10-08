// difficulty.js
// A modular, tunable difficulty-scoring engine for BLINDLE's secret
// word selection. This does NOT change the feedback mechanic (players
// always get full, honest green/yellow/red counts) - it only changes
// WHICH secret words are eligible for each named tier, by scoring how
// hard a word is to deduce.
//
// Four factors, each scored 0-100 (higher = harder), combined with
// configurable weights into one overall score (0-100), then bucketed
// into NORMAL / MEDIUM / HARD via configurable thresholds. Tune any
// of DIFFICULTY_WEIGHTS or DIFFICULTY_THRESHOLDS below without
// touching the scoring logic itself.
//
// Extension point for future modes (Speed Round, Double Letter, Rare
// Letter, Trick Word, Boss Round, etc.): those can layer additional
// selection or timing rules on top of getWordsForDifficulty() below
// without rebuilding this scoring engine.

import { EXTENDED_WORD_SET } from "./blindle-answers.js";

export const DIFFICULTY_WEIGHTS = {
  vocabulary: 0.30, // how common/familiar the word is
  structure: 0.25, // repeated/rare letters, awkward letter patterns
  ambiguity: 0.25, // how many same-length words look similar to it
  information: 0.2 // how much a count-based clue actually narrows things down
};

export const DIFFICULTY_THRESHOLDS = {
  normalMax: 35, // score <= this -> NORMAL
  mediumMax: 65 // score <= this -> MEDIUM, above -> HARD
};

// UPDATE 20: with thousands of words per length, fixed score cut-offs would leave "hard"
// empty at most lengths (and everything "normal" at short ones). So for any length with a
// reasonably large pool, the three tiers are cut by SHARE of that length's own score
// distribution instead: the easiest 40% are NORMAL, the hardest 22% are HARD, the rest MEDIUM.
// Tiny pools (very long words) still use the absolute DIFFICULTY_THRESHOLDS above.
export const DIFFICULTY_SHARES = {
  normal: 0.40, // bottom 40% by score
  hard: 0.22 // top 22% by score
};
const MIN_POOL_FOR_SHARES = 25;

const RARE_LETTER_POINTS = { j: 8, q: 10, x: 8, z: 8, v: 4, w: 3, k: 3, y: 2 };
const VOWELS = new Set(["a", "e", "i", "o", "u"]);

// A small set of extremely familiar words, hand-picked, that get an
// "easy to recognize" discount on their vocabulary score. This is a
// heuristic nudge, not a real frequency corpus - documented as such.
const COMMON_CORE = new Set([
  "gold", "moon", "fire", "rain", "snow", "king", "book", "cake", "fish", "bird",
  "tree", "star", "game", "team", "apple", "beach", "candy", "dance", "honey",
  "queen", "robot", "storm", "tiger", "bread", "heart", "juice", "magic", "river",
  "shark", "train", "voice", "watch", "earth", "ghost", "hotel", "image", "planet",
  "guitar", "window", "garden", "island", "nature", "orange", "purple", "silver",
  "anchor", "bridge", "castle", "dragon", "forest", "hammer"
]);

function uniqueLetterCount(word) {
  return new Set(word).size;
}

function vowelRatio(word) {
  let vowels = 0;
  for (const ch of word) if (VOWELS.has(ch)) vowels++;
  return vowels / word.length;
}

function consonantClusterBonus(word) {
  let bonus = 0;
  let run = 0;
  for (const ch of word) {
    if (VOWELS.has(ch)) {
      run = 0;
      continue;
    }
    run++;
    if (run >= 3) bonus += 15;
  }
  return bonus;
}

// Factor 1: how familiar/common the word is likely to be to a casual
// TikTok LIVE audience. Longer + rarer-lettered words score higher
// (harder); a small hand-picked "common core" list gets a discount.
export function computeVocabularyScore(word) {
  let score = Math.min(60, Math.max(0, (word.length - 4) * 5));
  for (const ch of word) score += RARE_LETTER_POINTS[ch] || 0;
  if (COMMON_CORE.has(word)) score = Math.max(0, score - 25);
  // UPDATE 20: the answer bank now has a large "extended" tier of real-but-less-everyday words.
  // They are fair answers, but a bit less familiar, so they lean toward MEDIUM / HARD rounds.
  if (EXTENDED_WORD_SET.has(word)) score += 18;
  return Math.min(100, score);
}

// Factor 2: repeated letters, rare letters, awkward consonant runs,
// and vowel scarcity - all things that make the aggregate-count
// feedback genuinely harder to reason about.
export function computeStructureScore(word) {
  const repeats = word.length - uniqueLetterCount(word);
  let score = repeats * 15;
  score += consonantClusterBonus(word);
  score += Math.max(0, (0.4 - vowelRatio(word)) * 100);
  return Math.min(100, score);
}

// Factor 3: how many other same-length words in the pool are "close"
// to this one (share most of their letters). More look-alikes means
// more genuine ambiguity to sort through while deducing.
export function computeAmbiguityScore(word, sameLengthPool) {
  const wordLetters = new Set(word);
  let similar = 0;
  for (const other of sameLengthPool) {
    if (other === word) continue;
    const otherLetters = new Set(other);
    let shared = 0;
    for (const l of wordLetters) if (otherLetters.has(l)) shared++;
    const overlap = shared / Math.max(wordLetters.size, otherLetters.size);
    if (overlap >= 0.6) similar++;
  }
  return Math.min(100, similar * 10);
}

// Factor 4: a proxy for how much a green/yellow/red count actually
// narrows things down. Repeated letters blur a count's meaning (you
// can't tell which occurrence is which), so lower letter diversity
// roughly means each guess teaches you less.
export function computeInformationScore(word) {
  const diversity = uniqueLetterCount(word) / word.length;
  return Math.min(100, Math.max(0, (1 - diversity) * 100));
}

export function computeDifficultyScore(word, sameLengthPool, weights = DIFFICULTY_WEIGHTS) {
  const vocabulary = computeVocabularyScore(word);
  const structure = computeStructureScore(word);
  const ambiguity = computeAmbiguityScore(word, sameLengthPool);
  const information = computeInformationScore(word);
  const total =
    vocabulary * weights.vocabulary +
    structure * weights.structure +
    ambiguity * weights.ambiguity +
    information * weights.information;
  return { total: Math.round(total), vocabulary, structure, ambiguity, information };
}

export function classifyDifficulty(score, thresholds = DIFFICULTY_THRESHOLDS) {
  if (score <= thresholds.normalMax) return "normal";
  if (score <= thresholds.mediumMax) return "medium";
  return "hard";
}

// UPDATE 20 (performance + scale): the pool is now thousands of words per length, so the
// old "compare every word to every other word with fresh Sets" ambiguity pass would have
// taken minutes at server start. This version uses 26-bit letter masks (a handful of integer
// ops per pair) and converts the raw look-alike count into a PERCENTILE inside its own length
// pool - with big pools almost every word has 10+ look-alikes, so an absolute count would
// have pinned the factor at 100 for everyone and flattened the NORMAL/MEDIUM/HARD split.
function letterMask(word) {
  let m = 0;
  for (let i = 0; i < word.length; i++) m |= 1 << (word.charCodeAt(i) - 97);
  return m;
}

function popcount32(x) {
  x -= (x >>> 1) & 0x55555555;
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  x = (x + (x >>> 4)) & 0x0f0f0f0f;
  return Math.imul(x, 0x01010101) >>> 24;
}

function ambiguityScoresForPool(words) {
  const n = words.length;
  const masks = new Int32Array(n);
  const sizes = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    masks[i] = letterMask(words[i]);
    sizes[i] = popcount32(masks[i]);
  }
  const similar = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    const mi = masks[i];
    const si = sizes[i];
    for (let j = i + 1; j < n; j++) {
      const shared = popcount32(mi & masks[j]);
      if (shared / Math.max(si, sizes[j]) >= 0.6) {
        similar[i]++;
        similar[j]++;
      }
    }
  }
  const scores = new Array(n);
  if (n < 25) {
    // tiny pools (very long words): keep the original absolute scale
    for (let i = 0; i < n; i++) scores[i] = Math.min(100, similar[i] * 10);
    return scores;
  }
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => similar[a] - similar[b]);
  // percentile rank, with ties sharing the average rank so identical counts score identically
  let k = 0;
  while (k < n) {
    let m = k;
    while (m + 1 < n && similar[order[m + 1]] === similar[order[k]]) m++;
    const pct = Math.round((((k + m) / 2) / (n - 1)) * 100);
    for (let t = k; t <= m; t++) scores[order[t]] = pct;
    k = m + 1;
  }
  return scores;
}

// Precomputes and caches { score, tier } for every word in a length-keyed pool (e.g.
// ANSWER_WORDS). Memoized per pool object so the several games that share one word bank
// only pay for the scoring once per server start.
const indexCache = new WeakMap();
export function buildDifficultyIndex(wordsByLength, weights = DIFFICULTY_WEIGHTS, thresholds = DIFFICULTY_THRESHOLDS) {
  const cacheable = weights === DIFFICULTY_WEIGHTS && thresholds === DIFFICULTY_THRESHOLDS;
  if (cacheable && indexCache.has(wordsByLength)) return indexCache.get(wordsByLength);
  const index = new Map(); // word -> { score, tier }
  for (const words of Object.values(wordsByLength)) {
    const ambiguity = ambiguityScoresForPool(words);
    const totals = new Array(words.length);
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const vocabulary = computeVocabularyScore(word);
      const structure = computeStructureScore(word);
      const information = computeInformationScore(word);
      totals[i] = Math.round(
        vocabulary * weights.vocabulary +
        structure * weights.structure +
        ambiguity[i] * weights.ambiguity +
        information * weights.information
      );
    }
    let classify = (score) => classifyDifficulty(score, thresholds);
    if (cacheable && words.length >= MIN_POOL_FOR_SHARES) {
      const sorted = [...totals].sort((a, b) => a - b);
      const normalCut = sorted[Math.max(0, Math.floor(sorted.length * DIFFICULTY_SHARES.normal) - 1)];
      const hardCut = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * (1 - DIFFICULTY_SHARES.hard)))];
      classify = (score) => (score <= normalCut ? "normal" : score > hardCut ? "hard" : "medium");
    }
    for (let i = 0; i < words.length; i++) {
      index.set(words[i], { score: totals[i], tier: classify(totals[i]) });
    }
  }
  if (cacheable) indexCache.set(wordsByLength, index);
  return index;
}

// Returns the candidate words for a given length + tier, falling back
// to the full pool for that length if the tier has nothing to offer
// (common at very long lengths where the curated pool is small).
// tier "random" deliberately skips difficulty filtering entirely -
// every word of that length is eligible, easy to extremely hard.
export function getWordsForDifficulty(wordsByLength, difficultyIndex, wordLength, tier) {
  const pool = wordsByLength[wordLength] || [];
  if (tier === "random") return pool;
  const filtered = pool.filter((w) => difficultyIndex.get(w)?.tier === tier);
  return filtered.length > 0 ? filtered : pool;
}
