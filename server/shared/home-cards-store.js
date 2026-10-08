// ===================================================================
// HOME GAME-CARD CUSTOMIZATION STORE  (update 30)
// Everything the host can change about the game cards on the HOME page:
//   colors (background, border, 3D bottom edge, corner circle, title, description, icon circle, play text,
//   tags), border style/width, corner radius, 3D depth, title font, the icon / title / description / button
//   text, hiding a card, and the order of the cards.
//
// Saved to data/home-cards.json so it survives a restart and is shared by the host's phone, tablet and
// desktop. The browser also keeps its own copy (see public/home.js), so a wiped disk (Render free plan) never
// loses a host's design: the next browser that opens HOME puts its copy back.
//
// Optional protection: set HOME_EDIT_KEY in the environment and saving then needs that key (the HOME page asks
// for it once per device). Without it, anyone who can open the site can change the cards - the same trust model
// as every other host control on this platform.
// ===================================================================
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const DATA_FILE = path.join(DATA_DIR, "home-cards.json");

/** Default order of the cards on HOME (must match public/index.html). */
export const GAME_IDS = [
  "flagle", "travle", "blindle", "findle", "crossdle", "twistle", "oracle",
  "colorblindle", "colordle", "structle", "textle", "rangedle", "codedle", "shapedle",
];
export const BORDER_STYLES = ["solid", "dashed", "dotted", "double", "none"];
export const FONTS = ["fredoka", "baloo", "quicksand"];
// Color keys all end in "Color" (except the card's own parts) so they never collide with the text keys title / desc / cta / icon.
const COLOR_KEYS = ["bg", "border", "edge", "blob", "titleColor", "textColor", "iconColor", "ctaColor", "tagColor"];
const TEXT_LIMITS = { title: 40, desc: 420, cta: 40 };
const HEX_RE = /^#[0-9a-f]{6}$/i;

const clampInt = (v, lo, hi) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : undefined;
};
const cleanText = (v, max) =>
  typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max) : undefined;

/** Keeps only valid values; unknown games / fields are dropped. Never throws. */
export function sanitizeCard(input) {
  const src = input && typeof input === "object" ? input : {};
  const out = {};
  for (const key of COLOR_KEYS) {
    if (typeof src[key] === "string" && HEX_RE.test(src[key])) out[key] = src[key].toLowerCase();
  }
  if (BORDER_STYLES.includes(src.borderStyle)) out.borderStyle = src.borderStyle;
  const bw = clampInt(src.borderWidth, 0, 8);
  if (bw !== undefined) out.borderWidth = bw;
  const radius = clampInt(src.radius, 0, 40);
  if (radius !== undefined) out.radius = radius;
  const depth = clampInt(src.depth, 0, 14);
  if (depth !== undefined) out.depth = depth;
  if (FONTS.includes(src.font)) out.font = src.font;
  for (const key of Object.keys(TEXT_LIMITS)) {
    const t = cleanText(src[key], TEXT_LIMITS[key]);
    if (t) out[key] = t;
  }
  if (typeof src.icon === "string") {
    const icon = Array.from(cleanText(src.icon, 40) || "").slice(0, 10).join("");
    if (icon) out.icon = icon;
  }
  if (src.hidden === true) out.hidden = true;
  return out;
}

/** Full config: { version, updatedAt, order:[all ids], cards:{ id: overrides } }. Never throws. */
export function sanitizeConfig(input, updatedAt = 0) {
  const src = input && typeof input === "object" ? input : {};
  const cards = {};
  const rawCards = src.cards && typeof src.cards === "object" ? src.cards : {};
  for (const id of GAME_IDS) {
    const c = sanitizeCard(rawCards[id]);
    if (Object.keys(c).length) cards[id] = c;
  }
  const seen = new Set();
  const order = [];
  if (Array.isArray(src.order)) {
    for (const id of src.order) {
      if (GAME_IDS.includes(id) && !seen.has(id)) {
        seen.add(id);
        order.push(id);
      }
    }
  }
  for (const id of GAME_IDS) if (!seen.has(id)) order.push(id);
  return { version: 1, updatedAt, order, cards };
}

let current = sanitizeConfig({}, 0);

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    current = sanitizeConfig(raw, Number(raw && raw.updatedAt) || 0);
  } catch (_) {
    current = sanitizeConfig({}, 0);
  }
}

function save() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DATA_FILE + "." + process.pid + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(current));
    fs.renameSync(tmp, DATA_FILE); // atomic: a crash can never leave a half-written file
  } catch (err) {
    console.error("[home] could not save home-cards.json:", err && err.message ? err.message : err);
  }
}

export function getHomeCards() {
  return current;
}

/** Replaces the saved design with `input` (validated) and stamps it with the server's clock. */
export function setHomeCards(input) {
  current = sanitizeConfig(input, Date.now());
  save();
  return current;
}

function keyOk(req) {
  const wanted = process.env.HOME_EDIT_KEY;
  if (!wanted) return true;
  const given = String(req.get("x-edit-key") || "");
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(wanted).digest();
  return crypto.timingSafeEqual(a, b);
}

/**
 * Adds GET/PUT /api/home-cards and live updates on the /home-hub namespace.
 * @param app     the Express app
 * @param io      the Socket.IO server
 * @param express the express module (for the JSON body parser)
 */
export function mountHomeCards(app, io, express) {
  load();
  const nsp = io ? io.of("/home-hub") : null;
  if (nsp) {
    nsp.on("connection", (socket) => socket.emit("home:cards", current));
  }

  app.get("/api/home-cards", (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({ ...current, editKeyRequired: Boolean(process.env.HOME_EDIT_KEY) });
  });

  app.put("/api/home-cards", express.json({ limit: "64kb" }), (req, res) => {
    if (!keyOk(req)) {
      res.status(401).json({ error: "edit-key-required" });
      return;
    }
    const saved = setHomeCards(req.body);
    if (nsp) nsp.emit("home:cards", saved);
    res.set("Cache-Control", "no-store");
    res.json(saved);
  });

  console.log("[home] card customization ready (GET/PUT /api/home-cards)" + (process.env.HOME_EDIT_KEY ? " - edit key required" : ""));
}
