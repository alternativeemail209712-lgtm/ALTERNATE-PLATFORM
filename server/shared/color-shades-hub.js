// ===================================================================
// COLOR SHADES HUB  (update 16)
// One tiny, game-agnostic Socket.IO namespace (/shades) that remembers, for EVERY game on
// the platform, which of the 10 shades the host picked for each of that game's colors.
//
// Why a hub instead of per-game code: the host settings panel and the on-stream display are
// often two different browsers (e.g. OBS). Keeping the choice here means every screen
// connected to the same game changes together, instantly, with no new round needed.
//
// The server only stores INDEXES (0-9) keyed by game id + color id. The real colors, and
// which colors each game has, live in /public/shared/color-shades.js.
// The choices are also written to data/color-shades.json so they survive a restart
// (on hosts with a temporary disk they simply last until the next redeploy).
// ===================================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const DATA_FILE = path.join(DATA_DIR, "color-shades.json");

export const SHADE_COUNT = 10; // 0 = lightest ... 9 = darkest
const ID_RE = /^[a-z0-9_-]{1,32}$/;
const MAX_GAMES = 40;
const MAX_COLORS_PER_GAME = 16;

// gameId -> { colorId: shadeIndex }   (only colors that differ from "standard" are stored)
const store = new Map();
let io = null;
let saveTimer = null;

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    for (const [game, colors] of Object.entries(raw || {})) {
      if (!ID_RE.test(game) || typeof colors !== "object" || !colors) continue;
      const clean = {};
      for (const [id, v] of Object.entries(colors)) {
        const n = Math.round(Number(v));
        if (ID_RE.test(id) && Number.isFinite(n) && n >= 0 && n < SHADE_COUNT) clean[id] = n;
      }
      store.set(game, clean);
    }
  } catch (e) {
    // no file yet (first run) or unreadable - start from standard shades
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(Object.fromEntries(store), null, 2));
    } catch (e) {
      // read-only disk: the choices still work, they just won't survive a restart
    }
  }, 400);
}

function room(game) {
  return "shades:" + game;
}

function broadcast(game) {
  if (!io) return;
  io.of("/shades").to(room(game)).emit("shades:state", { game, shades: store.get(game) || {} });
}

export const ColorShadesHub = {
  init(ioServer) {
    io = ioServer;
    load();
    io.of("/shades").on("connection", (socket) => {
      let joined = null;

      socket.on("shades:join", (payload) => {
        const game = payload && payload.game;
        if (typeof game !== "string" || !ID_RE.test(game)) return;
        if (joined) socket.leave(room(joined));
        joined = game;
        socket.join(room(game));
        socket.emit("shades:state", { game, shades: store.get(game) || {} });
      });

      socket.on("shades:set", (payload) => {
        const game = payload && payload.game;
        const color = payload && payload.color;
        const shade = Math.round(Number(payload && payload.shade));
        if (typeof game !== "string" || !ID_RE.test(game)) return;
        if (typeof color !== "string" || !ID_RE.test(color)) return;
        if (!Number.isFinite(shade) || shade < 0 || shade >= SHADE_COUNT) return;
        if (!store.has(game) && store.size >= MAX_GAMES) return;
        const cur = { ...(store.get(game) || {}) };
        if (!(color in cur) && Object.keys(cur).length >= MAX_COLORS_PER_GAME) return;
        cur[color] = shade;
        store.set(game, cur);
        scheduleSave();
        broadcast(game);
      });

      socket.on("shades:reset", (payload) => {
        const game = payload && payload.game;
        if (typeof game !== "string" || !ID_RE.test(game)) return;
        store.delete(game);
        scheduleSave();
        broadcast(game);
      });
    });
  }
};
