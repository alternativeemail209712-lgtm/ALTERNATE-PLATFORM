// ===================================================================
// RECORDS ARCHIVE  (update 40)
// A permanent memory of everything the audience did: every gift, every milestone (viewer + whole room), every
// share, follow and subscription, and every viewer's likes. Each record keeps WHEN it happened (date, time,
// seconds into the stream), WHICH game was open, WHICH host account was live, WHO did it (the viewer) and
// WHICH AUDIENCE it was about (one viewer / the whole room), and how many people were watching at that moment.
//
//   data/records.json   (or $RECORDS_DIR/records.json - point it at a Render Disk to survive redeploys)
//
// API (GET = open, changing things needs HOME_EDIT_KEY when that is set):
//   GET  /api/records?type&game&host&user&q&from&to&session&scope&test&sort&limit&offset
//   GET  /api/records/summary  (same filters)    GET /api/records/meta     GET /api/records/viewers?q&sort&limit
//   GET  /api/records/viewer/:name               GET /api/records/export?format=csv|json (same filters)
//   POST /api/records/import   POST /api/records/clear   POST /api/records/settings
// ===================================================================
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.RECORDS_DIR ? path.resolve(process.env.RECORDS_DIR) : path.resolve(__dirname, "../../data");
const FILE = path.join(DATA_DIR, "records.json");

const MAX_RECORDS = 25000;
const MAX_VIEWERS = 6000;
const SESSION_IDLE_MS = 4 * 60 * 60 * 1000; // a quiet gap this long starts a new stream session
const SAVE_DELAY_MS = 4000;

export const TYPE_LABELS = {
  gift: "Gift",
  gift_milestone: "Viewer gift milestone",
  like_milestone: "Viewer like milestone",
  share: "Share",
  share_milestone: "Viewer share milestone",
  likes: "Likes (per viewer)",
  follow: "Follow",
  subscribe: "Subscription",
  room_like_milestone: "Room like milestone",
  room_share_milestone: "Room share milestone",
  room_gift_milestone: "Room gift milestone",
};

// ---- on-screen alert rules (update 43). Records always keep everything; these only decide what pops up on stream. ----
export const ALERT_KINDS = {
  gift: "Gifts",
  share: "Shares",
  like_milestone: "Viewer like milestones",
  share_milestone: "Viewer share milestones",
  gift_milestone: "Viewer gift (coin) milestones",
  room_like_milestone: "Room like milestones",
  room_share_milestone: "Room share milestones",
  room_gift_milestone: "Room gift (coin) milestones",
  follow: "New followers",
  subscribe: "New subscribers",
};
const ALERT_DEFAULTS = {
  alertMode: "all", // "all" = every stage, "major" = only the original bigger stages
  kinds: { gift: true, share: true, like_milestone: true, share_milestone: true, gift_milestone: true, room_like_milestone: true, room_share_milestone: true, room_gift_milestone: true, follow: false, subscribe: false },
  minGiftCoins: 0, // gifts worth fewer coins than this are saved but not announced
  bigGiftCoins: 500, // a gift/combo at or above this gets the big confetti card
  viewerCooldownSec: 0, // the same viewer is announced at most once per this many seconds (big ones always pass)
  autoThrottle: { on: true, maxPerMinute: 12 }, // busy stream: small alerts pause automatically, big ones still show
  onlyWhenLive: false, // automatically hide alerts unless the platform is connected LIVE (test buttons still show)
  display: { durationSec: 4, position: "top", scale: 100, confetti: true, showWish: true, showAvatar: true, maxQueue: 25 },
};
const clampNum = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
function sanitizeAlerts(input, cur) {
  const i = input && typeof input === "object" ? input : {};
  const c = cur || ALERT_DEFAULTS;
  const out = JSON.parse(JSON.stringify(c));
  if (i.alertMode === "all" || i.alertMode === "major") out.alertMode = i.alertMode;
  if (i.kinds && typeof i.kinds === "object") for (const k of Object.keys(ALERT_KINDS)) if (typeof i.kinds[k] === "boolean") out.kinds[k] = i.kinds[k];
  if (i.minGiftCoins !== undefined) out.minGiftCoins = Math.round(clampNum(i.minGiftCoins, 0, 1000000, c.minGiftCoins));
  if (i.bigGiftCoins !== undefined) out.bigGiftCoins = Math.round(clampNum(i.bigGiftCoins, 1, 10000000, c.bigGiftCoins));
  if (i.viewerCooldownSec !== undefined) out.viewerCooldownSec = Math.round(clampNum(i.viewerCooldownSec, 0, 3600, c.viewerCooldownSec));
  if (i.autoThrottle && typeof i.autoThrottle === "object") {
    if (typeof i.autoThrottle.on === "boolean") out.autoThrottle.on = i.autoThrottle.on;
    if (i.autoThrottle.maxPerMinute !== undefined) out.autoThrottle.maxPerMinute = Math.round(clampNum(i.autoThrottle.maxPerMinute, 1, 120, c.autoThrottle.maxPerMinute));
  }
  if (typeof i.onlyWhenLive === "boolean") out.onlyWhenLive = i.onlyWhenLive;
  if (i.display && typeof i.display === "object") {
    const d = i.display, o = out.display;
    if (d.durationSec !== undefined) o.durationSec = clampNum(d.durationSec, 1.5, 20, c.display.durationSec);
    if (["top", "middle", "bottom"].includes(d.position)) o.position = d.position;
    if (d.scale !== undefined) o.scale = Math.round(clampNum(d.scale, 50, 160, c.display.scale));
    for (const b of ["confetti", "showWish", "showAvatar"]) if (typeof d[b] === "boolean") o[b] = d[b];
    if (d.maxQueue !== undefined) o.maxQueue = Math.round(clampNum(d.maxQueue, 1, 60, c.display.maxQueue));
  }
  return out;
}
let settingsListener = null;

