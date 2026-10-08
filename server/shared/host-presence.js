// ===================================================================
// HOST PRESENCE HUB  (update 30)
//
// Knows WHICH TikTok account(s) are connected to the platform right now, so the HOME page can show
// "<HOST NAME> LIVE GAMES" with the host's round TikTok profile picture in its top-left banner.
//
// How it gets its information (no game had to be edited):
//   Every game already calls  Engagement.attach(connection, { game, tiktokUsername })  the moment its
//   TikTok connection succeeds. engagement-hub.js now also calls  HostPresence.register(...)  from
//   there, so ALL fourteen games report here automatically - including any game added later.
//
//   - The display name ("Mia Zahra") comes from, in order: the room info TikTok sent on connect,
//     the host's public TikTok profile page, and finally the host's own chat messages.
//     If none of them works the @username is used, so the banner never stays empty.
//   - The picture comes from resolveHostAvatar() in host-avatar.js (downloaded by the server and served
//     from this site at /host-avatar/<username>, so it can never be blocked or expire).
//   - When the connection drops / the LIVE ends / the game switches to Test or Offline, the host is
//     removed again and the HOME banner goes back to "TIKTOK LIVE GAMES".
//
// Published two ways: Socket.IO namespace /home-hub (event "hosts:state") for instant updates and
// GET /api/live-host for first paint / polling fallback.
// ===================================================================

import {
  resolveHostAvatar,
  adoptHostAvatar,
  isHostUser,
  normalizeHostName,
  extractOwnerNickname,
  resolveHostNickname,
} from "./host-avatar.js";

const NAME_RE = /^[a-z0-9._]{1,40}$/;
const SWEEP_MS = 15000;
const NICKNAME_RETRY_MS = [0, 6000, 25000, 90000];
const CHAT_REFRESH_MS = 5 * 60 * 1000;

