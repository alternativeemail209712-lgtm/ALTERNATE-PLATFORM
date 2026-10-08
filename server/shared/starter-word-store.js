// ===================================================================
// STARTER WORD STORE  (update 27)
// Remembers, for every word game, whether the host has "Starter word" switched ON or OFF.
//
//   * Default is ON for every game. It only becomes OFF when the host switches it off in
//     that game's Settings -> "Starter word".
//   * The host's choice is written to data/starter-word.json so it survives a server restart.
//     Only the host's explicit choice is stored; a game that was never touched stays ON.
//   * What a "starter word" IS differs per game (each game scores it with its own clue rules);
//     this file only stores the on/off switch. See CHANGES_UPDATE_27.md.
// ===================================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const DATA_FILE = path.join(DATA_DIR, "starter-word.json");

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

/** Starter word for a game: ON unless the host switched it off. */
export function getStarterWord(gameId) {
  return choices.has(gameId) ? choices.get(gameId) : true;
}

/** Remember the host's choice for a game (true = ON, false = OFF). Returns the stored value. */
export function setStarterWord(gameId, on) {
  const value = Boolean(on);
  if (ID_RE.test(String(gameId))) {
    choices.set(gameId, value);
    scheduleSave();
  }
  return value;
}