const state = {
  records: [], // newest last
  viewers: {}, // username -> aggregate
  sessions: [], // { id, start, last, host, test, counts }
  settings: { alertMode: "all", alerts: null }, // alerts: the full on-screen alert rules (see ALERT_DEFAULTS)
  trimmed: 0,
};
let likeRows = new Map(); // "session|user" -> record (rows of type "likes" are updated in place)
let saveTimer = null;
let seq = 0;

const clip = (v, n) => String(v == null ? "" : v).replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, n);
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

// ---------------------------------------------------------------- storage --
function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, "utf8"));
    if (Array.isArray(raw.records)) state.records = raw.records;
    if (raw.viewers && typeof raw.viewers === "object") state.viewers = raw.viewers;
    if (Array.isArray(raw.sessions)) state.sessions = raw.sessions;
    if (raw.settings && typeof raw.settings === "object") state.settings = { ...state.settings, ...raw.settings };
    state.settings.alerts = sanitizeAlerts(state.settings.alerts || { alertMode: state.settings.alertMode }, ALERT_DEFAULTS);
    state.trimmed = num(raw.trimmed);
    for (const r of state.records) {
      if (r.type === "likes") likeRows.set(r.session + "|" + r.user, r);
      const n = Number(String(r.id || "").split("-").pop());
      if (Number.isFinite(n) && n > seq) seq = n;
    }
  } catch (e) {
    // first run or unreadable file: start empty
  }
}
function saveNow() {
  saveTimer = null;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify({ v: 1, savedAt: Date.now(), ...state }));
    fs.renameSync(tmp, FILE);
  } catch (e) {
    console.error("[records] could not save:", e.message);
  }
}
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(saveNow, SAVE_DELAY_MS);
  if (saveTimer.unref) saveTimer.unref();
}
process.on("exit", () => { if (saveTimer) saveNow(); });
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => { if (saveTimer) saveNow(); process.exit(0); });
}

// --------------------------------------------------------------- sessions --
function sessionFor(host, test, ts, key) {
  if (test) return { id: "test", start: ts, last: ts, host: "", test: true, counts: {} };
  let s = state.sessions.length ? state.sessions[state.sessions.length - 1] : null;
  // (update 43) a different TikTok LIVE room always starts a new stream session, so likes of two lives never merge
  if (!s || s.test || ts - s.last > SESSION_IDLE_MS || (host && s.host && host !== s.host) || (key && s.key && key !== s.key)) {
    s = { id: "s" + ts.toString(36), start: ts, last: ts, host: host || "", test: false, counts: {}, key: key ? String(key).slice(0, 40) : "" };
    state.sessions.push(s);
    if (state.sessions.length > 400) state.sessions.shift();
  }
  if (host && !s.host) s.host = host;
  if (key && !s.key) s.key = String(key).slice(0, 40);
  return s;
}

