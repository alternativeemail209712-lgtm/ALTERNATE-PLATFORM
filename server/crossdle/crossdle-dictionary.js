// ============================================================================
// The real dictionary.
//
// The ~3,500-word list in words_fallback.js was hand-curated and is way
// smaller than a genuine dictionary. To get a proper 300,000+ word bank,
// this module fetches a well-known, reputable, public-domain-style English
// word list over the network ONCE when the server starts, then buckets it
// by word length (4-20 letters) in memory.
//
// Why this has to happen at server startup rather than being baked into
// the repo: the file is ~4 MB / ~480,000 words, and there is no practical
// way to hand-embed that as static source code. The server itself (once
// running on Render) has normal internet access, so it downloads its own
// dictionary the same way any Node app fetches data at boot.
//
// Resilience (this must NEVER prevent the game from starting):
//   1. Try the network fetch, with a timeout.
//   2. If that fails, try a local disk cache from a previous successful run.
//   3. If that also fails, fall back to the small bundled word list, so the
//      game still works even fully offline - just with fewer words until
//      connectivity returns.
// Every path is logged to `diagnostics` so the host can see, in the same
// on-screen panel as everything else, which dictionary actually loaded and
// how big it is - never just a silent assumption.
// ============================================================================

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isBlocked } from './crossdle-blocklist.js';
import { ANSWER_WORDS as ANSWER_BANK } from './crossdle-answers.js';

// UPDATE 20: every possible secret/decoy word is always a legal guess, even when only the
// small offline fallback list loaded.
const ANSWER_SETS = {};
for (const [len, list] of Object.entries(ANSWER_BANK)) ANSWER_SETS[len] = new Set(list);
import { FALLBACK_WORD_LISTS, MIN_WORD_LENGTH, MAX_WORD_LENGTH, WORD_LENGTH_OPTIONS } from './crossdle-words_fallback.js';

export { MIN_WORD_LENGTH, MAX_WORD_LENGTH, WORD_LENGTH_OPTIONS };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = path.join(__dirname, '..', '..', 'data', 'crossdle-dictionary-cache.json');
const FETCH_TIMEOUT_MS = 20000;
const MIN_ACCEPTABLE_TOTAL_WORDS = 50000; // sanity floor - if a fetch returns less than this, treat it as a bad/broken response and fall back instead

// A well-known, long-standing public English word list (~480,000 words,
// letters-only). Source: https://github.com/dwyl/english-words
const DICTIONARY_URL = 'https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt';

let WORD_LISTS = FALLBACK_WORD_LISTS; // active word bank - starts as the bundled fallback
let WORD_SETS = buildSets(WORD_LISTS);
let loadInfo = {
  source: 'fallback-embedded',
  totalWords: countTotal(FALLBACK_WORD_LISTS),
  perLength: countPerLength(FALLBACK_WORD_LISTS),
  loadedAt: null,
  error: null,
};

function countTotal(lists) {
  return Object.values(lists).reduce((sum, arr) => sum + arr.length, 0);
}
function countPerLength(lists) {
  const out = {};
  for (const len of Object.keys(lists)) out[len] = lists[len].length;
  return out;
}
function buildSets(lists) {
  const sets = {};
  for (const len of Object.keys(lists)) sets[len] = new Set(lists[len]);
  return sets;
}

/**
 * Parses raw word-list text into buckets keyed by length, applying the
 * same safety/quality filters regardless of where the text came from.
 */
