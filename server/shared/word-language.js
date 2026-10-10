// ===================================================================
// WORD LANGUAGE  (update 48)
// One shared module that gives every letter word game a choice of WORD LANGUAGE.
//
//   7 modes:  en      English
//             id      Bahasa Indonesia (Indonesian)
//             ms      Bahasa Melayu (Malaysia)
//             en-id   Mixed: English + Indonesian
//             en-ms   Mixed: English + Bahasa Melayu (Malaysia)
//             ms-id   Mixed: Bahasa Melayu (Malaysia) + Indonesian
//             all     Mixed: all three languages
//
// What it provides to a game:
//   getLanguage(gameId) / setLanguage(gameId, mode)  - the host's choice (default "en"),
//                                                      remembered in data/word-language.json
//   getBank(mode, enAnswers)  -> { answers, maxLength, minLength, ... }
//        answers      the secret-word pool, same shape as the old ANSWER_WORDS ({4:[...], 5:[...]})
//        maxLength    longest word length that has words in this mode
//   isValidGuess(mode, word)   - is this a real word in (any of) the chosen language(s)?
//   getWordsForDifficulty(...) - same as the old one, but in MIXED modes every language gets a
//                                fair share of the rounds (English is ~4x bigger, so it would
//                                otherwise drown the others)
//
// English keeps using the existing 8,600-word answer bank + 370,000-word guess dictionary.
// Indonesian / Malay use the bundled lexicons in ./lang/ for secret words. For ACCEPTING guesses
// they can use a much bigger dictionary: drop a plain text file (one word per line) at
//   data/dictionary-id.txt   and/or   data/dictionary-ms.txt
// or set the env vars ID_DICTIONARY_URL / MS_DICTIONARY_URL. See CHANGES_UPDATE_48.md.
// ===================================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  ANSWER_WORDS as EN_ANSWERS,
  EXTENDED_WORD_SET,
  MIN_WORD_LENGTH,
  MAX_WORD_LENGTH
} from "../blindle/blindle-answers.js";
import { isValidGuessWord as enIsValid } from "../blindle/blindle-dictionary.js";
import { getWordsForDifficulty as baseGetWordsForDifficulty } from "../blindle/blindle-difficulty.js";
import { COMMON_CORE, COMMON_HARD } from "./lang/lexicon-common.js";
import { ID_CORE, ID_HARD } from "./lang/lexicon-id.js";
import { MS_CORE, MS_HARD } from "./lang/lexicon-ms.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const DATA_FILE = path.join(DATA_DIR, "word-language.json");

export { MIN_WORD_LENGTH, MAX_WORD_LENGTH };

// ---------- the 7 modes ----------
export const LANGUAGE_MODES = [
  { id: "en", label: "English", short: "EN", parts: ["en"] },
  { id: "id", label: "Bahasa Indonesia (Indonesian)", short: "ID", parts: ["id"] },
  { id: "ms", label: "Bahasa Melayu (Malaysia)", short: "MS", parts: ["ms"] },
  { id: "en-id", label: "Mixed: English + Indonesian", short: "EN+ID", parts: ["en", "id"] },
  { id: "en-ms", label: "Mixed: English + Bahasa Melayu (Malaysia)", short: "EN+MS", parts: ["en", "ms"] },
  { id: "ms-id", label: "Mixed: Bahasa Melayu (Malaysia) + Indonesian", short: "MS+ID", parts: ["ms", "id"] },
  { id: "all", label: "Mixed: English + Indonesian + Bahasa Melayu", short: "EN+ID+MS", parts: ["en", "id", "ms"] }
];
const MODE_BY_ID = new Map(LANGUAGE_MODES.map((m) => [m.id, m]));
export const DEFAULT_LANGUAGE = "en";

export function normalizeMode(mode) {
  const m = String(mode || "").toLowerCase().trim();
  return MODE_BY_ID.has(m) ? m : DEFAULT_LANGUAGE;
}
export function modeInfo(mode) {
  return MODE_BY_ID.get(normalizeMode(mode));
}
/** What the browsers need to draw the selector. */
export function languageOptionsForClient() {
  return LANGUAGE_MODES.map(({ id, label, short }) => ({ id, label, short }));
}

// ---------- the host's remembered choice (per game) ----------
const ID_RE = /^[a-z0-9_-]{1,32}$/;
const choices = new Map();
let saveTimer = null;
try {
  const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  for (const [game, mode] of Object.entries(raw || {})) {
    if (ID_RE.test(game) && MODE_BY_ID.has(mode)) choices.set(game, mode);
  }
} catch (e) {
  // first run / unreadable: every game starts on English
}
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(Object.fromEntries(choices), null, 2));
    } catch (e) {
      // read-only disk: still works for this run
    }
  }, 300);
  if (saveTimer.unref) saveTimer.unref();
}
export function getLanguage(gameId) {
  return choices.has(gameId) ? choices.get(gameId) : DEFAULT_LANGUAGE;
}
export function setLanguage(gameId, mode) {
  const value = normalizeMode(mode);
  if (ID_RE.test(String(gameId))) {
    choices.set(gameId, value);
    scheduleSave();
  }
  return value;
}

