// ===================================================================
// VIEWER ROSTER STORE  (update 29)
// Remembers every TikTok viewer who joined / chatted / liked / gifted during a LIVE session, together with
// a SAVED COPY of their profile picture (so it still works after they leave the live, after TikTok's picture
// link expires, and after a server restart). The host ticks which viewers' pictures may be used as symbols.
//
// Update 31: every NEW viewer is ticked automatically (their picture becomes a symbol candidate as soon as it is saved).
// It stays that way until the HOST unticks that person (the choice is remembered) or removes them with the x button
// (then they are kept out for good, even if they keep chatting, until the host clicks "Allow removed people again").
//
//   data/viewer-roster.json        the list (names, last seen, ticked or not, picture fingerprint)
//   data/viewer-avatars/*.img      the saved pictures
//
// Pictures are only fetched from TikTok's own picture hosts (see host-avatar.js).
// ===================================================================
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { downloadViewerPicture, normalizeHostName } from "./host-avatar.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const PIC_DIR = path.join(DATA_DIR, "viewer-avatars");
const LIST_FILE = path.join(DATA_DIR, "viewer-roster.json");
const BLOCK_FILE = path.join(DATA_DIR, "viewer-removed.json");   // people the host removed one by one

const NAME_RE = /^[a-z0-9._]{1,40}$/;
const MAX_VIEWERS = 3000;
const REFRESH_MS = 3 * 24 * 60 * 60 * 1000; // re-save a picture when it is older than 3 days and the viewer shows up again
const RETRY_GAP_MS = 45 * 1000;
const MAX_TRIES = 8;
const CONCURRENCY = 4;

// u -> { u, n, first, last, sel, hash, type, fetchedAt, rawUrl, tries, lastTry, queued }
const viewers = new Map();
const removed = new Set();   // usernames the host removed personally: never added back automatically
const listeners = new Set();
const queue = [];
let running = 0;
let saveTimer = null;
let notifyTimer = null;

const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };
const fileName = (u, type) => crypto.createHash("sha1").update(u).digest("hex").slice(0, 20) + "." + (EXT[type] || "img");
const picPath = (v) => path.join(PIC_DIR, fileName(v.u, v.type));

function validName(u) {
  return NAME_RE.test(u) && /[a-z0-9]/.test(u);
}

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(LIST_FILE, "utf8"));
    for (const r of Array.isArray(raw) ? raw : []) {
      const u = normalizeHostName(r && r.u);
      if (!validName(u)) continue;
      const v = {
        u, n: String((r && r.n) || u).slice(0, 60), first: Number(r.first) || Date.now(), last: Number(r.last) || Date.now(),
        sel: Boolean(r.sel), hash: null, type: null, fetchedAt: 0, rawUrl: null, urls: [], why: "", fresh: false, tries: 0, lastTry: 0, queued: false
      };
      if (r.hash && EXT[r.type]) {
        v.hash = String(r.hash).slice(0, 16);
        v.type = r.type;
        v.fetchedAt = Number(r.fetchedAt) || 0;
        if (!fs.existsSync(picPath(v))) { v.hash = null; v.type = null; v.fetchedAt = 0; } // picture file lost: fetch again next time
      }
      viewers.set(u, v);
    }
  } catch (e) {
    // first run / unreadable: empty roster
  }
}
load();
function loadRemoved() {
  try {
    const raw = JSON.parse(fs.readFileSync(BLOCK_FILE, "utf8"));
    for (const name of Array.isArray(raw) ? raw : []) {
      const u = normalizeHostName(name);
      if (validName(u)) removed.add(u);
    }
  } catch (e) {
    // none yet
  }
}
loadRemoved();

function saveRemoved() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(BLOCK_FILE, JSON.stringify([...removed]));
  } catch (e) {
    // read-only disk: still respected for this run
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      const rows = [...viewers.values()].map((v) => ({ u: v.u, n: v.n, first: v.first, last: v.last, sel: v.sel, hash: v.hash, type: v.type, fetchedAt: v.fetchedAt }));
      fs.writeFileSync(LIST_FILE, JSON.stringify(rows));
    } catch (e) {
      // read-only disk: the roster still works for this run
    }
  }, 600);
  if (saveTimer.unref) saveTimer.unref();
}