function bucketWords(rawText) {
  const buckets = {};
  for (let len = MIN_WORD_LENGTH; len <= MAX_WORD_LENGTH; len++) buckets[len] = [];

  const seen = new Set();
  const lines = rawText.split('\n');
  for (let line of lines) {
    const w = line.trim().toLowerCase();
    if (!w) continue;
    if (!/^[a-z]+$/.test(w)) continue; // letters only - no punctuation/numbers/proper-noun artifacts with apostrophes etc.
    const len = w.length;
    if (len < MIN_WORD_LENGTH || len > MAX_WORD_LENGTH) continue;
    if (seen.has(w)) continue;
    if (isBlocked(w)) continue;
    seen.add(w);
    buckets[len].push(w);
  }
  return buckets;
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching dictionary`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function saveCache(buckets) {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true });
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ buckets, savedAt: Date.now() }));
  } catch (_) {
    // Best-effort only - a failed cache write never breaks the game.
  }
}

function loadCache() {
  if (!fs.existsSync(CACHE_FILE)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    if (parsed && parsed.buckets) return parsed.buckets;
  } catch (_) {
    // Corrupt/unreadable cache - ignore and fall through.
  }
  return null;
}

/**
 * Loads the real dictionary. Call once at server startup, before accepting
 * any connections. Always resolves (never throws/rejects) - worst case the
 * bundled fallback stays active and that's reflected in getLoadInfo().
 */
export async function loadDictionary(diagnostics) {
  const log = (msg) => console.log(`[dictionary] ${msg}`);

  try {
    log(`Fetching dictionary from ${DICTIONARY_URL} ...`);
    const text = await fetchWithTimeout(DICTIONARY_URL, FETCH_TIMEOUT_MS);
    const buckets = bucketWords(text);
    const total = countTotal(buckets);

    if (total < MIN_ACCEPTABLE_TOTAL_WORDS) {
      throw new Error(`Fetched dictionary only had ${total} usable words - treating as a bad response.`);
    }

    WORD_LISTS = buckets;
    WORD_SETS = buildSets(buckets);
    loadInfo = { source: 'remote', totalWords: total, perLength: countPerLength(buckets), loadedAt: Date.now(), error: null };
    log(`Loaded ${total.toLocaleString()} words from the network.`);
    saveCache(buckets);
    return;
  } catch (err) {
    log(`Network fetch failed (${err.message}). Trying local cache...`);
    if (diagnostics) diagnostics.logError('dictionary.fetch', err);
  }

  try {
    const cached = loadCache();
    if (cached) {
      const total = countTotal(cached);
      if (total >= MIN_ACCEPTABLE_TOTAL_WORDS) {
        WORD_LISTS = cached;
        WORD_SETS = buildSets(cached);
        loadInfo = { source: 'disk-cache', totalWords: total, perLength: countPerLength(cached), loadedAt: Date.now(), error: null };
        log(`Loaded ${total.toLocaleString()} words from a previous run's cache.`);
        return;
      }
    }
  } catch (err) {
    if (diagnostics) diagnostics.logError('dictionary.cache', err);
  }

  // Final fallback: the small bundled list. The game still works, just
  // with far fewer words until the next successful fetch (e.g. next
  // restart, once internet access is available again).
  WORD_LISTS = FALLBACK_WORD_LISTS;
  WORD_SETS = buildSets(FALLBACK_WORD_LISTS);
  loadInfo = {
    source: 'fallback-embedded',
    totalWords: countTotal(FALLBACK_WORD_LISTS),
    perLength: countPerLength(FALLBACK_WORD_LISTS),
    loadedAt: Date.now(),
    error: 'Could not fetch or load a cached dictionary - using the small bundled word list.',
  };
  log('Using the small bundled fallback word list.');
}

export function getLoadInfo() {
  return loadInfo;
}

export function randomWord(length, exclude = []) {
  const pool = WORD_LISTS[length];
  if (!pool || pool.length === 0) return null;
  const ex = new Set(exclude);
  let w;
  let guard = 0;
  do {
    w = pool[Math.floor(Math.random() * pool.length)];
    guard++;
  } while (ex.has(w) && guard < 200);
  return w;
}

export function isKnownWord(w, length) {
  const lw = String(w).toLowerCase();
  if (ANSWER_SETS[length] && ANSWER_SETS[length].has(lw)) return true;
  const set = WORD_SETS[length];
  if (!set) return false;
  return set.has(lw);
}

export function poolSize(length) {
  const pool = WORD_LISTS[length];
  return pool ? pool.length : 0;
}

/** Returns the raw word array for a length (used by Test Mode's simulator). */
export function getWordList(length) {
  return WORD_LISTS[length] || [];
}
