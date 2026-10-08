// ===================================================================
// TIKTOK CONNECTION RESILIENCE (update 36) - one fix for every game.
//
// Your logs showed:  "[TikTok] Connect attempt N failed: Failed to retrieve Room ID from all sources."
// That means the library could not look up the LIVE room id (TikTok / EulerStream throttled or blocked the
// lookup, or the account was not LIVE yet). Games retried within seconds, which makes throttling worse.
//
// This file wraps TikTokLiveConnection.connect() / disconnect() ONCE for the whole platform:
//  1. Remembers each host's room id after a good connection and reuses it (no lookup at all on reconnect).
//  2. If the lookup fails with the "Room ID" error, tries its own page lookup, then retries patiently with growing waits.
//  3. Spaces lookups out across ALL games (one shared key must not be hammered by 14 games at once).
//  4. Auto-reconnects a dropped connection in the background (only for games that listen for "reconnected").
//  5. Shares the one API key between both env names (EULERSTREAM_API_KEY / TIKTOK_SIGN_API_KEY).
// GET /api/tiktok-health (and ?user=name) shows what the server sees. Nothing here can change TikTok's own blocking,
// but it removes every self-inflicted cause.
// ===================================================================
import { TikTokLiveConnection, WebcastEvent, ControlEvent, SignConfig } from "tiktok-live-connector";

const SCALE = Number(process.env.TIKTOK_DELAY_SCALE) || 1; // tests only
const LOOKUP_RETRY_MS = [3000, 8000, 15000];
const RECONNECT_MS = [3000, 6000, 12000, 20000, 30000, 45000, 60000, 60000, 90000, 120000];
const MIN_GAP_MS = 1500;
const CACHE_MS = 6 * 60 * 60 * 1000;

const roomCache = new Map();
const stats = { lookups: 0, cacheHits: 0, pageHits: 0, pageMisses: 0, retries: 0, reconnects: 0, lastError: null, lastErrorAt: 0, lastOkAt: 0 };
const states = new WeakMap();

const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms * SCALE)));
const jitter = (ms) => ms + Math.floor(Math.random() * ms * 0.25);
export const normalizeUser = (u) => String(u || "").trim().replace(/^https?:\/\/(www\.)?tiktok\.com\//i, "").replace(/^@+/, "").replace(/[/?#].*$/, "").toLowerCase();
const msgOf = (e) => String((e && (e.message || e.info || e)) || "");
const isRoomIdError = (e) => /room ?id/i.test(msgOf(e));
const isOfflineError = (e) => /not currently live|not live|offline|has ended|stream ended|live_not_found/i.test(msgOf(e));

function stateOf(conn) {
  let s = states.get(conn);
  if (!s) { s = { manual: false, ended: false, internal: false, reconnecting: false, supervised: false }; states.set(conn, s); }
  return s;
}
function ensureKey() {
  const key = process.env.EULERSTREAM_API_KEY || process.env.TIKTOK_SIGN_API_KEY;
  if (key && !SignConfig.apiKey) SignConfig.apiKey = key;
}
function noteError(e) { stats.lastError = msgOf(e).slice(0, 200); stats.lastErrorAt = Date.now(); }

let nextSlot = 0;
async function throttle() {
  const now = Date.now(), at = Math.max(now, nextSlot);
  nextSlot = at + MIN_GAP_MS * SCALE;
  if (at > now) await new Promise((r) => setTimeout(r, at - now));
}

// Our own look at TikTok's public pages. Tells us (a) the live room id if one is visible and (b) WHY nothing was found:
// account not live / account does not exist / TikTok refusing this server / this server cannot reach TikTok.
export async function probeLive(user) {
  const u = normalizeUser(user);
  const res = { roomId: null, status: null, blocked: false, userFound: false, notFound: false, networkError: null };
  if (!u) return res;
  const urls = [`https://www.tiktok.com/@${encodeURIComponent(u)}/live`, `https://www.tiktok.com/@${encodeURIComponent(u)}`];
  for (const url of urls) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 12000);
    try {
      const r = await fetch(url, {
        redirect: "follow", signal: ctl.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml", "Accept-Language": "en-US,en;q=0.9"
        }
      });
      res.status = r.status;
      if (r.status === 404) { res.notFound = true; continue; }
      if (r.status === 403 || r.status === 429) { res.blocked = true; continue; }
      if (!r.ok) continue;
      const html = await r.text();
      if (/captcha|verify to continue|are you a robot|access denied/i.test(html) && !/"uniqueId"/.test(html)) { res.blocked = true; continue; }
      if (/couldn'?t find this account|"statusCode":10221|"statusCode":10202/i.test(html)) res.notFound = true;
      if (new RegExp('"uniqueId":"' + u.replace(/[.]/g, "\\.") + '"', "i").test(html)) res.userFound = true;
      const m = html.match(/"roomId":"(\d{10,})"/) || html.match(/"room_id":"?(\d{10,})/) || html.match(/room_id=(\d{10,})/);
      if (m) { res.roomId = m[1]; return res; }
    } catch (e) {
      res.networkError = String((e && (e.cause && e.cause.code || e.code || e.name)) || "network error");
    } finally { clearTimeout(timer); }
  }
  return res;
}
export async function pageRoomId(user) { return (await probeLive(user)).roomId; }

