// ===================================================================
// Host profile picture helper (shared by every game that opens a round with a random
// "starter word": BLINDLE, ORACLE, COLORBLINDLE, COLORDLE, STRUCTLE, TEXTLE, RANGEDLE, CODEDLE, SHAPEDLE,
// TWISTLE, CROSSDLE).
//
// The starter word is played by the game itself, not by a viewer, so its circle shows the profile
// picture of the HOST of the current TikTok LIVE session - the account the game is connected to.
//
// UPDATE 24 - why it used to work for some hosts and fail for others, and what changed
//   Before, the game just handed the browser whatever picture URL TikTok first returned, and the
//   viewer's browser had to download it straight from TikTok's CDN. That broke for some hosts because:
//     * the first URL in TikTok's list is often a .heic file, which most browsers cannot draw;
//     * the CDN links are signed and expire, so a link that was fine at connect time can be dead later;
//     * the CDN can refuse hot-linked requests from some browsers / regions / OBS;
//     * the room info TikTok returns sometimes has no owner picture at all, and the lookup ran once.
//   Now the SERVER downloads the picture itself, right away (while the link is fresh), checks it is a
//   real browser-friendly image (jpeg / png / webp / gif / avif - never heic), keeps it in memory and
//   serves it from this site at /host-avatar/<username>. The browser only ever loads that same-origin
//   copy, so it can't be blocked, expire or be the wrong format. To find the picture it tries, in order,
//   and keeps retrying for a few minutes until one works:
//     1. the room info from the connect call (owner avatar, every size, every URL, heic -> jpeg/webp fixes)
//     2. a fresh room-info request (again, in case the first had no owner)
//     3. the host's public TikTok profile page (the same picture shown on their profile)
//     4. the host's own chat message (their avatar is attached to each one) - see adoptHostAvatar()
//   If every source fails the game simply keeps its old look (colored initial circle); nothing breaks.
// ===================================================================

import crypto from "crypto";

// ---------------------------------------------------------------- picture URL extraction

// Field names differ between library versions / payload styles (snake_case straight from TikTok vs
// camelCase from the protobuf decoder), so try both. Medium first: sharper than the 100px thumb but far
// lighter than the full-size one.
const OWNER_AVATAR_KEYS = [
  "avatar_medium", "avatarMedium",
  "avatar_thumb", "avatarThumb",
  "avatar_larger", "avatarLarger",
  "avatar_large", "avatarLarge",
];
const URL_LIST_KEYS = ["url_list", "urlList", "urls", "url"];

function isHttpUrl(u) {
  return typeof u === "string" && /^https?:\/\//i.test(u);
}

/** All usable URLs found in one avatar-ish value (string, array, or {url_list:[...]}). */
function urlsFromAvatarObject(obj, out = [], depth = 0) {
  if (!obj || depth > 3) return out;
  if (typeof obj === "string") {
    if (isHttpUrl(obj)) out.push(obj);
    return out;
  }
  if (Array.isArray(obj)) {
    for (const item of obj) urlsFromAvatarObject(item, out, depth + 1);
    return out;
  }
  if (typeof obj === "object") {
    for (const k of URL_LIST_KEYS) {
      if (obj[k] !== undefined) urlsFromAvatarObject(obj[k], out, depth + 1);
    }
  }
  return out;
}

/** Every picture URL (best guess first) in a TikTok room-info object. */
export function extractOwnerAvatarCandidates(roomInfo) {
  const found = [];
  if (!roomInfo || typeof roomInfo !== "object") return found;
  // Room info is sometimes wrapped ({ data: {...} } / { roomInfo: {...} }) depending on the version.
  const infos = [roomInfo, roomInfo.data, roomInfo.roomInfo, roomInfo.data && roomInfo.data.data].filter(Boolean);
  for (const info of infos) {
    const owner = info.owner || info.anchor || info.host || info.owner_user || info.ownerUser || null;
    if (!owner || typeof owner !== "object") continue;
    for (const key of OWNER_AVATAR_KEYS) urlsFromAvatarObject(owner[key], found);
    // Any other avatar-looking property on the owner.
    for (const [key, value] of Object.entries(owner)) {
      if (/avatar|profile.?pic|portrait/i.test(key) && !OWNER_AVATAR_KEYS.includes(key)) {
        urlsFromAvatarObject(value, found);
      }
    }
  }
  return [...new Set(found)];
}