function changed() {
  scheduleSave();
  clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => {
    for (const fn of listeners) { try { fn(); } catch (e) { /* ignore */ } }
  }, 500);
  if (notifyTimer.unref) notifyTimer.unref();
}

/** Be told (debounced) whenever the roster changes. */
export function onRosterChange(fn) {
  listeners.add(fn);
}

function needsPicture(v) {
  // update 37: never gives up for good. The wait between tries grows (45s, 90s ... up to 15 min), and a
  // fresh picture link from a new event from that person is tried straight away.
  if (v.queued) return false;
  const now = Date.now();
  if (v.hash && now - v.fetchedAt <= REFRESH_MS) return false;
  if (!v.hash && v.fresh && now - v.lastTry >= 5000) return true;
  const gap = Math.min(RETRY_GAP_MS * Math.pow(2, Math.min(v.tries, 5)), 15 * 60 * 1000);
  return now - v.lastTry >= gap;
}

function enqueue(v) {
  if (!needsPicture(v)) return;
  v.queued = true;
  queue.push(v.u);
  pump();
}

function pump() {
  while (running < CONCURRENCY && queue.length) {
    const u = queue.shift();
    const v = viewers.get(u);
    if (!v) continue;
    running++;
    fetchPicture(v).finally(() => { running--; pump(); });
  }
}

async function fetchPicture(v) {
  try {
    v.lastTry = Date.now();
    v.fresh = false;
    const report = {};
    const pic = await downloadViewerPicture(v.u, v.urls && v.urls.length ? v.urls : (v.rawUrl ? [v.rawUrl] : []), report);
    if (!pic) { v.tries++; v.why = report.why || "the picture could not be downloaded"; changed(); return; }
    const oldPath = v.hash ? picPath(v) : null;
    const next = { ...v, type: pic.type };
    await fs.promises.mkdir(PIC_DIR, { recursive: true });
    await fs.promises.writeFile(picPath(next), pic.buf);
    if (oldPath && oldPath !== picPath(next)) fs.promises.unlink(oldPath).catch(() => {});
    v.type = pic.type;
    v.hash = crypto.createHash("sha1").update(pic.buf).digest("hex").slice(0, 10);
    v.fetchedAt = Date.now();
    v.tries = 0;
    v.why = "";
    changed();
  } catch (e) {
    v.tries++;
    v.why = "the picture could not be saved on the server";
  } finally {
    v.queued = false;
  }
}

function evictIfNeeded() {
  if (viewers.size <= MAX_VIEWERS) return;
  // oldest first, un-ticked people before ticked ones (everyone new is ticked now, so the list must still be able to trim)
  const victims = [...viewers.values()].sort((a, b) => (Number(a.sel) - Number(b.sel)) || (a.last - b.last));
  while (viewers.size > MAX_VIEWERS && victims.length) removeViewer(victims.shift().u, true);
}

