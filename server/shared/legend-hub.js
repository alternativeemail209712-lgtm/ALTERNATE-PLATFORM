// ===================================================================
// LEGEND HUB  (update 24)
// A tiny, game-agnostic Socket.IO namespace (/legends) that remembers, for EVERY game on the
// platform, how the host customised that game's color legend (position, size, font, order,
// texts, columns/rows, rows x columns grid, fill order ...). Same idea as the color-shades hub: the host settings panel and the
// on-stream display are often two different browsers (e.g. OBS), so keeping the settings here
// makes every screen connected to the same game change together, instantly.
//
// The server never interprets the legend - it only validates the shape/size of what it is
// given (so a bad client can't store junk) and stores it keyed by game id. The real default
// legends live in /public/shared/legend.js. Settings are also written to data/legends.json so
// they survive a restart (on hosts with a temporary disk they last until the next redeploy).
// ===================================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const DATA_FILE = path.join(DATA_DIR, "legends.json");

const ID_RE = /^[a-z0-9_-]{1,32}$/;
const COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const MAX_GAMES = 40;
const MAX_ITEMS = 16;

const POSITIONS = ["top", "aboveKeyboard", "belowKeyboard", "aboveBoard", "belowBoard"];
const FLOWS = ["row", "column"];
const OVERFLOWS = ["grow", "hide"];
const ITEM_LAYOUTS = ["side", "rev", "stack"];
const CELL_FITS = ["equal", "content"];
const CELL_ALIGNS = ["auto", "start", "center", "end"];
const MAX_GRID = 12;
const ALIGNS = ["left", "center", "right"];
const SHAPES = ["square", "rounded", "circle", "bar"];

const store = new Map(); // gameId -> sanitized settings object
let io = null;
let saveTimer = null;

function str(v, max) {
  return typeof v === "string" ? v.slice(0, max) : "";
}
function num(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
function pick(v, list, fallback) {
  return list.includes(v) ? v : fallback;
}

/** Returns a clean copy of the settings, or null if the payload is unusable. */
export function sanitizeLegend(raw) {
  if (!raw || typeof raw !== "object") return null;
  const out = {
    visible: raw.visible !== false,
    position: pick(raw.position, POSITIONS, "top"),
    align: pick(raw.align, ALIGNS, "center"),
    showTitle: raw.showTitle !== false,
    title: str(raw.title, 80),
    showText: raw.showText !== false,
    panel: raw.panel !== false,
    autoFit: raw.autoFit !== false,
    shape: pick(raw.shape, SHAPES, "rounded"),
    scale: Math.round(num(raw.scale, 50, 220, 100)),
    chipScale: Math.round(num(raw.chipScale, 50, 220, 100)),
    // Update 31: separate row / column spacing (older saves only had "gap": columns used 1.6 x gap).
    rowGap: Math.round(num(raw.rowGap !== undefined ? raw.rowGap : raw.gap, 0, 60, 6)),
    colGap: Math.round(num(raw.colGap !== undefined ? raw.colGap : (Number.isFinite(Number(raw.gap)) ? Number(raw.gap) * 1.6 : 10), 0, 60, 10)),
    maxWidth: Math.round(num(raw.maxWidth, 200, 1200, 640)),
    columns: Math.round(num(raw.columns, 0, MAX_GRID, 0)),
    rows: Math.round(num(raw.rows, 0, MAX_GRID, 0)),
    // Older saves with only "rows" filled column by column; keep that look.
    flow: pick(raw.flow, FLOWS, Number(raw.rows) > 0 && !(Number(raw.columns) > 0) ? "column" : "row"),
    overflow: pick(raw.overflow, OVERFLOWS, "grow"),
    itemLayout: pick(raw.itemLayout, ITEM_LAYOUTS, "side"),
    cellFit: pick(raw.cellFit, CELL_FITS, "equal"),
    cellAlign: pick(raw.cellAlign, CELL_ALIGNS, "auto"),
    font: str(raw.font, 24).replace(/[^a-z0-9_-]/gi, ""),
    items: []
  };
  if (Array.isArray(raw.items)) {
    for (const it of raw.items.slice(0, MAX_ITEMS)) {
      if (!it || typeof it !== "object" || !ID_RE.test(String(it.id || ""))) continue;
      const clean = {
        id: String(it.id),
        enabled: it.enabled !== false,
        label: str(it.label, 80),
        glyph: str(it.glyph, 6)
      };
      if (typeof it.color === "string" && COLOR_RE.test(it.color)) clean.color = it.color;
      out.items.push(clean);
    }
  }
  return out;
}

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    for (const [game, settings] of Object.entries(raw || {})) {
      if (!ID_RE.test(game)) continue;
      const clean = sanitizeLegend(settings);
      if (clean) store.set(game, clean);
    }
  } catch (e) {
    // no file yet (first run) or unreadable - every game starts from its default legend
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(Object.fromEntries(store), null, 2));
    } catch (e) {
      // read-only disk: the settings still work, they just won't survive a restart
    }
  }, 400);
}

function room(game) {
  return "legend:" + game;
}

// `by` = the id of the screen that made the change, so that screen can ignore its own echo (update 31:
// otherwise an echo of an older edit could arrive while the host is still typing and overwrite it).
// `kind` tells screens why they got the state: "join" (first state after connecting), "update" or "reset".
function broadcast(game, by, kind) {
  if (!io) return;
  io.of("/legends").to(room(game)).emit("legend:state", { game, settings: store.get(game) || null, by: by || "", kind: kind || "update" });
}
function clientId(v) {
  return typeof v === "string" ? v.replace(/[^a-z0-9]/gi, "").slice(0, 24) : "";
}

export const LegendHub = {
  init(ioServer) {
    io = ioServer;
    load();
    io.of("/legends").on("connection", (socket) => {
      let joined = null;

      socket.on("legend:join", (payload) => {
        const game = payload && payload.game;
        if (typeof game !== "string" || !ID_RE.test(game)) return;
        if (joined) socket.leave(room(joined));
        joined = game;
        socket.join(room(game));
        socket.emit("legend:state", { game, settings: store.get(game) || null, by: "", kind: "join" });
      });

      socket.on("legend:set", (payload) => {
        const game = payload && payload.game;
        if (typeof game !== "string" || !ID_RE.test(game)) return;
        const clean = sanitizeLegend(payload.settings);
        if (!clean) return;
        if (!store.has(game) && store.size >= MAX_GAMES) return;
        store.set(game, clean);
        scheduleSave();
        broadcast(game, clientId(payload.cid), "update");
      });

      socket.on("legend:reset", (payload) => {
        const game = payload && payload.game;
        if (typeof game !== "string" || !ID_RE.test(game)) return;
        store.delete(game);
        scheduleSave();
        broadcast(game, clientId(payload.cid), "reset");
      });
    });
  }
};