// ---------- bundled lexicons ----------
const WORD_RE = /^[a-z]{4,20}$/;
function tokens(raw) {
  return String(raw || "").toLowerCase().split(/\s+/).filter((w) => WORD_RE.test(w));
}
function bucket(words) {
  const out = {};
  for (let n = MIN_WORD_LENGTH; n <= MAX_WORD_LENGTH; n++) out[n] = [];
  for (const w of words) if (out[w.length]) out[w.length].push(w);
  return out;
}

const COMMON_SET = new Set([...tokens(COMMON_CORE), ...tokens(COMMON_HARD)]);
const ID_HARD_SET = new Set(tokens(ID_HARD));
const MS_HARD_SET = new Set(tokens(MS_HARD));
const COMMON_HARD_SET = new Set(tokens(COMMON_HARD));

// word lists per language (Set, so a word appears once)
const LEX = {
  id: new Set([...COMMON_SET, ...tokens(ID_CORE), ...ID_HARD_SET]),
  ms: new Set([...COMMON_SET, ...tokens(MS_CORE), ...MS_HARD_SET])
};
// Harder / more formal words lean toward MEDIUM / HARD rounds in the difficulty engine.
for (const w of [...COMMON_HARD_SET, ...ID_HARD_SET, ...MS_HARD_SET]) EXTENDED_WORD_SET.add(w);

const LEX_BY_LENGTH = { id: bucket(LEX.id), ms: bucket(LEX.ms) };

// ---------- bigger guess dictionaries for ID / MS (optional, loaded in the background) ----------
const BIG = { id: new Set(), ms: new Set() };
export const languageDictionaryState = {
  id: { source: "bundled", wordCount: LEX.id.size, loading: true, lastError: null },
  ms: { source: "bundled", wordCount: LEX.ms.size, loading: true, lastError: null }
};
const DEFAULT_URLS = {
  id: "https://raw.githubusercontent.com/damzaky/kumpulan-kata-bahasa-indonesia-KBBI/master/list_1.0.0.txt",
  ms: ""
};

function parseWordFile(text) {
  const out = new Set();
  for (const line of String(text || "").split(/\r?\n/)) {
    const w = line.trim().toLowerCase();
    if (WORD_RE.test(w)) out.add(w);
  }
  return out;
}
async function fetchText(url, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}
async function loadBigDictionary(lang) {
  const state = languageDictionaryState[lang];
  const file = path.join(DATA_DIR, `dictionary-${lang}.txt`);
  const envUrl = process.env[`${lang.toUpperCase()}_DICTIONARY_URL`];
  const url = envUrl !== undefined ? envUrl : DEFAULT_URLS[lang];
  try {
    // 1) a file the host dropped into /data (or saved by an earlier download) always wins
    if (fs.existsSync(file)) {
      const set = parseWordFile(fs.readFileSync(file, "utf8"));
      if (set.size >= 500) {
        BIG[lang] = set;
        state.source = "file";
        state.wordCount = new Set([...LEX[lang], ...set]).size;
        return;
      }
    }
    // 2) otherwise try the network (a failure is fine: the bundled lexicon still works)
    if (url) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const set = parseWordFile(await fetchText(url, 20000));
          if (set.size < 5000) throw new Error(`unexpectedly small list (${set.size})`);
          BIG[lang] = set;
          state.source = "download";
          state.wordCount = new Set([...LEX[lang], ...set]).size;
          try {
            fs.mkdirSync(DATA_DIR, { recursive: true });
            fs.writeFileSync(file, [...set].join("\n"));
          } catch (e) {
            // read-only disk: fine
          }
          return;
        } catch (err) {
          state.lastError = err?.message || String(err);
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }
  } catch (e) {
    state.lastError = e?.message || String(e);
  } finally {
    state.loading = false;
    console.log(`[WordLanguage] ${lang.toUpperCase()} guess dictionary: ${state.source}, ${state.wordCount.toLocaleString()} words` + (state.lastError ? ` (note: ${state.lastError})` : ""));
  }
}
loadBigDictionary("id");
loadBigDictionary("ms");

// ---------- banks (cached, so the difficulty engine's cache keeps working) ----------
const bankCache = new WeakMap(); // enAnswers object -> Map(mode -> bank)

function langWordsOfLength(lang, enAnswers, n) {
  if (lang === "en") return enAnswers[n] || [];
  return LEX_BY_LENGTH[lang][n] || [];
}
function langSize(lang, enAnswers) {
  if (lang === "en") return Object.values(enAnswers).reduce((s, a) => s + a.length, 0);
  return LEX[lang].size;
}

