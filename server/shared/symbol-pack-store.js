// ===================================================================
// SYMBOL PACK STORE  (update 28)
// Remembers which symbol pack the host picked for a game that shows a row of symbols
// (SHAPEDLE). Default is the first pack ("cute"). The choice is written to
// data/symbol-pack.json so it survives a server restart.
// ===================================================================
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const DATA_FILE = path.join(DATA_DIR, "symbol-pack.json");
const ID_RE = /^[a-z0-9_-]{1,32}$/;

const choices = new Map(); // gameId -> pack id
let saveTimer = null;

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    for (const [game, id] of Object.entries(raw || {})) {
      if (ID_RE.test(game) && typeof id === "string" && ID_RE.test(id)) choices.set(game, id);
    }
  } catch (e) {
    // first run / unreadable: every game starts on its default pack
  }
}
load();

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(Object.fromEntries(choices), null, 2));
    } catch (e) {
      // read-only disk: the choice still works for this run
    }
  }, 300);
  if (saveTimer.unref) saveTimer.unref();
}

/** The host's pack for a game, or `fallback` when none was chosen / the stored one is no longer valid. */
export function getSymbolPack(gameId, validIds, fallback) {
  const v = choices.get(gameId);
  return v && validIds.includes(v) ? v : fallback;
}

/** Remember the host's choice. Returns the stored value (unchanged `fallback` if the id is not valid). */
export function setSymbolPack(gameId, id, validIds, fallback) {
  const value = validIds.includes(id) ? id : fallback;
  if (ID_RE.test(String(gameId))) {
    choices.set(gameId, value);
    scheduleSave();
  }
  return value;
}