/** A viewer was seen in the live (joined, chatted, liked, gifted...). Safe to call as often as you like. */
export function registerViewer(username, nickname, rawAvatarUrl) {
  const u = normalizeHostName(username);
  if (!validName(u)) return;
  if (removed.has(u)) return;   // the host removed this person on purpose
  let v = viewers.get(u);
  const now = Date.now();
  let isNew = false;
  if (!v) {
    // new people are ticked automatically (the host can untick or remove anyone)
    v = { u, n: u, first: now, last: now, sel: true, hash: null, type: null, fetchedAt: 0, rawUrl: null, urls: [], why: "", fresh: false, tries: 0, lastTry: 0, queued: false };
    viewers.set(u, v);
    isNew = true;
  }
  const nick = String(nickname || "").trim().slice(0, 60);
  if (nick && nick !== v.n) { v.n = nick; isNew = true; }
  // update 37: keep EVERY picture link TikTok sent (all sizes / formats), newest first - not just the first one
  const given = (Array.isArray(rawAvatarUrl) ? rawAvatarUrl : [rawAvatarUrl]).filter((x) => typeof x === "string" && /^https?:\/\//i.test(x));
  if (given.length) {
    const merged = [...new Set([...given, ...(v.urls || [])])].slice(0, 8);
    if (!v.urls || merged.join("|") !== v.urls.join("|")) { v.urls = merged; if (!v.hash) v.fresh = true; }
  }
  // "last seen" is only written to disk with the next real change (avoids a disk write per chat line)
  v.last = now;
  enqueue(v);
  if (isNew) { evictIfNeeded(); changed(); }
}

function removeViewer(u, silent) {
  const v = viewers.get(u);
  if (!v) return;
  if (v.hash) fs.promises.unlink(picPath(v)).catch(() => {});
  viewers.delete(u);
  if (!silent) changed();
}

/** The host removed one person: forget them AND keep them out, even if they chat again. */
export function forgetViewer(username) {
  const u = normalizeHostName(username);
  if (validName(u)) { removed.add(u); saveRemoved(); }
  removeViewer(u, false);
  changed();
}

/** "Forget everyone": a fresh start - the list, the saved pictures and the removed-people list are all cleared. */
export function forgetAllViewers() {
  for (const u of [...viewers.keys()]) removeViewer(u, true);
  removed.clear();
  saveRemoved();
  changed();
}

/** Let the people the host removed one by one be added again (when they next join / chat). */
export function allowRemovedViewers() {
  if (removed.size === 0) return;
  removed.clear();
  saveRemoved();
  changed();
}

/** (update 37) Forget the waiting times and try every viewer who has no saved picture again, right now. */
export function retryMissingPictures() {
  let n = 0;
  for (const v of viewers.values()) {
    if (v.hash) continue;
    v.tries = 0; v.lastTry = 0; v.fresh = true; v.queued = false;
    enqueue(v); n++;
  }
  return n;
}

// a slow background sweep: anyone still without a picture keeps being retried, even if they never write again
const sweepTimer = setInterval(() => { for (const v of viewers.values()) enqueue(v); }, 30000);
if (sweepTimer.unref) sweepTimer.unref();

export function setViewersSelected(usernames, on) {
  let any = false;
  for (const name of Array.isArray(usernames) ? usernames.slice(0, 5000) : []) {
    const v = viewers.get(normalizeHostName(name));
    if (v && v.sel !== Boolean(on)) { v.sel = Boolean(on); any = true; }
  }
  if (any) changed();
}

/** Tick (or untick) everyone, or only the viewers whose picture is saved already. */
export function setAllViewersSelected(on, onlyWithPicture) {
  let any = false;
  for (const v of viewers.values()) {
    if (onlyWithPicture && !v.hash) continue;
    if (v.sel !== Boolean(on)) { v.sel = Boolean(on); any = true; }
  }
  if (any) changed();
}

export function listViewers() {
  return [...viewers.values()]
    .sort((a, b) => b.last - a.last)
    .map((v) => ({ u: v.u, n: v.n, first: v.first, last: v.last, sel: v.sel, ready: Boolean(v.hash), v: v.hash || "", why: v.hash ? "" : (v.why || "") }));
}

export function viewerCounts() {
  let selected = 0, ready = 0, readySelected = 0;
  for (const v of viewers.values()) {
    if (v.sel) selected++;
    if (v.hash) ready++;
    if (v.sel && v.hash) readySelected++;
  }
  return { total: viewers.size, selected, ready, readySelected, removed: removed.size };
}

/** Ticked viewers whose picture is saved - the ones that may appear as symbols. */
export function usableViewers() {
  return [...viewers.values()].filter((v) => v.sel && v.hash).map((v) => ({ u: v.u, n: v.n, v: v.hash }));
}

export function viewerInfo(username) {
  const v = viewers.get(normalizeHostName(username));
  return v && v.hash ? { u: v.u, n: v.n, v: v.hash } : null;
}

/** The saved picture of a viewer: { buf, type, hash } or null. */
export async function readViewerPicture(username) {
  const v = viewers.get(normalizeHostName(username));
  if (!v || !v.hash) return null;
  try {
    const buf = await fs.promises.readFile(picPath(v));
    return { buf, type: v.type, hash: v.hash };
  } catch (e) {
    return null;
  }
}
