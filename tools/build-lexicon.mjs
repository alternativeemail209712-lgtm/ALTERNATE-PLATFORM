// build-lexicon.mjs  (update 49)
// Builds the Indonesian / Malay word banks from the ROOT lists in server/shared/lang/roots/
// using the real affix rules (meN-, peN-, ber-, ter-, di-, -an, -kan, -i, ke-an, per-an ...).
//
//   node tools/build-lexicon.mjs
//
// Writes into server/shared/lang/generated/:
//   secret-id.txt / secret-ms.txt   - SECRET words (core + hard, one per line, "word" or "word\thard")
//   dict-id.txt   / dict-ms.txt     - every word a viewer may GUESS (superset of the secret words)
// The game servers read these at start-up; no network needed.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LANG = path.join(ROOT, "server/shared/lang");
const ROOTS = path.join(LANG, "roots");
const OUT = path.join(LANG, "generated");
fs.mkdirSync(OUT, { recursive: true });

const WORD_RE = /^[a-z]{4,20}$/;
// shapes the affix engine can produce by accident but that no real word has
const BAD_RE = /ii|kankan|memper(mem|men|meng|meny)|diper(di|me)|ankan(an|i)$|^meng?me|^dimem|^di(men|meng|meny)/;
const V = "aeiou";
const isV = (c) => V.includes(c);

const OLD = await (async () => {
  const c = await import(path.join(LANG, "lexicon-common.js"));
  const i = await import(path.join(LANG, "lexicon-id.js"));
  const m = await import(path.join(LANG, "lexicon-ms.js"));
  return { common: c, id: { core: i.ID_CORE, hard: i.ID_HARD }, ms: { core: m.MS_CORE, hard: m.MS_HARD } };
})();

// ---------- read a roots file: "@CLASS" headers switch the class, "#" lines are comments ----------
function readRoots(file, defaultClass) {
  const res = []; // [word, class]
  if (!fs.existsSync(file)) return res;
  let cls = defaultClass;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    if (t.startsWith("@")) { cls = t.slice(1).split(/\s+/)[0].toUpperCase(); continue; }
    for (const w of t.toLowerCase().split(/\s+/)) if (/^[a-z]{2,20}$/.test(w)) res.push([w, cls]);
  }
  return res;
}

// ---------- morphology ----------
function syllables(w) {
  // every vowel is a syllable, except the diphthongs ai / au / oi which count once
  let n = 0;
  for (let i = 0; i < w.length; i++) {
    if (!isV(w[i])) continue;
    n++;
    if ((w[i] === "a" && (w[i + 1] === "i" || w[i + 1] === "u")) || (w[i] === "o" && w[i + 1] === "i")) i++;
  }
  return n;
}
const CONS = "bcdfghjklmnpqrstvwxyz";
const isC = (c) => CONS.includes(c);

/** stem after meN- / peN- (prefix "me" or "pe") */
function nasal(p, w) {
  const c = w[0], d = w[1] || "";
  if (syllables(w) === 1) return p + "nge" + w;
  if (isV(c) || c === "g" || c === "h") return p + "ng" + w;
  if (c === "k") return d === "h" ? p + "ng" + w : p + "ng" + w.slice(1);
  if (c === "b" || c === "f" || c === "v") return p + "m" + w;
  if (c === "p") return isC(d) ? p + "m" + w : p + "m" + w.slice(1);
  if (c === "c" || c === "d" || c === "j" || c === "z") return p + "n" + w;
  if (c === "t") return isC(d) ? p + "n" + w : p + "n" + w.slice(1);
  if (c === "s") return isC(d) ? p + "n" + w : p + "ny" + w.slice(1);
  return p + w; // l m n r w y (and ng-/ny- starts)
}
const me = (w) => nasal("me", w);
const pe = (w) => nasal("pe", w);
const di = (w) => "di" + w;
const ter = (w) => (w[0] === "r" ? "te" + w : "ter" + w);
const ERSYL = /^[bcdfghjklmnpqrstvwxyz]er[bcdfghjklmnpqrstvwxyz]/;
function ber(w) {
  if (w === "ajar") return "belajar";
  if (w[0] === "r" || ERSYL.test(w)) return "be" + w;
  return "ber" + w;
}
function perPrefix(w) { // pe- / per- used with -an
  if (w === "ajar") return "pel";
  if (w[0] === "r" || ERSYL.test(w)) return "pe";
  return "per";
}
const an = (w) => w + "an";
const kan = (w) => w + "kan";
const iSuf = (w) => w + "i";
const keAn = (w) => "ke" + w + "an";
const perAn = (w) => perPrefix(w) + w + "an";
const peAn = (w) => pe(w) + "an";
const memper = (w) => "memper" + w;
const diper = (w) => "diper" + w;