const origConnect = TikTokLiveConnection.prototype.connect;
const origDisconnect = TikTokLiveConnection.prototype.disconnect;

async function resilientConnect(conn, roomIdArg) {
  const user = normalizeUser(conn.uniqueId);
  ensureKey();
  const record = (state) => {
    const id = (state && state.roomId) || conn.roomId;
    if (id && user) roomCache.set(user, { roomId: String(id), at: Date.now() });
    stats.lastOkAt = Date.now();
    return state;
  };
  if (roomIdArg) return record(await origConnect.call(conn, roomIdArg));

  let lastErr, lastProbe = null;
  const cached = roomCache.get(user);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    try { stats.cacheHits++; return record(await origConnect.call(conn, cached.roomId)); }
    catch (e) {
      if (/already/i.test(msgOf(e))) throw e;
      lastErr = e; roomCache.delete(user); noteError(e);
      console.warn(`[tiktok] saved room id for @${user} no longer works (${msgOf(e).slice(0, 80)}) - looking it up again`);
    }
  }
  for (let i = 0; i <= LOOKUP_RETRY_MS.length; i++) {
    stats.lookups++;
    await throttle();
    try { return record(await origConnect.call(conn)); }
    catch (e) {
      lastErr = e; noteError(e);
      if (!isRoomIdError(e)) throw e;
      lastProbe = await probeLive(user);
      const id = lastProbe.roomId;
      if (id) {
        try { const s = record(await origConnect.call(conn, id)); stats.pageHits++; console.log(`[tiktok] @${user}: connected using the page room-id lookup`); return s; }
        catch (e2) { lastErr = e2; noteError(e2); if (/already/i.test(msgOf(e2))) throw e2; }
      } else { stats.pageMisses++; }
      if (i < LOOKUP_RETRY_MS.length) {
        stats.retries++;
        console.warn(`[tiktok] @${user}: room id lookup failed (try ${i + 1}) - waiting before the next try`);
        await sleep(jitter(LOOKUP_RETRY_MS[i]));
      }
    }
  }
  if (lastErr && isRoomIdError(lastErr)) {
    try { lastErr.tiktokDiagnosis = { keySet: Boolean(process.env.EULERSTREAM_API_KEY || process.env.TIKTOK_SIGN_API_KEY), probe: lastProbe, tries: LOOKUP_RETRY_MS.length + 1 }; } catch (_) { /* frozen error */ }
  }
  throw lastErr;
}