/** First picture URL in a room-info object (kept for older callers). */
export function extractOwnerAvatar(roomInfo) {
  const all = extractOwnerAvatarCandidates(roomInfo);
  return all.find((u) => !/\.heic(\?|$)/i.test(u)) || all[0] || null;
}

/** The username the room info says owns the room (used only when the caller doesn't pass one). */
function ownerUsernameFromRoomInfo(roomInfo) {
  if (!roomInfo || typeof roomInfo !== "object") return "";
  const infos = [roomInfo, roomInfo.data, roomInfo.roomInfo].filter(Boolean);
  for (const info of infos) {
    const o = info.owner || info.anchor || info.host;
    if (!o) continue;
    const name = o.display_id || o.displayId || o.unique_id || o.uniqueId || o.username || "";
    if (name) return String(name);
  }
  return "";
}

/** True when a chat message was written by the host (the connected account). */
export function isHostUser(chatUsername, hostUsername) {
  const a = normalizeHostName(chatUsername);
  const b = normalizeHostName(hostUsername);
  return Boolean(a) && a === b;
}

export function normalizeHostName(name) {
  return String(name || "").trim().replace(/^@/, "").toLowerCase();
}

// ---------------------------------------------------------------- safe download + cache

// Only TikTok's own picture hosts may ever be fetched (so this can never be used to reach other sites).
const ALLOWED_HOST_RE =
  /(^|\.)(tiktokcdn(-us|-eu)?\.com|tiktokv\.(com|us|eu)|tiktok\.com|byteimg\.com|ibyteimg\.com|ibytedtos\.com|byteoversea\.com|muscdn\.com|tiktokcdn\.net)$/i;
const NAME_RE = /^[a-z0-9._]{1,40}$/;
const MAX_BYTES = 3 * 1024 * 1024;
const MIN_BYTES = 300;
const FETCH_TIMEOUT_MS = 9000;
const CACHE_LIMIT = 80;
const FRESH_MS = 10 * 60 * 1000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

// username -> { buf, type, hash, at, source }
const cache = new Map();
// username -> Promise  (one lookup per host at a time, however many games ask)
const inflight = new Map();

function isAllowedUrl(u) {
  try {
    const url = new URL(u);
    return url.protocol === "https:" && ALLOWED_HOST_RE.test(url.hostname);
  } catch (_) {
    return false;
  }
}

/** Looks at the first bytes to learn what the file really is. heic/heif -> null (browsers can't draw it). */
function sniffImageType(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.toString("ascii", 0, 4) === "GIF8") return "image/gif";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12);
    if (brand === "avif" || brand === "avis") return "image/avif";
    return null; // heic, heix, mif1, ... : not displayable everywhere
  }
  return null;
}

async function fetchFollowingSafeRedirects(startUrl, extraHeaders) {
  let url = startUrl;
  for (let hop = 0; hop < 4; hop++) {
    if (!isAllowedUrl(url)) throw new Error("blocked host");
    const res = await fetch(url, {
      redirect: "manual",
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", ...extraHeaders },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location"), url).toString();
      continue;
    }
    return res;
  }
  throw new Error("too many redirects");
}

async function downloadImage(url) {
  const res = await fetchFollowingSafeRedirects(url, {
    Accept: "image/avif,image/webp,image/jpeg,image/png,image/*;q=0.8,*/*;q=0.5",
    Referer: "https://www.tiktok.com/",
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const declared = Number(res.headers.get("content-length") || 0);
  if (declared > MAX_BYTES) throw new Error("too large");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < MIN_BYTES || buf.length > MAX_BYTES) throw new Error("bad size");
  const type = sniffImageType(buf);
  if (!type) throw new Error("not a browser-friendly image");
  return { buf, type };
}

/** heic/avif links also exist as jpeg/webp on TikTok's image CDN - try those first. */
function urlVariants(url) {
  const out = [];
  if (/\.(heic|heif|avif)(\?|$)/i.test(url)) {
    out.push(url.replace(/\.(heic|heif|avif)(\?|$)/i, ".jpeg$2"));
    out.push(url.replace(/\.(heic|heif|avif)(\?|$)/i, ".webp$2"));
  }
  out.push(url);
  return out;
}

function proxyPath(name, hash) {
  return "/host-avatar/" + encodeURIComponent(name) + "?v=" + hash;
}

function remember(name, picture, source) {
  const hash = crypto.createHash("sha1").update(picture.buf).digest("hex").slice(0, 10);
  cache.delete(name);
  cache.set(name, { buf: picture.buf, type: picture.type, hash, at: Date.now(), source });
  while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value);
  return proxyPath(name, hash);
}