// ---------- which forms each class gets: [fn, tier]  tier: "core" | "hard" | "dict" (guess dictionary only) ----------
const meKan = (w) => me(w) + "kan";
const diKan = (w) => di(w) + "kan";
const meI = (w) => me(w) + "i";
const diI = (w) => di(w) + "i";
const memperKan = (w) => "memper" + w + "kan";
const diperKan = (w) => "diper" + w + "kan";
const memperI = (w) => "memper" + w + "i";
const diperI = (w) => "diper" + w + "i";
const se = (w) => "se" + w;
const berAn = (w) => ber(w) + "an";
const meAn = (w) => me(w) + "an";
const FORMS = {
  // Secret words use only the safest forms (core = everyday, hard = longer/formal); every other
  // grammatical form only widens the GUESS dictionary ("dict") so a viewer's real word is never refused.
  // V = transitive verb root
  V: [[me, "core"], [di, "core"], [pe, "dict"], [ter, "dict"], [an, "dict"], [peAn, "dict"], [meKan, "dict"], [diKan, "dict"], [perAn, "dict"]],
  // K = root that takes -kan (menyatakan, dijadikan ...)
  K: [[meKan, "core"], [diKan, "core"], [peAn, "dict"], [an, "dict"]],
  // I = root that takes -i (mendatangi, menyayangi ...)
  I: [[meI, "core"], [diI, "core"], [meKan, "dict"], [diKan, "dict"], [peAn, "dict"]],
  // B = ber- verb root
  B: [[ber, "core"], [pe, "dict"], [perAn, "dict"], [an, "dict"], [peAn, "dict"], [meKan, "dict"], [diKan, "dict"]],
  // A = gradable adjective root
  A: [[ter, "dict"], [keAn, "dict"], [meKan, "dict"], [diKan, "dict"]],
  // M = adjectives that really take memper- / intransitive me- (curated)
  M: [[(w) => w, "core"], [me, "dict"], [memper, "dict"], [diper, "dict"], [memperKan, "dict"], [diperKan, "dict"], [memperI, "dict"], [diperI, "dict"]],
  // D = looser ber-/pe- roots: guess dictionary only; the plain root is still a valid secret word
  D: [[(w) => w, "core"], [ber, "dict"], [pe, "dict"]],
  // W = broad verb-like root (update 50): the plain root is a secret word, every grammatical form only widens the GUESS dictionary
  W: [[me, "dict"], [di, "dict"], [pe, "dict"], [ter, "dict"], [ber, "dict"], [an, "dict"], [peAn, "dict"], [perAn, "dict"], [keAn, "dict"],
      [meKan, "dict"], [diKan, "dict"], [meI, "dict"], [diI, "dict"]],
  // Y = broad noun root (update 50): ber- / ke-an / per-an / se- forms are guess-dictionary only
  Y: [[ber, "dict"], [keAn, "dict"], [perAn, "dict"], [se, "dict"]],
  // Z = broad adjective / state root (update 50)
  Z: [[ter, "dict"], [keAn, "dict"], [se, "dict"], [me, "dict"], [meKan, "dict"], [diKan, "dict"], [memper, "dict"], [diper, "dict"]],
  N: [],
  X: [],
  // P = plain word (the existing noun lists): derived forms are guess-dictionary only
  P: [[ber, "dict"], [keAn, "dict"], [perAn, "dict"], [se, "dict"], [pe, "dict"]],
  H: []
};

// ---------- update 52: EXTENDED tier (wider guess acceptance, kept in its own file) ----------
const terKan = (w) => ter(w) + "kan";
const terI = (w) => ter(w) + "i";
const berKan = (w) => ber(w) + "kan";
const pen = (w) => pe(w);
// stacked prefixes that no real word has (kept for the extended tier only)
const EXT_BAD_RE = /^(memper|diper)(ber|ter|per|pen|peng|pem|mem|men|meng|meny|di|ke|se)|^(ter|ber|di|me[mn]g?y?)(ber|ter|pem|pen|peng)[a-z]|^(di|ter|ber)(me[mn]g?y?)(ber|ter)|^(mem|men|meng|meny|me)(ber|ter|di)[a-z]|^(ber|ter)(memper|diper)/;
const EXT_BY_CLASS = {
  // verb-like roots: the prefixes / suffixes they may still be missing
  V: [ber, keAn, memper, diper, memperKan, diperKan, terKan, berKan, se],
  K: [ber, keAn, perAn, pe, me, di, an, se, terKan],
  I: [ber, keAn, perAn, pe, me, di, an, se, terI],
  B: [me, di, ter, keAn, memper, diper, berAn, se],
  W: [memper, diper, memperKan, diperKan, terKan, berKan, terI, memperI, diperI, se],
  D: [me, di, ter, keAn, perAn, peAn, meKan, diKan, se, an],
  M: [ber, keAn, perAn, pe, se, an],
  // adjective-like roots
  A: [me, pe, memper, diper, se, peAn, an, meI, diI, memperI, diperI, memperKan, diperKan],
  Z: [pe, peAn, an, meI, diI, memperI, diperI, memperKan, diperKan],
  // noun-like roots (the existing plain-word lists and the new broad noun roots)
  Y: [me, di, pe, peAn, meKan, diKan, meI, diI, ter, an, memper, diper],
  P: [me, di, peAn, meKan, diKan, meI, diI, ter, an]
};
export function derive(root, cls) {
  const out = [];
  const forms = FORMS[cls] || [];
  for (const [fn, tier] of forms) {
    let w;
    try { w = fn(root); } catch (e) { continue; }
    if (w && WORD_RE.test(w)) out.push([w, tier]);
  }
  return out;
}