function touchViewer(user, nick, ts, game, test) {
  if (!user || test) return null;
  let v = state.viewers[user];
  if (!v) {
    v = { u: user, n: nick || user, first: ts, last: ts, gifts: 0, coins: 0, likes: 0, shares: 0, follows: 0, milestones: 0, games: {} };
    state.viewers[user] = v;
    const keys = Object.keys(state.viewers);
    if (keys.length > MAX_VIEWERS) {
      keys.sort((a, b) => state.viewers[a].last - state.viewers[b].last);
      for (const k of keys.slice(0, keys.length - MAX_VIEWERS)) delete state.viewers[k];
    }
  }
  if (nick) v.n = nick;
  v.last = ts;
  if (game) v.games[game] = (v.games[game] || 0) + 1;
  return v;
}

function push(rec) {
  state.records.push(rec);
  if (state.records.length > MAX_RECORDS) {
    const drop = state.records.splice(0, state.records.length - MAX_RECORDS);
    state.trimmed += drop.length;
    for (const d of drop) if (d.type === "likes") likeRows.delete(d.session + "|" + d.user);
  }
  scheduleSave();
}

function base(type, d) {
  const ts = Date.now();
  const test = d.game === "test";
  const host = clip(d.host, 40).toLowerCase();
  const s = sessionFor(host, test, ts, d.sessionKey);
  s.last = ts;
  s.counts[type] = (s.counts[type] || 0) + 1;
  const room = Boolean(d.room);
  return {
    id: "r" + ts.toString(36) + "-" + ++seq,
    ts,
    type,
    scope: room ? "room" : "viewer", // which audience: one viewer or the whole room
    game: clip(d.game, 30) || "",
    host,
    session: s.id,
    off: Math.max(0, Math.round((ts - s.start) / 1000)), // seconds since this stream session began
    viewers: d.viewers == null ? null : num(d.viewers), // how many were watching at that moment
    user: room ? "" : clip(d.username, 40).toLowerCase(),
    nick: room ? "" : clip(d.nick || d.nickname, 60),
    test,
    _s: s,
  };
}
function finish(rec) {
  delete rec._s;
  return rec;
}

// ----------------------------------------------------------------- adding --
let viewerSource = null;
function currentViewers() {
  try {
    const v = viewerSource ? viewerSource() : null;
    return Number.isFinite(Number(v)) && v !== null ? Number(v) : null;
  } catch (_) {
    return null;
  }
}

/** One alert from the engagement tracker (gift, share, any milestone). */
function addAlert(type, p) {
  if (!TYPE_LABELS[type]) return;
  const room = type.startsWith("room_");
  const rec = base(type, { ...p, room, viewers: currentViewers() });
  rec.text = clip(p.message, 200);
  rec.stat = clip(p.stat, 120);
  if (type === "gift") {
    rec.gift = clip(p.giftName, 60);
    rec.qty = num(p.repeatCount) || 1;
    rec.unit = num(p.coinValue);
    rec.coins = num(p.totalCoinValue);
    rec.big = Boolean(p.big);
  } else if (p.milestone != null) {
    rec.milestone = num(p.milestone);
    rec.metric = clip(p.metric, 12);
    rec.stage = num(p.stage);
    rec.stages = num(p.stages);
    rec.tier = clip(p.tierName, 20);
  }
  const v = touchViewer(rec.user, rec.nick, rec.ts, rec.game, rec.test);
  if (v) {
    if (type === "gift") { v.gifts += rec.qty; v.coins += rec.coins; }
    else if (type === "share") v.shares += 1;
    else if (type.endsWith("_milestone")) v.milestones += 1;
  }
  push(finish(rec));
}

/** A like batch: kept as ONE row per viewer per stream session that grows (first / last time, total). */
function addLike(p) {
  const test = p.game === "test";
  const ts = Date.now();
  const s = sessionFor(clip(p.host, 40).toLowerCase(), test, ts, p.sessionKey);
  const user = clip(p.username, 40).toLowerCase() || "viewer";
  const key = s.id + "|" + user;
  let rec = likeRows.get(key);
  if (!rec) {
    rec = finish(base("likes", { ...p, username: user, viewers: currentViewers() }));
    rec.count = 0;
    rec.firstTs = rec.ts;
    rec.text = "";
    likeRows.set(key, rec);
    push(rec);
  }
  rec.count += num(p.batch) || 1;
  rec.ts = ts; // time of the latest like
  rec.off = Math.max(0, Math.round((ts - s.start) / 1000));
  if (p.game) rec.game = clip(p.game, 30);
  rec.viewers = currentViewers();
  rec.text = `@${user} sent ${rec.count.toLocaleString("en-US")} likes`;
  s.last = ts;
  const v = touchViewer(user, clip(p.nick, 60), ts, p.game, test);
  if (v) v.likes += num(p.batch) || 1;
  scheduleSave();
}