function buildBank(mode, enAnswers) {
  const info = modeInfo(mode);
  if (info.id === "en") {
    return { mode: "en", parts: ["en"], answers: enAnswers, minLength: MIN_WORD_LENGTH, maxLength: MAX_WORD_LENGTH, info };
  }
  const answers = {};
  for (let n = MIN_WORD_LENGTH; n <= MAX_WORD_LENGTH; n++) {
    const seen = new Set();
    const list = [];
    for (const lang of info.parts) {
      for (const w of langWordsOfLength(lang, enAnswers, n)) {
        if (!seen.has(w)) {
          seen.add(w);
          list.push(w);
        }
      }
    }
    answers[n] = list;
  }

  // longest length L such that EVERY length 4..L has a healthy pool
  let maxLength = MIN_WORD_LENGTH;
  for (let n = MIN_WORD_LENGTH; n <= MAX_WORD_LENGTH; n++) {
    if (answers[n].length >= 6) maxLength = n;
    else break;
  }

  // fair share for mixed modes: at every word length each language gets about the same chance
  // per round (English is several times bigger, so its words are not repeated in the pool while
  // the smaller languages' words are repeated a few times - see getWordsForDifficulty below).
  if (info.parts.length > 1) {
    const langSets = { en: new Set(Object.values(enAnswers).flat()), id: LEX.id, ms: LEX.ms };
    const weights = {};
    for (let n = MIN_WORD_LENGTH; n <= MAX_WORD_LENGTH; n++) {
      const sizes = {};
      for (const l of info.parts) sizes[l] = langWordsOfLength(l, enAnswers, n).length;
      const live = info.parts.filter((l) => sizes[l] > 0);
      const m = new Map();
      if (live.length > 1) {
        const minWeight = Math.min(...live.map((l) => 1 / sizes[l]));
        for (const w of answers[n]) {
          let weight = 0;
          for (const l of live) if (langSets[l].has(w)) weight += 1 / sizes[l];
          m.set(w, Math.max(1, Math.min(12, Math.round((weight || minWeight) / minWeight))));
        }
      }
      weights[n] = m;
    }
    Object.defineProperty(answers, "__weights", { value: weights, enumerable: false });
  }
  return { mode: info.id, parts: info.parts, answers, minLength: MIN_WORD_LENGTH, maxLength, info };
}

/** The word bank for a mode. `enAnswers` lets a game (TEXTLE) supply its own English pool. */
export function getBank(mode, enAnswers = EN_ANSWERS) {
  const key = normalizeMode(mode);
  let perMode = bankCache.get(enAnswers);
  if (!perMode) {
    perMode = new Map();
    bankCache.set(enAnswers, perMode);
  }
  if (!perMode.has(key)) perMode.set(key, buildBank(key, enAnswers));
  return perMode.get(key);
}

// ---------- guess checking ----------
export function isValidGuess(mode, word) {
  const w = String(word || "").toLowerCase();
  const parts = modeInfo(mode).parts;
  for (const l of parts) {
    if (l === "en") {
      if (enIsValid(w)) return true;
    } else if (LEX[l].has(w) || BIG[l].has(w)) {
      return true;
    }
  }
  return false;
}

/** Which language(s) a word belongs to, e.g. ["id","ms"] (for labels / diagnostics). */
export function languagesOfWord(word) {
  const w = String(word || "").toLowerCase();
  const out = [];
  if (enIsValid(w)) out.push("en");
  if (LEX.id.has(w) || BIG.id.has(w)) out.push("id");
  if (LEX.ms.has(w) || BIG.ms.has(w)) out.push("ms");
  return out;
}

/** Same signature as the old getWordsForDifficulty; mixed modes are balanced between languages. */
export function getWordsForDifficulty(answers, difficultyIndex, wordLength, tier) {
  const list = baseGetWordsForDifficulty(answers, difficultyIndex, wordLength, tier);
  const weights = answers.__weights && answers.__weights[wordLength];
  if (!weights) return list;
  const out = [];
  for (const w of list) {
    const r = weights.get(w) || 1;
    for (let i = 0; i < r; i++) out.push(w);
  }
  return out;
}

/** Small summary for the Diagnostics panels. */
export function describeLanguage(mode) {
  const info = modeInfo(mode);
  const bank = getBank(info.id);
  const total = Object.values(bank.answers).reduce((s, a) => s + a.length, 0);
  return {
    mode: info.id,
    label: info.label,
    short: info.short,
    secretWords: total,
    maxLength: bank.maxLength,
    idGuessWords: languageDictionaryState.id.wordCount,
    msGuessWords: languageDictionaryState.ms.wordCount,
    idSource: languageDictionaryState.id.source,
    msSource: languageDictionaryState.ms.source
  };
}
export { LEX as BUNDLED_LEXICON };