/** Tries each candidate URL (with heic fixes) until one downloads as a real image. Non-HEIC links go first. */
async function firstWorkingPicture(urls, errs) {
  const tried = new Set();
  const rank = (u) => (/\.(heic|heif)(\?|$)/i.test(u) ? 1 : 0);
  const ordered = [...urls].sort((a, b) => rank(a) - rank(b));
  for (const raw of ordered) {
    for (const url of urlVariants(raw)) {
      if (tried.has(url)) continue;
      if (!isAllowedUrl(url)) { if (errs) errs.push("blocked host"); continue; }
      tried.add(url);
      for (let k = 0; k < 2; k++) {
        try {
          const picture = await downloadImage(url);
          return { picture, url };
        } catch (e) {
          const m = String((e && e.message) || e);
          if (errs) errs.push(m);
          if (!/timeout|abort|fetch failed|HTTP 5\d\d|ECONN|ENOTFOUND/i.test(m)) break; // not worth a second try
          await new Promise((r) => setTimeout(r, 400));
        }
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------- the TikTok profile page

/** The host's public profile picture URLs, read from their TikTok profile page. */
async function profilePagePictureUrls(name) {
  try {
    const res = await fetchFollowingSafeRedirects("https://www.tiktok.com/@" + encodeURIComponent(name), {
      Accept: "text/html,application/xhtml+xml",
    });
    if (!res.ok) return [];
    const html = await res.text();
    // Make sure it really is this user's page (not a captcha / redirect page).
    const who = new RegExp('"uniqueId":"' + name.replace(/[.]/g, "\\.") + '"', "i");
    if (!who.test(html)) return [];
    const wanted = ["avatarMedium", "avatarLarger", "avatarThumb"];
    const urls = [];
    for (const key of wanted) {
      const m = new RegExp('"' + key + '":"([^"]+)"').exec(html);
      if (!m) continue;
      try {
        urls.push(JSON.parse('"' + m[1] + '"'));
      } catch (_) { /* skip */ }
    }
    return urls.filter(isHttpUrl);
  } catch (_) {
    return [];
  }
}

// ---------------------------------------------------------------- the host's display name (update 30)

/** The display name ("Mia Zahra") TikTok's room info says the room owner has, or "". */
export function extractOwnerNickname(roomInfo) {
  if (!roomInfo || typeof roomInfo !== "object") return "";
  const infos = [roomInfo, roomInfo.data, roomInfo.roomInfo, roomInfo.data && roomInfo.data.data].filter(Boolean);
  for (const info of infos) {
    const owner = info.owner || info.anchor || info.host || info.owner_user || info.ownerUser || null;
    if (!owner || typeof owner !== "object") continue;
    const nick = owner.nickname || owner.nick_name || owner.nickName || owner.display_name || owner.displayName || "";
    if (typeof nick === "string" && nick.trim()) return nick.trim();
  }
  return "";
}

/** The host's display name read from their public TikTok profile page, or "" (never throws). */
export async function resolveHostNickname(username) {
  try {
    const name = normalizeHostName(username);
    if (!NAME_RE.test(name)) return "";
    const res = await fetchFollowingSafeRedirects("https://www.tiktok.com/@" + encodeURIComponent(name), {
      Accept: "text/html,application/xhtml+xml",
    });
    if (!res.ok) return "";
    const html = await res.text();
    const esc = name.replace(/[.]/g, "\\.");
    const m = new RegExp('"uniqueId":"' + esc + '"[^{}]{0,300}?"nickname":"((?:[^"\\\\]|\\\\.)*)"', "i").exec(html);
    if (!m) return "";
    try {
      return String(JSON.parse('"' + m[1] + '"')).trim();
    } catch (_) {
      return "";
    }
  } catch (_) {
    return "";
  }
}

// ---------------------------------------------------------------- public API

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const RETRY_DELAYS_MS = [0, 1500, 4000, 9000, 20000, 45000, 90000];

async function lookupOnce(connection, connectState, name, attemptIndex) {
  const candidates = [];
  const add = (roomInfo) => {
    try {
      candidates.push(...extractOwnerAvatarCandidates(roomInfo));
    } catch (_) { /* ignore */ }
  };

  if (attemptIndex === 0) {
    add(connectState && connectState.roomInfo);
    add(connection && connection.roomInfo);
  } else {
    try {
      if (connection && typeof connection.fetchRoomInfo === "function") add(await connection.fetchRoomInfo());
    } catch (_) { /* optional */ }
    add(connection && connection.roomInfo);
  }
  if (candidates.length) {
    const hit = await firstWorkingPicture(candidates);
    if (hit) return remember(name, hit.picture, "room-info");
  }

  const profileUrls = await profilePagePictureUrls(name);
  if (profileUrls.length) {
    const hit = await firstWorkingPicture(profileUrls);
    if (hit) return remember(name, hit.picture, "profile-page");
  }
  return null;
}

/**
 * Finds the host's profile picture for a freshly connected TikTok connection and returns a
 * same-origin URL for it (or null if nothing worked after several minutes of trying).
 * Never throws. Keeps retrying in the background, so callers should simply use `.then()`.
 *
 * @param connection    the TikTokLiveConnection that just finished connect()
 * @param connectState  whatever `await connection.connect()` resolved to
 * @param username      the TikTok username the game connected to (without @)
 * @param isCancelled   optional () => true once the connection was replaced/closed (stops retrying)
 */
export async function resolveHostAvatar(connection, connectState, username, isCancelled) {
  let name = normalizeHostName(username);
  if (!name) name = normalizeHostName(connection && (connection.uniqueId || connection._uniqueId));
  if (!name) name = normalizeHostName(ownerUsernameFromRoomInfo(connectState && connectState.roomInfo));
  if (!NAME_RE.test(name)) {
    // No usable username: fall back to the old behaviour (hand the raw picture URL to the browser).
    try {
      return (
        extractOwnerAvatar(connectState && connectState.roomInfo) ||
        extractOwnerAvatar(connection && connection.roomInfo) ||
        null
      );
    } catch (_) {
      return null;
    }
  }

  if (inflight.has(name)) return inflight.get(name);
  const job = (async () => {
    try {
      for (let i = 0; i < RETRY_DELAYS_MS.length; i++) {
        if (RETRY_DELAYS_MS[i]) await sleep(RETRY_DELAYS_MS[i]);
        if (typeof isCancelled === "function" && isCancelled()) break;
        try {
          const url = await lookupOnce(connection, connectState, name, i);
          if (url) return url;
        } catch (_) { /* try again */ }
      }
      // Nothing fresh worked: a picture saved from an earlier session is still the right face.
      const old = cache.get(name);
      return old ? proxyPath(name, old.hash) : null;
    } finally {
      inflight.delete(name);
    }
  })();
  inflight.set(name, job);
  return job;
}

/**
 * Late fallback: the host's own chat message carries their picture URL. Downloads it and returns the
 * same-origin URL (or null when it can't be fetched as a real image). Cheap when already cached.
 */
export async function adoptHostAvatar(username, rawUrl) {
  try {
    const name = normalizeHostName(username);
    if (!NAME_RE.test(name) || !isHttpUrl(rawUrl)) return null;
    const have = cache.get(name);
    if (have && Date.now() - have.at < FRESH_MS) return proxyPath(name, have.hash);
    if (inflight.has(name + ":adopt")) return inflight.get(name + ":adopt");
    const job = (async () => {
      try {
        const hit = await firstWorkingPicture([rawUrl]);
        return hit ? remember(name, hit.picture, "host-chat") : null;
      } catch (_) {
        return null;
      } finally {
        inflight.delete(name + ":adopt");
      }
    })();
    inflight.set(name + ":adopt", job);
    return job;
  } catch (_) {
    return null;
  }
}

/** Express handler: GET /host-avatar/:name  -> the cached picture bytes. */
export function serveHostAvatar(req, res) {
  const name = normalizeHostName(req.params && req.params.name);
  const entry = NAME_RE.test(name) ? cache.get(name) : null;
  if (!entry) {
    res.status(404).type("text/plain").send("No picture for that host yet.");
    return;
  }
  res.set({
    "Content-Type": entry.type,
    "Content-Length": String(entry.buf.length),
    "Cache-Control": "public, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(entry.buf);
}

/** Express handler: GET /host-avatar-status/:name -> small JSON for troubleshooting. */
export function hostAvatarStatus(req, res) {
  const name = normalizeHostName(req.params && req.params.name);
  const entry = NAME_RE.test(name) ? cache.get(name) : null;
  res.json(
    entry
      ? { cached: true, source: entry.source, bytes: entry.buf.length, type: entry.type, ageSeconds: Math.round((Date.now() - entry.at) / 1000) }
      : { cached: false, lookupRunning: inflight.has(name) }
  );
}

// ---------------------------------------------------------------- audience: find every viewer + every picture link (update 37)

/** Every picture URL on one TikTok user object (all sizes, all formats). JPEG/WEBP first, HEIC last. */
export function extractUserAvatarUrls(user) {
  const found = [];
  if (!user || typeof user !== "object") return found;
  for (const [key, value] of Object.entries(user)) {
    if (/avatar|profile.?pic|portrait/i.test(key)) urlsFromAvatarObject(value, found);
  }
  const rank = (u) => (/\.(heic|heif)(\?|$)/i.test(u) ? 1 : 0);
  return [...new Set(found)].sort((a, b) => rank(a) - rank(b));
}

/**
 * Walks ANY TikTok event payload and returns every viewer found in it (chat, join, like, gift, follow, share,
 * top-viewers lists, ...): [{ u: "username", nick, urls: [pictureLinks] }]. Only real usernames are returned
 * (never a display name), so a picture can always be matched to the right person.
 */
export function collectUserObjects(raw) {
  const out = new Map();
  if (!raw || typeof raw !== "object") return [];
  const queue = [[raw, 0]];
  let budget = 500;
  while (queue.length && budget-- > 0) {
    const [node, depth] = queue.shift();
    if (!node || typeof node !== "object") continue;
    if (Array.isArray(node)) {
      for (const item of node.slice(0, 300)) queue.push([item, depth + 1]);
      continue;
    }
    const id = normalizeHostName(node.uniqueId || node.displayId || node.display_id || node.unique_id || "");
    if (id && NAME_RE.test(id) && /[a-z0-9]/.test(id)) {
      const urls = extractUserAvatarUrls(node);
      if (depth === 0) for (const k of ["profilePictureUrl", "avatarUrl"]) if (isHttpUrl(node[k])) urls.push(node[k]);
      const nick = String(node.nickname || node.nickName || "").trim();
      const prev = out.get(id);
      if (!prev) out.set(id, { u: id, nick, urls: [...new Set(urls)] });
      else { prev.urls = [...new Set([...prev.urls, ...urls])]; if (!prev.nick && nick) prev.nick = nick; }
    }
    if (depth < 5) for (const v of Object.values(node)) if (v && typeof v === "object") queue.push([v, depth + 1]);
  }
  return [...out.values()];
}

function whyPictureFailed(urlCount, errs) {
  const all = errs.join(" | ");
  if (!urlCount && /no picture/.test(all)) return "TikTok sent no picture link and the profile page could not be read";
  if (/HTTP (403|404|410)/.test(all)) return "TikTok refused or expired the picture link";
  if (/browser-friendly/.test(all)) return "TikTok only offered a HEIC picture";
  if (/timeout|abort|fetch failed|ECONN|ENOTFOUND/i.test(all)) return "TikTok's picture server did not answer in time";
  return "the picture could not be downloaded";
}

/**
 * (update 29) Downloads ANY viewer's profile picture as a real image (used by the SHAPEDLE audience-picture
 * symbols). Tries the picture links TikTok sent with the viewer's event first, then the viewer's public
 * profile page. Returns { buf, type } or null. Never throws. Only TikTok's own picture hosts are contacted.
 */
export async function downloadViewerPicture(username, rawUrls, report) {
  try {
    const name = normalizeHostName(username);
    const urls = (Array.isArray(rawUrls) ? rawUrls : [rawUrls]).filter(isHttpUrl);
    const errs = [];
    let hit = urls.length ? await firstWorkingPicture(urls, errs) : null;
    if (!hit && NAME_RE.test(name)) {
      const pageUrls = await profilePagePictureUrls(name);
      if (pageUrls.length) hit = await firstWorkingPicture(pageUrls, errs);
      else errs.push("profile page: no picture");
    }
    if (!hit && report) report.why = whyPictureFailed(urls.length, errs);
    return hit ? hit.picture : null;
  } catch (_) {
    if (report) report.why = "the picture could not be downloaded";
    return null;
  }
}
