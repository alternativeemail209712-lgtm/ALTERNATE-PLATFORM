// ===================================================================
// HOME GAME GROUPS (update 35) - the host makes his own groups (categories) and puts games in them.
// Saved to data/home-groups.json; the browser keeps a copy too (see public/home-views.js).
// If HOME_EDIT_KEY is set in the environment, saving needs that key (same rule as the card customizer).
// ===================================================================
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { GAME_IDS } from "./home-cards-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const DATA_FILE = path.join(DATA_DIR, "home-groups.json");
const MAX_GROUPS = 12;

export function sanitizeGroups(input, updatedAt = 0) {
  const src = input && typeof input === "object" ? input : {};
  const used = new Set();
  const groups = [];
  const raw = Array.isArray(src.groups) ? src.groups : [];
  for (const g of raw) {
    if (groups.length >= MAX_GROUPS || !g || typeof g !== "object") continue;
    const name = String(g.name || "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 24);
    if (!name) continue;
    let id = String(g.id || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 20);
    if (!id || groups.some((x) => x.id === id)) id = "g" + crypto.randomBytes(4).toString("hex");
    const games = [];
    for (const gid of Array.isArray(g.games) ? g.games : []) {
      if (GAME_IDS.includes(gid) && !used.has(gid)) { used.add(gid); games.push(gid); }
    }
    groups.push({ id, name, games });
  }
  return { version: 1, updatedAt, groups };
}

let current = sanitizeGroups({}, 0);
function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    current = sanitizeGroups(raw, Number(raw && raw.updatedAt) || 0);
  } catch (_) { current = sanitizeGroups({}, 0); }
}
function save() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DATA_FILE + "." + process.pid + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(current));
    fs.renameSync(tmp, DATA_FILE);
  } catch (err) { console.error("[home] could not save home-groups.json:", err && err.message ? err.message : err); }
}
function keyOk(req) {
  const wanted = process.env.HOME_EDIT_KEY;
  if (!wanted) return true;
  const a = crypto.createHash("sha256").update(String(req.get("x-edit-key") || "")).digest();
  const b = crypto.createHash("sha256").update(wanted).digest();
  return crypto.timingSafeEqual(a, b);
}

export function mountHomeGroups(app, io, express) {
  load();
  const nsp = io ? io.of("/home-hub") : null;
  if (nsp) nsp.on("connection", (socket) => socket.emit("home:groups", current));
  app.get("/api/home-groups", (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ ...current, editKeyRequired: Boolean(process.env.HOME_EDIT_KEY) });
  });
  app.put("/api/home-groups", express.json({ limit: "32kb" }), (req, res) => {
    if (!keyOk(req)) { res.status(401).json({ error: "edit-key-required" }); return; }
    current = sanitizeGroups(req.body, Date.now());
    save();
    if (nsp) nsp.emit("home:groups", current);
    res.set("Cache-Control", "no-store");
    res.json(current);
  });
  console.log("[home] game groups ready (GET/PUT /api/home-groups)");
}
