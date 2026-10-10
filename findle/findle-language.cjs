// findle-language.cjs (update 48)
// The word-language choice for FINDLE (the other word games use ../shared/word-language.js; FINDLE is
// a CommonJS module with its own themed puzzle lists, so it keeps its own tiny store).
// 7 modes - same ids as every other game: en, id, ms, en-id, en-ms, ms-id, all.
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.resolve(__dirname, "../../data");
const DATA_FILE = path.join(DATA_DIR, "findle-language.json");

const MODES = [
  { id: "en", label: "English", parts: ["en"] },
  { id: "id", label: "Bahasa Indonesia (Indonesian)", parts: ["id"] },
  { id: "ms", label: "Bahasa Melayu (Malaysia)", parts: ["ms"] },
  { id: "en-id", label: "Mixed: English + Indonesian", parts: ["en", "id"] },
  { id: "en-ms", label: "Mixed: English + Bahasa Melayu (Malaysia)", parts: ["en", "ms"] },
  { id: "ms-id", label: "Mixed: Bahasa Melayu (Malaysia) + Indonesian", parts: ["ms", "id"] },
  { id: "all", label: "Mixed: English + Indonesian + Bahasa Melayu", parts: ["en", "id", "ms"] },
];
const BY_ID = new Map(MODES.map((m) => [m.id, m]));

function normalize(mode) {
  const m = String(mode || "").toLowerCase().trim();
  return BY_ID.has(m) ? m : "en";
}
function load() {
  try {
    return normalize(JSON.parse(fs.readFileSync(DATA_FILE, "utf8")).mode);
  } catch (e) {
    return "en";
  }
}
function save(mode) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify({ mode }, null, 2));
  } catch (e) {
    // read-only disk: still works until the next restart
  }
}
function parts(mode) {
  return BY_ID.get(normalize(mode)).parts;
}
function options() {
  return MODES.map(({ id, label }) => ({ id, label }));
}
module.exports = { MODES, normalize, load, save, parts, options };
