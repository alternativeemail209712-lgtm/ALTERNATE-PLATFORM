// ===================================================================
// SYMBOL OPTIONS STORE  (update 29)
// Everything the host can customize about a game's row of symbols (SHAPEDLE):
//   - which symbol SETS are in play (several can be ticked at once, plus the audience's profile pictures)
//   - whether each round uses ONE of the ticked sets (random) or BLENDS all of them
//   - the look: color intensity, brightness, size, ring around profile pictures
//   - the motion: animated on/off, animation style, speed
// Saved to data/symbol-options.json so it survives a server restart.
// ===================================================================
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const DATA_FILE = path.join(DATA_DIR, "symbol-options.json");
const ID_RE = /^[a-z0-9_-]{1,32}$/;

/** Built-in symbol sets and how many symbols each one has (the browser artwork must have the same counts). */
export const SET_SIZES = {
  cute: 26, plush: 26, classic: 26, animals: 26, sweets: 26, nature: 26,
  flags: 42, professions: 26, sports: 26, transport: 26
};
export const BUILTIN_SET_IDS = Object.keys(SET_SIZES);
export const VIEWERS_SET = "viewers"; // the audience's TikTok profile pictures
export const ALL_SET_IDS = [...BUILTIN_SET_IDS, VIEWERS_SET];
export const ANIM_STYLES = ["float", "bounce", "wiggle", "pulse", "wave"];
export const ANIM_SPEEDS = ["slow", "normal", "fast"];
export const COMBINE_MODES = ["one", "blend"];

export const DEFAULT_OPTIONS = Object.freeze({
  enabledSets: ["cute"],
  combine: "one",        // "one" = one ticked set per round (random) / "blend" = every ticked set mixed in each round
  viewersFirst: true,    // picked profile pictures take the first symbol places of a round
  viewersAuto: true,     // (update 31) ticked audience pictures are used automatically - no need to also tick the "Audience profile pictures" set
  colorIntensity: 100,   // 0-200 (%)
  brightness: 100,       // 60-140 (%)
  size: 100,             // 60-100 (%)
  ring: true,            // white ring around profile pictures
  animated: false,
  animStyle: "float",
  animSpeed: "normal"
});

const clampInt = (v, lo, hi, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : fallback;
};

/** Merge `input` (anything the browser sent) over `base`, keeping only valid values. Never throws. */
export function sanitizeOptions(input, base = DEFAULT_OPTIONS) {
  const src = input && typeof input === "object" ? input : {};
  const out = { ...base, enabledSets: [...base.enabledSets] };
  if (Array.isArray(src.enabledSets)) {
    const seen = new Set();
    const list = src.enabledSets.filter((id) => typeof id === "string" && ALL_SET_IDS.includes(id) && !seen.has(id) && seen.add(id));
    out.enabledSets = list.length ? list : ["cute"];
  }
  if (COMBINE_MODES.includes(src.combine)) out.combine = src.combine;
  if (typeof src.viewersFirst === "boolean") out.viewersFirst = src.viewersFirst;
  if (typeof src.viewersAuto === "boolean") out.viewersAuto = src.viewersAuto;
  if (src.colorIntensity !== undefined) out.colorIntensity = clampInt(src.colorIntensity, 0, 200, out.colorIntensity);
  if (src.brightness !== undefined) out.brightness = clampInt(src.brightness, 60, 140, out.brightness);
  if (src.size !== undefined) out.size = clampInt(src.size, 60, 100, out.size);
  if (typeof src.ring === "boolean") out.ring = src.ring;
  if (typeof src.animated === "boolean") out.animated = src.animated;
  if (ANIM_STYLES.includes(src.animStyle)) out.animStyle = src.animStyle;
  if (ANIM_SPEEDS.includes(src.animSpeed)) out.animSpeed = src.animSpeed;
  return out;
}

const stored = new Map(); // gameId -> options
let saveTimer = null;

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    for (const [game, opts] of Object.entries(raw || {})) {
      if (ID_RE.test(game)) stored.set(game, sanitizeOptions(opts));
    }
  } catch (e) {
    // first run / unreadable: defaults apply
  }
}
load();

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(Object.fromEntries(stored), null, 2));
    } catch (e) {
      // read-only disk: the choice still works for this run
    }
  }, 300);
  if (saveTimer.unref) saveTimer.unref();
}

/** The saved options of a game; `legacy` (optional) is used on the very first run, to carry over an older pick. */
export function getSymbolOptions(gameId, legacy) {
  if (stored.has(gameId)) return stored.get(gameId);
  return sanitizeOptions(legacy || {}, DEFAULT_OPTIONS);
}

/** Apply a (partial) change from the host and remember it. Returns the full, valid options. */
export function setSymbolOptions(gameId, partial) {
  const next = sanitizeOptions(partial, getSymbolOptions(gameId));
  if (ID_RE.test(String(gameId))) {
    stored.set(gameId, next);
    scheduleSave();
  }
  return next;
}