function addSimple(type, p) {
  const rec = base(type, { ...p, viewers: currentViewers() });
  rec.text = type === "follow" ? `@${rec.user || "viewer"} followed` : `@${rec.user || "viewer"} subscribed`;
  const v = touchViewer(rec.user, rec.nick, rec.ts, rec.game, rec.test);
  if (v && type === "follow") v.follows += 1;
  push(finish(rec));
}

// --------------------------------------------------------------- querying --
function parseFilters(q) {
  const f = {};
  const list = (v) => String(v || "").split(",").map((x) => x.trim()).filter(Boolean);
  f.types = list(q.type);
  f.games = list(q.game);
  f.host = clip(q.host, 40).toLowerCase();
  f.user = clip(q.user, 40).toLowerCase().replace(/^@/, "");
  f.q = clip(q.q, 80).toLowerCase().replace(/^@/, "");
  f.from = num(q.from) || 0;
  f.to = num(q.to) || 0;
  f.session = clip(q.session, 40);
  f.scope = q.scope === "room" || q.scope === "viewer" ? q.scope : "";
  f.test = q.test === "1" || q.test === "only" ? q.test : "0"; // default: hide test-mode rows
  f.sort = q.sort === "old" ? "old" : q.sort === "big" ? "big" : "new";
  return f;
}
function matches(r, f) {
  if (f.test === "0" && r.test) return false;
  if (f.test === "only" && !r.test) return false;
  if (f.types.length && !f.types.includes(r.type)) return false;
  if (f.games.length && !f.games.includes(r.game)) return false;
  if (f.host && r.host !== f.host) return false;
  if (f.user && r.user !== f.user) return false;
  if (f.session && r.session !== f.session) return false;
  if (f.scope && r.scope !== f.scope) return false;
  if (f.from && r.ts < f.from) return false;
  if (f.to && r.ts > f.to) return false;
  if (f.q) {
    const hay = ((r.user || "") + " " + (r.nick || "") + " " + (r.gift || "") + " " + (r.text || "") + " " + (r.game || "")).toLowerCase();
    if (!hay.includes(f.q)) return false;
  }
  return true;
}
const weight = (r) => (r.type === "gift" ? r.coins : r.type === "likes" ? r.count : r.milestone || 0);
function filtered(q) {
  const f = parseFilters(q);
  const rows = state.records.filter((r) => matches(r, f));
  if (f.sort === "new") rows.sort((a, b) => b.ts - a.ts);
  else if (f.sort === "old") rows.sort((a, b) => a.ts - b.ts);
  else rows.sort((a, b) => weight(b) - weight(a) || b.ts - a.ts);
  return rows;
}

function summary(q) {
  const f = parseFilters(q);
  const rows = state.records.filter((r) => matches(r, f));
  const byType = {}, byGame = {}, byDay = {};
  const byHour = new Array(24).fill(0);
  const people = new Map();
  let coins = 0, gifts = 0, likes = 0, shares = 0, milestones = 0, follows = 0, firstTs = 0, lastTs = 0;
  const tz = num(q.tz); // browser's getTimezoneOffset() so hours/days are the host's local time
  for (const r of rows) {
    byType[r.type] = (byType[r.type] || 0) + 1;
    if (r.game) byGame[r.game] = (byGame[r.game] || 0) + 1;
    const local = new Date(r.ts - tz * 60000);
    byHour[local.getUTCHours()] += 1;
    const day = local.toISOString().slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
    if (!firstTs || r.ts < firstTs) firstTs = r.ts;
    if (r.ts > lastTs) lastTs = r.ts;
    if (r.type === "gift") { gifts += r.qty || 1; coins += r.coins || 0; }
    else if (r.type === "likes") likes += r.count || 0;
    else if (r.type === "share") shares += 1;
    else if (r.type === "follow") follows += 1;
    else if (r.type.endsWith("_milestone")) milestones += 1;
    if (r.user) {
      let p = people.get(r.user);
      if (!p) { p = { u: r.user, n: r.nick || r.user, coins: 0, gifts: 0, likes: 0, shares: 0, milestones: 0 }; people.set(r.user, p); }
      if (r.nick) p.n = r.nick;
      if (r.type === "gift") { p.coins += r.coins || 0; p.gifts += r.qty || 1; }
      else if (r.type === "likes") p.likes += r.count || 0;
      else if (r.type === "share") p.shares += 1;
      else if (r.type.endsWith("_milestone")) p.milestones += 1;
    }
  }
  const all = [...people.values()];
  const top = (key) => all.filter((p) => p[key] > 0).sort((a, b) => b[key] - a[key]).slice(0, 10);
  return {
    total: rows.length, gifts, coins, likes, shares, follows, milestones, firstTs, lastTs,
    audience: people.size, byType, byGame, byHour, byDay,
    top: { coins: top("coins"), likes: top("likes"), shares: top("shares"), milestones: top("milestones") },
  };
}