async function reconnectLoop(conn) {
  const s = stateOf(conn);
  s.reconnecting = true;
  try {
    for (let i = 0; i < RECONNECT_MS.length; i++) {
      await sleep(jitter(RECONNECT_MS[i]));
      if (s.manual || s.ended) return;
      s.internal = true;
      try {
        await resilientConnect(conn);
        s.internal = false; stats.reconnects++;
        console.log(`[tiktok] @${conn.uniqueId}: reconnected automatically`);
        conn.emit("reconnected");
        return;
      } catch (e) {
        s.internal = false;
        console.warn(`[tiktok] @${conn.uniqueId}: auto-reconnect try ${i + 1} failed: ${msgOf(e).slice(0, 100)}`);
        if (isOfflineError(e)) return; // the host's LIVE really ended
      }
    }
  } finally { s.reconnecting = false; s.internal = false; }
}

function supervise(conn) {
  const s = stateOf(conn);
  if (s.supervised) return;
  s.supervised = true;
  conn.on((WebcastEvent && WebcastEvent.STREAM_END) || "streamEnd", () => { s.ended = true; });
  conn.on((ControlEvent && ControlEvent.DISCONNECTED) || "disconnected", () => {
    if (s.manual || s.ended || s.reconnecting) return;
    if (typeof conn.listenerCount === "function" && conn.listenerCount("reconnected") === 0) return; // game handles it itself
    reconnectLoop(conn).catch(() => {});
  });
}

let installed = false;
export function installTikTokResilience() {
  if (installed) return;
  installed = true;
  ensureKey();
  TikTokLiveConnection.prototype.connect = async function patchedConnect(roomId, ...rest) {
    const s = stateOf(this);
    s.manual = false; s.ended = false;
    const state = await resilientConnect(this, roomId);
    supervise(this);
    return state;
  };
  TikTokLiveConnection.prototype.disconnect = function patchedDisconnect(...args) {
    const s = stateOf(this);
    if (!s.internal) s.manual = true;
    return origDisconnect.apply(this, args);
  };
  console.log("[tiktok] connection resilience active (room-id memory, patient retries, auto-reconnect)");
}

export function tiktokStats() {
  return { ...stats, savedRooms: roomCache.size, keyConfigured: Boolean(process.env.EULERSTREAM_API_KEY || process.env.TIKTOK_SIGN_API_KEY) };
}

let lastCheck = 0;
export function mountTikTokHealth(app) {
  app.get("/api/tiktok-health", async (req, res) => {
    res.set("Cache-Control", "no-store");
    const out = { stats: tiktokStats(), hints: [] };
    if (!out.stats.keyConfigured) out.hints.push("No EULERSTREAM_API_KEY is set on the server. Add it in Render > Environment, then redeploy.");
    const user = normalizeUser(req.query.user);
    if (user) {
      if (!/^[a-z0-9._]{1,40}$/.test(user)) { out.hints.push("That username has characters TikTok does not allow."); }
      else if (Date.now() - lastCheck < 8000) { out.hints.push("Wait a few seconds between checks."); }
      else {
        lastCheck = Date.now();
        const probe = await probeLive(user);
        const id = probe.roomId;
        out.check = { user, pageRoomIdFound: Boolean(id), roomId: id || null, probe };
        if (probe.blocked) out.hints.push("TikTok answered this server with HTTP " + probe.status + " / a robot check: TikTok is refusing this server's address.");
        if (probe.notFound) out.hints.push("TikTok says the account @" + user + " does not exist. Check the spelling.");
        if (probe.networkError) out.hints.push("This server could not reach tiktok.com (" + probe.networkError + ").");
        if (probe.userFound && !id) out.hints.push("@" + user + " exists but is not showing as LIVE right now.");
        out.hints.push(id
          ? "TikTok shows @" + user + " as LIVE and this server can read it. Connecting should work."
          : "This server could not read a live room for @" + user + ". Either the account is not LIVE right now, or TikTok is refusing this server's address. Confirm the LIVE is running, wait one minute, try again.");
      }
    }
    res.json(out);
  });
}