// ---------- build one language ----------
function buildLang(lang) {
  // every roots file named <common|lang>-<class>[digit].txt is read; the letter after the dash is the class
  const CLASS_OF = { v: "V", b: "B", a: "A", n: "P", k: "K", i: "I", h: "H", d: "D", x: "X", m: "M", w: "W", y: "Y", z: "Z" };
  const files = [];
  for (const f of fs.readdirSync(ROOTS).sort()) {
    const m = f.match(new RegExp(`^(common|${lang})-([vbankihdxmwyz])\\d*\\.txt$`));
    if (m) files.push([f, CLASS_OF[m[2]]]);
  }
  const secret = new Map(); // word -> "core" | "hard"
  const dict = new Set();
  const add = (w, tier) => {
    if (!WORD_RE.test(w) || BAD_RE.test(w)) return;
    dict.add(w);
    if (tier === "core") secret.set(w, "core");
    else if (tier === "hard" && secret.get(w) !== "core") secret.set(w, "hard");
  };
  const roots = [];
  for (const [f, def] of files) roots.push(...readRoots(path.join(ROOTS, f), def));
  // words that belong to the OTHER language (or are refused) never get derived forms in this language
  const rejectEarly = new Set();
  for (const f of ["reject.txt", `${lang}-reject.txt`]) for (const [w] of readRoots(path.join(ROOTS, f), "P")) rejectEarly.add(w);
  const ext = new Set();
  for (const [w, cls] of roots) {
    if (rejectEarly.has(w)) continue;
    if (EXT_BY_CLASS[cls] && w.length >= 3) {
      for (const fn of EXT_BY_CLASS[cls]) {
        let d; try { d = fn(w); } catch (e) { continue; }
        if (d && d.length <= 17 && WORD_RE.test(d) && !BAD_RE.test(d) && !EXT_BAD_RE.test(d)) ext.add(d);
      }
    }
    // the root itself
    if (cls === "H") add(w, "hard");
    else if (cls === "X") add(w, "dict");
    else add(w, "core");
    for (const [d, tier] of derive(w, cls)) add(d, tier);
  }
  // the curated lexicons from update 48 are kept as the base (core = everyday, hard = longer / formal)
  const { COMMON_CORE, COMMON_HARD } = OLD.common;
  const own = lang === "id" ? OLD.id : OLD.ms;
  const oldTok = (t) => String(t || "").toLowerCase().split(/\s+/).filter((w) => WORD_RE.test(w));
  for (const w of [...oldTok(COMMON_CORE), ...oldTok(own.core)]) add(w, "core");
  for (const w of [...oldTok(COMMON_HARD), ...oldTok(own.hard)]) add(w, "hard");
  // explicit extra words (already fully formed)
  for (const [w] of readRoots(path.join(ROOTS, `${lang}-extra-dict.txt`), "P")) dict.add(w);
  // wrong-for-this-language words and sensitive words are removed from the SECRET list (still guessable if real)
  const nosecret = new Set();
  for (const f of ["nosecret.txt", `${lang}-nosecret.txt`]) for (const [w] of readRoots(path.join(ROOTS, f), "P")) nosecret.add(w);
  for (const w of nosecret) secret.delete(w);
  const reject = new Set();
  for (const f of ["reject.txt", `${lang}-reject.txt`]) for (const [w] of readRoots(path.join(ROOTS, f), "P")) reject.add(w);
  for (const w of reject) { secret.delete(w); dict.delete(w); }
  for (const w of secret.keys()) dict.add(w);
  for (const w of reject) ext.delete(w);
  for (const w of dict) ext.delete(w);
  return { secret, dict, ext, roots: roots.length };
}

function write(lang) {
  const { secret, dict, ext, roots } = buildLang(lang);
  const sl = [...secret.entries()].sort((a, b) => a[0].length - b[0].length || (a[0] < b[0] ? -1 : 1))
    .map(([w, t]) => (t === "hard" ? w + "\thard" : w));
  fs.writeFileSync(path.join(OUT, `secret-${lang}.txt`), sl.join("\n") + "\n");
  fs.writeFileSync(path.join(OUT, `dict-${lang}.txt`), [...dict].sort().join("\n") + "\n");
  fs.writeFileSync(path.join(OUT, `dict-ext-${lang}.txt`), [...ext].sort().join("\n") + "\n");
  console.log(lang.toUpperCase(), "extended tier:", ext.size, "-> total guessable:", dict.size + ext.size);
  const byLen = {};
  for (const w of secret.keys()) byLen[w.length] = (byLen[w.length] || 0) + 1;
  console.log(lang.toUpperCase(), "roots:", roots, "secret:", secret.size, "dict:", dict.size);
  console.log("  secret by length:", JSON.stringify(byLen));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) { write("id"); write("ms"); }