function meta() {
  const hosts = new Set(), games = new Set();
  for (const r of state.records) { if (r.host) hosts.add(r.host); if (r.game) games.add(r.game); }
  return {
    total: state.records.length,
    trimmed: state.trimmed,
    max: MAX_RECORDS,
    viewersKnown: Object.keys(state.viewers).length,
    hosts: [...hosts].sort(),
    games: [...games].sort(),
    types: TYPE_LABELS,
    sessions: state.sessions.slice().reverse().slice(0, 120),
    settings: state.settings,
    editKeyRequired: Boolean(process.env.HOME_EDIT_KEY),
    file: FILE,
    persistent: Boolean(process.env.RECORDS_DIR),
  };
}

function keyOk(req) {
  const wanted = process.env.HOME_EDIT_KEY;
  if (!wanted) return true;
  const given = String(req.get("x-edit-key") || "");
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(wanted).digest();
  return crypto.timingSafeEqual(a, b);
}

const csvCell = (v) => {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // stops spreadsheet formula injection from viewer names
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

// -------------------------------------------------------------------- API --
export function mountRecords(app, express) {
  load();
  const noStore = (res) => res.set("Cache-Control", "no-store");

  app.get("/api/records", (req, res) => {
    noStore(res);
    const rows = filtered(req.query);
    const limit = Math.min(500, Math.max(1, num(req.query.limit) || 100));
    const offset = Math.max(0, num(req.query.offset));
    res.json({ total: rows.length, offset, rows: rows.slice(offset, offset + limit) });
  });
  app.get("/api/records/summary", (req, res) => { noStore(res); res.json(summary(req.query)); });
  app.get("/api/records/meta", (req, res) => { noStore(res); res.json(meta()); });
  app.get("/api/records/viewers", (req, res) => {
    noStore(res);
    const q = clip(req.query.q, 40).toLowerCase().replace(/^@/, "");
    const sort = ["coins", "likes", "shares", "gifts", "milestones", "last", "first"].includes(req.query.sort) ? req.query.sort : "coins";
    let list = Object.values(state.viewers);
    if (q) list = list.filter((v) => v.u.includes(q) || String(v.n).toLowerCase().includes(q));
    list.sort((a, b) => b[sort] - a[sort]);
    const limit = Math.min(500, Math.max(1, num(req.query.limit) || 100));
    res.json({ total: list.length, rows: list.slice(0, limit) });
  });
  app.get("/api/records/viewer/:name", (req, res) => {
    noStore(res);
    const u = clip(req.params.name, 40).toLowerCase().replace(/^@/, "");
    const rows = state.records.filter((r) => r.user === u && !r.test).sort((a, b) => b.ts - a.ts);
    res.json({ viewer: state.viewers[u] || null, total: rows.length, rows: rows.slice(0, 500) });
  });
  app.get("/api/records/export", (req, res) => {
    const rows = filtered({ ...req.query, sort: "old" });
    const stamp = new Date().toISOString().slice(0, 10);
    if (req.query.format === "json") {
      res.set("Content-Disposition", `attachment; filename="records-${stamp}.json"`);
      res.json({ v: 1, exportedAt: Date.now(), records: rows, viewers: state.viewers, sessions: state.sessions });
      return;
    }
    const cols = ["id", "date", "time", "ts", "type", "scope", "game", "host", "session", "secondsIntoStream", "viewersWatching", "user", "nickname", "gift", "quantity", "coins", "milestone", "stage", "stages", "tier", "likeCount", "text"];
    const lines = [cols.join(",")];
    for (const r of rows) {
      const d = new Date(r.ts);
      lines.push([
        r.id, d.toISOString().slice(0, 10), d.toISOString().slice(11, 19) + "Z", r.ts, r.type, r.scope, r.game, r.host, r.session, r.off, r.viewers,
        r.user, r.nick, r.gift, r.qty, r.coins, r.milestone, r.stage, r.stages, r.tier, r.count, r.text,
      ].map(csvCell).join(","));
    }
    res.set("Content-Type", "text/csv; charset=utf-8");
    res.set("Content-Disposition", `attachment; filename="records-${stamp}.csv"`);
    res.send("﻿" + lines.join("\r\n"));
  });

  const guard = (req, res) => {
    if (keyOk(req)) return true;
    res.status(401).json({ error: "edit-key-required" });
    return false;
  };
  app.post("/api/records/import", express.json({ limit: "60mb" }), (req, res) => {
    if (!guard(req, res)) return;
    const b = req.body || {};
    if (!Array.isArray(b.records)) return res.status(400).json({ error: "not-a-records-file" });
    const have = new Set(state.records.map((r) => r.id));
    let added = 0;
    for (const r of b.records) {
      if (!r || typeof r !== "object" || !TYPE_LABELS[r.type] || !r.id || have.has(r.id) || !Number.isFinite(Number(r.ts))) continue;
      have.add(r.id);
      state.records.push(r);
      if (r.type === "likes") likeRows.set(r.session + "|" + r.user, r);
      added++;
    }
    state.records.sort((a, c) => a.ts - c.ts);
    if (state.records.length > MAX_RECORDS) state.records.splice(0, state.records.length - MAX_RECORDS);
    if (b.viewers && typeof b.viewers === "object") {
      for (const [u, v] of Object.entries(b.viewers)) {
        const cur = state.viewers[u];
        if (!cur || num(v.last) > cur.last) state.viewers[u] = { games: {}, ...v };
      }
    }
    if (Array.isArray(b.sessions)) {
      const ids = new Set(state.sessions.map((s) => s.id));
      for (const s of b.sessions) if (s && s.id && !ids.has(s.id)) state.sessions.push(s);
      state.sessions.sort((a, c) => a.start - c.start);
    }
    saveNow();
    res.json({ added, total: state.records.length });
  });
  app.post("/api/records/clear", express.json({ limit: "4kb" }), (req, res) => {
    if (!guard(req, res)) return;
    const scope = String((req.body && req.body.scope) || "");
    if (scope === "all") {
      state.records = []; state.viewers = {}; state.sessions = []; state.trimmed = 0; likeRows = new Map();
    } else if (scope === "test") {
      state.records = state.records.filter((r) => !r.test);
      likeRows = new Map(state.records.filter((r) => r.type === "likes").map((r) => [r.session + "|" + r.user, r]));
    } else {
      return res.status(400).json({ error: "bad-scope" });
    }
    saveNow();
    res.json({ ok: true, total: state.records.length });
  });
  app.post("/api/records/settings", express.json({ limit: "4kb" }), (req, res) => {
    if (!guard(req, res)) return;
    const b = req.body || {};
    const patch = b.alerts && typeof b.alerts === "object" ? { ...b.alerts } : {};
    if (b.alertMode === "all" || b.alertMode === "major") patch.alertMode = b.alertMode;
    if (b.reset === "alerts") state.settings.alerts = sanitizeAlerts(null, ALERT_DEFAULTS);
    else state.settings.alerts = sanitizeAlerts(patch, state.settings.alerts);
    state.settings.alertMode = state.settings.alerts.alertMode;
    saveNow();
    try { if (settingsListener) settingsListener(state.settings.alerts); } catch (_) { /* never break the API */ }
    res.json(state.settings);
  });
  app.get("/api/records/settings", (req, res) => { noStore(res); res.json({ ...state.settings, kinds: ALERT_KINDS, defaults: ALERT_DEFAULTS }); });

  console.log("[records] archive ready (" + state.records.length + " saved records) at /records  ->  " + FILE);
}

export const Records = {
  addAlert,
  addLike,
  addSimple,
  get alertMode() { return state.settings.alerts ? state.settings.alerts.alertMode : state.settings.alertMode; },
  get alerts() { return state.settings.alerts || (state.settings.alerts = sanitizeAlerts(null, ALERT_DEFAULTS)); },
  onSettings(fn) { settingsListener = typeof fn === "function" ? fn : null; },
  keyOk,
  setViewerCountSource(fn) { viewerSource = fn; },
};