/** Every picture URL found in a chat event's user object (field names differ between versions). */
function pictureUrlsFromChat(data) {
  const out = [];
  const seen = new Set();
  const walk = (value, depth) => {
    if (!value || depth > 4) return;
    if (typeof value === "string") {
      if (/^https?:\/\//i.test(value) && !seen.has(value)) {
        seen.add(value);
        out.push(value);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((v) => walk(v, depth + 1));
      return;
    }
    if (typeof value === "object") {
      for (const key of ["urls", "url_list", "urlList", "url"]) {
        if (value[key] !== undefined) walk(value[key], depth + 1);
      }
    }
  };
  const user = (data && (data.user || data)) || {};
  for (const [key, value] of Object.entries(user)) {
    if (/avatar|profile.?pic|portrait/i.test(key)) walk(value, 0);
  }
  if (data && data !== user) {
    for (const [key, value] of Object.entries(data)) {
      if (/avatar|profile.?pic|portrait/i.test(key)) walk(value, 0);
    }
  }
  // Prefer links that are not heic (browsers cannot draw those) - the downloader also fixes them.
  return out.sort((a, b) => /\.heic(\?|$)/i.test(a) - /\.heic(\?|$)/i.test(b));
}

class HostPresenceHub {
  constructor() {
    this.io = null;
    this.nsp = null;
    this.hosts = new Map(); // username -> host record
    this.byConn = new Map(); // connection -> { username, misses }
    this.timer = null;
    this.version = 0;
    this.seq = 0; // counts connections so "newest first" is exact even within the same millisecond
  }

  /** Call ONCE from server.js. Adds the Socket.IO namespace and GET /api/live-host. */
  init(io, app) {
    if (this.io) return;
    this.io = io;
    this.nsp = io.of("/home-hub");
    this.nsp.on("connection", (socket) => {
      socket.emit("hosts:state", this.getState());
    });
    if (app && typeof app.get === "function") {
      app.get("/api/live-host", (req, res) => {
        res.set("Cache-Control", "no-store");
        res.json(this.getState());
      });
    }
    this.timer = setInterval(() => this._sweep(), SWEEP_MS);
    if (this.timer.unref) this.timer.unref();
    console.log("[home] live-host banner ready (namespace /home-hub, GET /api/live-host)");
  }

  /** What the HOME page shows: newest connected host first. */
  getState() {
    const hosts = [...this.hosts.values()]
      .sort((a, b) => b.since - a.since)
      .map((h) => ({
        username: h.username,
        displayName: h.nickname || h.username,
        nickname: h.nickname || "",
        avatarUrl: h.avatarUrl || "",
        games: [...h.games],
      }));
    return { version: this.version, hosts };
  }

  _broadcast() {
    this.version += 1;
    if (this.nsp) this.nsp.emit("hosts:state", this.getState());
  }

  /**
   * Called by Engagement.attach() for every successful TikTok connection.
   * Never throws; everything slow (picture, name lookups) runs in the background.
   */
  register(connection, meta = {}) {
    try {
      if (!connection || typeof connection.on !== "function") return;
      if (this.byConn.has(connection)) return;
      const username = normalizeHostName(meta.tiktokUsername || connection.uniqueId || connection._uniqueId);
      if (!NAME_RE.test(username)) return;

      let host = this.hosts.get(username);
      const isNew = !host;
      if (!host) {
        host = {
          username,
          nickname: "",
          avatarUrl: "",
          since: 0,
          conns: new Set(),
          games: new Set(),
          lastChatCheck: 0,
        };
        this.hosts.set(username, host);
      }
      host.conns.add(connection);
      if (meta.game) host.games.add(String(meta.game));
      host.since = ++this.seq; // the host the platform connected to most recently is shown first
      this.byConn.set(connection, { username, misses: 0, game: meta.game ? String(meta.game) : "" });

      // 1) name straight from the room info the library already fetched on connect (instant, no network).
      const early = extractOwnerNickname(connection.roomInfo);
      if (early && !host.nickname) host.nickname = early;

      const drop = () => this._drop(connection);
      connection.on("disconnected", drop);
      connection.on("streamEnd", drop);

      // 2) the host's own chat messages carry their name + picture too (late fallback).
      connection.on("chat", (data) => {
        try {
          this._learnFromChat(host, data);
        } catch (_) { /* never break a game */ }
      });

      this._broadcast();
      if (isNew || !host.avatarUrl) this._lookupAvatar(host, connection);
      if (!host.nickname) this._lookupNickname(host, connection);
    } catch (err) {
      console.error("[home] could not register live host:", err && err.message ? err.message : err);
    }
  }

  _lookupAvatar(host, connection) {
    const isGone = () => !this.byConn.has(connection) && !host.conns.size; // true = stop retrying
    resolveHostAvatar(connection, null, host.username, isGone)
      .then((url) => {
        if (url && this.hosts.get(host.username) === host && url !== host.avatarUrl) {
          host.avatarUrl = url;
          this._broadcast();
        }
      })
      .catch(() => {});
  }

  async _lookupNickname(host, connection) {
    for (const delay of NICKNAME_RETRY_MS) {
      if (delay) await new Promise((r) => setTimeout(r, delay));
      if (this.hosts.get(host.username) !== host) return; // host left meanwhile
      if (host.nickname) return; // learned from room info or chat in the meantime
      const early = extractOwnerNickname(connection.roomInfo);
      const nick = early || (await resolveHostNickname(host.username));
      if (nick && this.hosts.get(host.username) === host) {
        host.nickname = nick;
        this._broadcast();
        return;
      }
    }
  }

  _learnFromChat(host, data) {
    const user = (data && (data.user || data)) || {};
    const who = user.uniqueId || data.uniqueId || "";
    if (!isHostUser(who, host.username)) return;
    const nick = String(user.nickname || data.nickname || "").trim();
    let changed = false;
    if (nick && nick !== host.nickname) {
      host.nickname = nick;
      changed = true;
    }
    const now = Date.now();
    if (!host.avatarUrl || now - host.lastChatCheck > CHAT_REFRESH_MS) {
      host.lastChatCheck = now;
      const urls = pictureUrlsFromChat(data);
      if (urls.length && !host.avatarUrl) {
        adoptHostAvatar(host.username, urls[0])
          .then((url) => {
            if (url && this.hosts.get(host.username) === host && url !== host.avatarUrl) {
              host.avatarUrl = url;
              this._broadcast();
            }
          })
          .catch(() => {});
      }
    }
    if (changed) this._broadcast();
  }

  _drop(connection) {
    const rec = this.byConn.get(connection);
    if (!rec) return;
    this.byConn.delete(connection);
    const host = this.hosts.get(rec.username);
    if (!host) return;
    host.conns.delete(connection);
    // Forget the game name only when no other live connection of that host still belongs to it.
    if (rec.game) {
      let stillUsed = false;
      for (const c of host.conns) {
        const other = this.byConn.get(c);
        if (other && other.game === rec.game) stillUsed = true;
      }
      if (!stillUsed) host.games.delete(rec.game);
    }
    if (!host.conns.size) this.hosts.delete(rec.username);
    this._broadcast();
  }

  /**
   * Safety net: a game that closes its connection without the library firing "disconnected" (or a game
   * that was switched to Test/Offline) must not leave a stale host on the HOME banner.
   */
  _sweep() {
    for (const [connection, rec] of [...this.byConn.entries()]) {
      if (connection && connection.isConnected === false) {
        rec.misses += 1;
        if (rec.misses >= 2) this._drop(connection);
      } else {
        rec.misses = 0;
      }
    }
  }
}

export const HostPresence = new HostPresenceHub();
