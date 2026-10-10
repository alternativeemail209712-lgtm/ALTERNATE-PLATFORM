// import-wordlist.mjs  (update 50)
// Merge a real dictionary word list (KBBI for Indonesian, Dewan Bahasa dan Pustaka for Malay) into the game.
//
//   node tools/import-wordlist.mjs id  path/to/kbbi-words.txt  [more files...]
//   node tools/import-wordlist.mjs ms  path/to/dbp-words.txt
//
// Accepts plain text, one entry per line (also CSV/TSV: the first column is used). Entries are lowercased,
// cleaned (entry numbers, "(1)", "-" hyphen/space entries and anything not a-z are dropped) and filtered to
// 4-20 letters. Words listed in roots/<lang>-reject.txt (spelling of the OTHER language) are removed.
// The result is MERGED into data/dictionary-<lang>.txt, which the server loads at start-up.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [lang, ...files] = process.argv.slice(2);
if (!["id", "ms"].includes(lang) || !files.length) {
  console.log("usage: node tools/import-wordlist.mjs <id|ms> <wordlist.txt> [more.txt ...]");
  process.exit(1);
}
const readWords = (f) => fs.existsSync(f) ? fs.readFileSync(f, "utf8").toLowerCase().split(/\s+/).filter((w) => /^[a-z]{2,20}$/.test(w)) : [];
const reject = new Set();
for (const f of ["reject.txt", `${lang}-reject.txt`]) {
  const p = path.join(ROOT, "server/shared/lang/roots", f);
  for (const line of fs.existsSync(p) ? fs.readFileSync(p, "utf8").split("\n") : []) {
    if (line.trim().startsWith("#")) continue;
    for (const w of line.toLowerCase().split(/\s+/)) if (w) reject.add(w);
  }
}
const out = path.join(ROOT, "data", `dictionary-${lang}.txt`);
fs.mkdirSync(path.dirname(out), { recursive: true });
const all = new Set(readWords(out));
const before = all.size;
let seen = 0, kept = 0;
for (const f of files) {
  for (const line of fs.readFileSync(f, "utf8").split(/\r?\n/)) {
    const first = line.split(/[\t,;|]/)[0].trim().toLowerCase().replace(/\(\d+\)|\d+$/g, "").trim();
    if (!first) continue;
    seen++;
    if (!/^[a-z]{4,20}$/.test(first) || reject.has(first)) continue;
    kept++;
    all.add(first);
  }
}
fs.writeFileSync(out, [...all].sort().join("\n") + "\n");
console.log(`${lang.toUpperCase()}: read ${seen} entries, usable ${kept}; ${out} now has ${all.size} words (was ${before}).`);
