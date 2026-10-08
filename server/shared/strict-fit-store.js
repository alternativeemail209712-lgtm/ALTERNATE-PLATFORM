// ===================================================================
// STRICT FIT STORE  (update 25)
// One tiny shared helper that remembers, for every word game, whether the host has
// "Strict fit" switched ON or OFF.
//
//   * Default is ON for every game. It only becomes OFF when the host switches it off in
//     that game's Settings -> "Strict fit".
//   * The host's choice is also written to data/strict-fit.json, so it survives a server
//     restart (on hosts with a temporary disk it lasts until the next redeploy). Without
//     this, a restart would silently put Strict fit back ON.
//   * Only the host's explicit choice is stored; a game that was never touched stays ON.
//
// What "Strict fit" MEANS is different in every game (each game applies its own clue rules);
// this file only stores the on/off switch. See CHANGES_UPDATE_25.md for the rule per game.
// ===================================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const DATA_FILE = path.join(DATA_DIR, "strict-fit.json");

const ID_RE = /^[a-z0-9_-]{1,32}$/;

// gameId -> boolean (only games the host has explicitly set are present)
const choices = new Map();
let saveTimer = null;

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    for (const [game, on] of Object.entries(raw || {})) {
      if (ID_RE.test(game) && typeof on === "boolean") choices.set(game, on);
    }
  } catch (e) {
    // no file yet (first run) or unreadable - every game starts ON
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
      // read-only disk: the choice still works for this run, it just won't survive a restart
    }
  }, 300);
  if (saveTimer.unref) saveTimer.unref();
}

/** Strict fit for a game: ON unless the host switched it off. */
export function getStrictFit(gameId) {
  return choices.has(gameId) ? choices.get(gameId) : true;
}

/** Remember the host's choice for a game (true = ON, false = OFF). Returns the stored value. */
export function setStrictFit(gameId, on) {
  const value = Boolean(on);
  if (ID_RE.test(String(gameId))) {
    choices.set(gameId, value);
    scheduleSave();
  }
  return value;
}
