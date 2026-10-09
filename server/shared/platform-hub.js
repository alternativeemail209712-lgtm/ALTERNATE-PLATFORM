// ===================================================================
// PLATFORM HUB  (update 38)
//
// The HOME page's "one connection for every game".
//
//  * MODE  - the platform-wide mode the host picked on HOME: "offline" | "test" | "live". Every game page
//            follows it automatically (see public/shared/platform-sync.js).
//  * ONE TikTok connection - in Live mode the hub opens ONE real TikTokLiveConnection (the "master") for the
//            host's username. Every game that asks for a TikTok connection for that same username is
//            handed a lightweight "follower": it receives every event of the master through the normal
//            .on(...) listeners it already uses, but opens NO connection of its own (no second room-id
//            lookup, no second signing request, no second websocket). Games did not need to change.
//  * STATUS - the hub measures the connection (key, account found/LIVE, chat socket, events flowing, games
//            linked) and explains every problem in plain words (reuses tiktok-errors.js), for the HOME
//            floating window.
//
// Published as:   GET  /api/platform             current state (JSON)
//                 GET  /api/platform/stream      the same state pushed live (Server-Sent Events)
//                 POST /api/platform/mode        { mode }
//                 POST /api/platform/connect     { username }   (also switches to Live)
//                 POST /api/platform/disconnect
//                 POST /api/platform/retry       reconnect with the saved username
// If HOME_EDIT_KEY is set, the POST routes need it (header x-edit-key) - same key as the card designer.
// ===================================================================
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { TikTokLiveConnection, WebcastEvent, ControlEvent } from "tiktok-live-connector";
import { normalizeUser, setFollowerProvider, tiktokStats } from "./tiktok-resilience.js";
import { explainTikTokErrorParts } from "./tiktok-errors.js";
import { HostPresence } from "./host-presence.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "..", "..", "data", "platform.json");

const SCALE = Number(process.env.TIKTOK_DELAY_SCALE) || 1; // tests only
const NAME_RE = /^[a-z0-9._]{2,40}$/;
const MODES = ["offline", "test", "live"];
const START_ATTEMPTS = 3;
const START_RETRY_MS = [6000, 15000];
const RECONNECT_MS = [3000, 6000, 12000, 20000, 30000, 45000, 60000, 60000, 90000, 120000];
const SILENT_WARN_MS = 120 * 1000; // connected but no event at all for this long -> yellow
const FIRST_EVENT_GRACE_MS = 45 * 1000;
const FOLLOWER_WAIT_MS = 120 * 1000;
const RESUME_WINDOW_MS = 3 * 60 * 60 * 1000;
const HEARTBEAT_MS = 5000;
const PERMANENT = new Set(["NO_KEY", "KEY_REJECTED", "QUOTA", "BAD_USERNAME", "NO_SUCH_USER", "NOT_LIVE", "RESTRICTED"]);

const EV_DISCONNECTED = (ControlEvent && ControlEvent.DISCONNECTED) || "disconnected";
const EV_STREAM_END = (WebcastEvent && WebcastEvent.STREAM_END) || "streamEnd";
const EV_RAW = (ControlEvent && ControlEvent.RAW_DATA) || "rawData";
const EV_DECODED = (ControlEvent && ControlEvent.DECODED_DATA) || "decodedData";
const EV_ERROR = (ControlEvent && ControlEvent.ERROR) || (WebcastEvent && WebcastEvent.ERROR) || "error";
const EV_CHAT = (WebcastEvent && WebcastEvent.CHAT) || "chat";
const EV_ROOM_USER = (WebcastEvent && WebcastEvent.ROOM_USER) || "roomUser";
const NOISE = new Set([EV_RAW, EV_DECODED, "websocketConnected", "connected"]);

const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms * SCALE)));
const keyConfigured = () => Boolean(process.env.EULERSTREAM_API_KEY || process.env.TIKTOK_SIGN_API_KEY);
const msgOf = (e) => String((e && (e.message || e.info || e)) || "");

function fmtAge(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return s + " s";
  const m = Math.floor(s / 60);
  if (m < 60) return m + " min " + (s % 60) + " s";
  return Math.floor(m / 60) + " h " + (m % 60) + " min";
}

class PlatformHubClass {
  constructor() {
    this.mode = "test"; // same default every game had before this update
    this.username = "";
    this.status = "idle"; // idle | connecting | connected | reconnecting | failed | ended
    this.statusSince = Date.now();
    this.gen = 0; // bumps on every connect/disconnect so older loops stop
    this.master = null;
    this.masterState = null;
    this.followers = new Set();
    this.attempt = 0;
    this.attemptLog = []; // [{ n, at, title }]
    this.error = null; // parts of the last problem { code, title, detail, fix, raw }
    this.connectedAt = 0;
    this.lastEventAt = 0;
    this.chatCount = 0;
    this.viewers = null;
    this.eventTimes = [];
    this.reconnectTimes = [];
    this.reconnectAttempt = 0;
    this.lastConnectedAt = 0;
    this.waiters = new Set();
    this.sseClients = new Set();
    this.editKey = "";
    this.version = 0;
    this._pending = null;
    this._sawDisconnected = false;
    this._hb = null;
    this.lastDataAt = 0;
    this._attemptMaster = null;
  }

  // ------------------------------------------------------------------ setup
  init(app, express, opts = {}) {
    if (this._inited) return;
    this._inited = true;
    this.editKey = String(process.env.HOME_EDIT_KEY || "");
    this.file = opts.file || DATA_FILE;
    this._load();
    setFollowerProvider((conn) => this.attachFollower(conn));

    const json = express.json({ limit: "4kb" });
    const guard = (req, res, next) => {
      if (this.editKey && String(req.get("x-edit-key") || "") !== this.editKey) {
        return res.status(401).json({ error: "edit-key-required" });
      }
      next();
    };
    app.get("/api/platform", (req, res) => { res.set("Cache-Control", "no-store"); res.json(this.getState()); });
    app.get("/api/platform/stream", (req, res) => {
      res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-store, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
      res.flushHeaders && res.flushHeaders();
      res.write("retry: 3000\n\n");
      this.sseClients.add(res);
      this._send(res);
      req.on("close", () => this.sseClients.delete(res));
    });
    const run = (fn) => async (req, res) => {
      try { await fn(req.body || {}); res.json(this.getState()); }
      catch (e) { res.status(400).json({ error: msgOf(e), state: this.getState() }); }
    };
    app.post("/api/platform/mode", guard, json, run(async (b) => { await this.setMode(b.mode); }));
    const started = async (p) => { await Promise.race([p.catch(() => {}), new Promise((r) => setTimeout(r, 400))]); };
    app.post("/api/platform/connect", guard, json, run(async (b) => { await started(this.connect(b.username)); }));
    app.post("/api/platform/disconnect", guard, json, run(async () => { await this.disconnect(); }));
    app.post("/api/platform/retry", guard, json, run(async () => { await started(this.connect(this.username)); }));

    this._hb = setInterval(() => { if (this.sseClients.size || this.status === "connected") this._broadcast(); }, HEARTBEAT_MS);
    if (this._hb.unref) this._hb.unref();
    console.log("[platform] hub ready (mode " + this.mode + (this.username ? ", saved host @" + this.username : "") + ")");

    // Render restarts wipe running connections: pick up again if we were LIVE-connected very recently.
    if (process.env.PLATFORM_AUTORESUME !== "0" && this.mode === "live" && this.username && keyConfigured() &&
        this.lastConnectedAt && Date.now() - this.lastConnectedAt < RESUME_WINDOW_MS) {
      console.log("[platform] resuming the shared connection for @" + this.username);
      setTimeout(() => this.connect(this.username).catch(() => {}), 2500 * SCALE);
    }
  }

  _load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, "utf8"));
      if (MODES.includes(raw.mode)) this.mode = raw.mode;
      if (typeof raw.username === "string" && NAME_RE.test(raw.username)) this.username = raw.username;
      this.lastConnectedAt = Number(raw.lastConnectedAt) || 0;
    } catch (_) { /* first run */ }
  }
  _save() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = this.file + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify({ mode: this.mode, username: this.username, lastConnectedAt: this.lastConnectedAt }));
      fs.renameSync(tmp, this.file);
    } catch (e) { console.warn("[platform] could not save settings:", msgOf(e)); }
  }

  // ------------------------------------------------------------------ commands
  async setMode(mode) {
    mode = String(mode || "").toLowerCase();
    if (!MODES.includes(mode)) throw new Error("Mode must be offline, test or live.");
    if (mode !== "live") await this._teardown();
    this.mode = mode;
    if (mode !== "live") this._set("idle");
    this._save();
    this._broadcast();
  }

  async connect(usernameRaw) {
    const user = normalizeUser(usernameRaw);
    if (!NAME_RE.test(user)) {
      await this._teardown();
      this.mode = "live";
      this.username = user;
      this.error = explainTikTokErrorParts(new Error("invalid unique id"), user);
      this.attemptLog = [];
      this._set("failed");
      this._broadcast();
      return false;
    }
    // Claim the username + "connecting" state synchronously, so a game that connects in the same instant waits
    // for (and shares) this connection instead of opening its own.
    const gen = ++this.gen;
    this.mode = "live";
    this.username = user;
    this.attempt = 0;
    this.attemptLog = [];
    this.error = null;
    this.chatCount = 0;
    this.viewers = null;
    this.lastEventAt = 0;
    this.eventTimes = [];
    this._set("connecting");
    await this._teardown(false);
    if (gen !== this.gen) return false;
    this._save();
    this._broadcast();

    if (!keyConfigured()) {
      this.error = { code: "NO_KEY", title: "No signing key is set on the server", detail: "TikTok cannot be reached without the EulerStream key.", fix: "Add EULERSTREAM_API_KEY in Render > Environment, then redeploy.", raw: "" };
      this._set("failed");
      this._broadcast();
      return false;
    }

    for (let n = 1; n <= START_ATTEMPTS; n++) {
      if (gen !== this.gen) return false;
      this.attempt = n;
      this._broadcast();
      const master = this._makeMaster(user);
      this._attemptMaster = master;
      try {
        const state = await master.connect();
        if (gen !== this.gen) { try { master.disconnect(); } catch (_) { /* superseded */ } return false; }
        this._adopt(master, state, user);
        return true;
      } catch (err) {
        if (gen !== this.gen) return false;
        try { master.disconnect(); } catch (_) { /* never connected */ }
        const parts = explainTikTokErrorParts(err, user);
        this.error = parts;
        this.attemptLog.push({ n, at: Date.now(), title: parts.title });
        if (this.attemptLog.length > 6) this.attemptLog.shift();
        console.warn("[platform] @" + user + " try " + n + "/" + START_ATTEMPTS + " failed: " + parts.code + " - " + parts.raw);
        if (PERMANENT.has(parts.code) || n === START_ATTEMPTS) {
          this._set("failed");
          this._broadcast();
          this._wake();
          return false;
        }
        this._broadcast();
        await sleep(START_RETRY_MS[n - 1] || 15000);
      }
    }
    return false;
  }

  async disconnect() {
    await this._teardown();
    this._set("idle");
    this._broadcast();
  }

  // ------------------------------------------------------------------ master connection
  _makeMaster(user) {
    const opts = { processInitialData: true, fetchRoomInfoOnConnect: true };
    const key = process.env.EULERSTREAM_API_KEY || process.env.TIKTOK_SIGN_API_KEY;
    if (key) opts.signApiKey = key;
    const master = new TikTokLiveConnection(user, opts);
    master.__pfMaster = true;
    const origEmit = master.emit.bind(master);
    master.emit = (ev, ...args) => {
      if (this.master === master || this._attemptMaster === master || ev === EV_DISCONNECTED) this._observe(ev, args, master);
      for (const f of this.followers) { try { f.emit(ev, ...args); } catch (_) { /* a game's handler must never break the shared feed */ } }
      return origEmit(ev, ...args);
    };
    master.on(EV_ERROR, () => { /* logged by the games / counted below; an unhandled 'error' must not crash the process */ });
    return master;
  }

  _adopt(master, state, user) {
    this.master = master;
    this.masterState = state || null;
    this.connectedAt = Date.now();
    this.lastEventAt = 0;
    this.lastConnectedAt = Date.now();
    this.error = null;
    this.reconnectAttempt = 0;
    this._sawDisconnected = false;
    this._save();
    try { HostPresence.register(master, { game: "platform", tiktokUsername: user }); } catch (_) { /* banner only */ }
    master.on(EV_DISCONNECTED, () => this._onDropped(master));
    master.on(EV_STREAM_END, () => this._onEnded(master));
    this._set("connected");
    this._broadcast();
    this._wake();
    console.log("[platform] one shared connection is up for @" + user + " (" + this.followers.size + " game(s) linked)");
  }

  _observe(ev, args, master) {
    const now = Date.now();
    if (ev === EV_DISCONNECTED) { this._sawDisconnected = true; return; }
    if (ev === EV_RAW || ev === EV_DECODED) { this.lastDataAt = now; return; }
    if (NOISE.has(ev) || ev === "reconnected") return;
    this.lastEventAt = now;
    this.eventTimes.push(now);
    if (this.eventTimes.length > 4000) this.eventTimes.splice(0, 1000);
    if (ev === EV_CHAT) this.chatCount += 1;
    if (ev === EV_ROOM_USER) {
      const d = args[0] || {};
      const v = Number(d.viewerCount != null ? d.viewerCount : d.userCount);
      if (Number.isFinite(v)) this.viewers = v;
    }
  }

  _onDropped(master) {
    if (master !== this.master || this.status === "ended" || this.status === "idle") return;
    if (this._reconnecting) return;
    this.error = { code: "DROPPED", title: "The connection to TikTok was cut", detail: "TikTok closed the chat socket or the network dropped.", fix: "The platform is reconnecting by itself - nothing to do unless it fails.", raw: "" };
    this._set("reconnecting");
    this._broadcast();
    this._reconnectLoop(master, this.gen).catch(() => {});
  }

  async _reconnectLoop(master, gen) {
    this._reconnecting = true;
    try {
      for (let i = 0; i < RECONNECT_MS.length; i++) {
        this.reconnectAttempt = i + 1;
        this._broadcast();
        await sleep(RECONNECT_MS[i] + Math.floor(Math.random() * RECONNECT_MS[i] * 0.25));
        if (gen !== this.gen || master !== this.master) return;
        try {
          const state = await master.connect();
          if (gen !== this.gen || master !== this.master) return;
          this.masterState = state || this.masterState;
          this.connectedAt = Date.now();
          this.error = null;
          this.reconnectTimes.push(Date.now());
          this.reconnectTimes = this.reconnectTimes.filter((t) => Date.now() - t < 10 * 60 * 1000);
          this._sawDisconnected = false;
          this._set("connected");
          this._broadcast();
          try { master.emit("reconnected"); } catch (_) { /* followers only */ }
          console.log("[platform] shared connection restored for @" + this.username);
          return;
        } catch (err) {
          if (gen !== this.gen || master !== this.master) return;
          const parts = explainTikTokErrorParts(err, this.username);
          this.error = parts;
          if (PERMANENT.has(parts.code)) {
            this._set(parts.code === "NOT_LIVE" ? "ended" : "failed");
            this._broadcast();
            return;
          }
          this._broadcast();
        }
      }
      this._set("failed");
      this._broadcast();
    } finally { this._reconnecting = false; }
  }

  _onEnded(master) {
    if (master !== this.master) return;
    this.error = { code: "STREAM_ENDED", title: "The TikTok LIVE ended", detail: "TikTok told the platform that @" + this.username + "'s broadcast is over.", fix: "Start a new LIVE, then press Connect again.", raw: "" };
    this._set("ended");
    this._broadcast();
  }

  async _teardown(bump = true) {
    if (bump) this.gen += 1; // stops any connect / reconnect loop still running
    const master = this.master;
    this.master = null;
    this.masterState = null;
    this._reconnecting = false;
    if (master) {
      this._sawDisconnected = false;
      try { await Promise.resolve(master.disconnect()); } catch (_) { /* already closed */ }
      if (!this._sawDisconnected) { try { master.emit(EV_DISCONNECTED); } catch (_) { /* tell the games + HOME banner */ } }
    }
    for (const f of [...this.followers]) { try { f.__pfDetachNow && f.__pfDetachNow(); } catch (_) { /* ignore */ } }
    this.followers.clear();
    this.connectedAt = 0;
    this.error = null;
    this._wake();
  }

  // ------------------------------------------------------------------ followers (games)
  _wake() { for (const w of [...this.waiters]) w(); }
  _waitSettled(ms) {
    return new Promise((resolve) => {
      const t = setTimeout(() => { this.waiters.delete(done); resolve(false); }, ms * SCALE);
      const done = () => {
        if (this.status === "connecting" || this.status === "reconnecting") return;
        clearTimeout(t); this.waiters.delete(done); resolve(true);
      };
      this.waiters.add(done);
    });
  }

  /** Called by the patched TikTokLiveConnection.connect() of every game. null = "do your own connection". */
  async attachFollower(conn) {
    const user = normalizeUser(conn && (conn.uniqueId || conn._uniqueId));
    if (this.mode !== "live" || !user || user !== this.username) return null;
    if (this.status === "connecting" || this.status === "reconnecting") {
      await this._waitSettled(FOLLOWER_WAIT_MS);
      if (this.status === "connecting" || this.status === "reconnecting") {
        throw new Error("Timed out waiting for the platform's shared connection (HOME) - see the connection window on the HOME page.");
      }
    }
    if (this.status !== "connected" || !this.master) return null;
    return this._link(conn);
  }

  _link(conn) {
    const master = this.master;
    let attached = true;
    const def = (name, get) => { try { Object.defineProperty(conn, name, { configurable: true, get }); } catch (_) { /* frozen */ } };
    def("isConnected", () => attached && this.master === master && this.status === "connected");
    def("roomInfo", () => master.roomInfo);
    def("roomId", () => master.roomId);
    def("availableGifts", () => master.availableGifts);
    try { conn.fetchRoomInfo = async () => (typeof master.fetchRoomInfo === "function" ? master.fetchRoomInfo() : master.roomInfo); } catch (_) { /* ignore */ }
    const detach = () => {
      if (!attached) return;
      attached = false;
      this.followers.delete(conn);
      conn.__pfDetach = null;
      conn.__pfDetachNow = null;
      try { conn.emit(EV_DISCONNECTED); } catch (_) { /* the game's own handler */ }
      this._broadcast();
    };
    conn.__pfDetach = detach;
    conn.__pfDetachNow = detach;
    this.followers.add(conn);
    this._broadcast();
    const st = this.masterState || {};
    return { ...st, isConnected: true, roomId: master.roomId || st.roomId, roomInfo: master.roomInfo || st.roomInfo, shared: true };
  }

  // ------------------------------------------------------------------ status model
  _set(status) {
    if (this.status !== status) { this.status = status; this.statusSince = Date.now(); }
  }

  _linkedGames() {
    try {
      const host = HostPresence.getState().hosts.find((h) => h.username === this.username);
      return host ? host.games.filter((g) => g !== "platform") : [];
    } catch (_) { return []; }
  }

  getState() {
    const now = Date.now();
    const key = keyConfigured();
    const connected = this.status === "connected";
    const err = this.error;
    const lastEvAge = this.lastEventAt ? now - this.lastEventAt : null;
    const sinceConnect = this.connectedAt ? now - this.connectedAt : 0;
    this.eventTimes = this.eventTimes.filter((t) => now - t < 60000);
    const recentReconnects = this.reconnectTimes.filter((t) => now - t < 10 * 60 * 1000).length;
    const games = this._linkedGames();

    const checks = [];
    const C = (id, label, state, detail) => checks.push({ id, label, state, detail });
    C("key", "Signing key on the server", key ? "ok" : "fail", key ? "EulerStream key found." : "No EULERSTREAM_API_KEY is set.");

    const lookupFailed = this.status === "failed" && err && err.code !== "WEBSOCKET";
    const chatFailed = this.status === "failed" && err && err.code === "WEBSOCKET";
    if (this.status === "idle") C("live", "Account found and LIVE", "wait", this.mode === "live" ? "Waiting for you to press Connect." : "Not used in " + this.mode + " mode.");
    else if (this.status === "connecting") C("live", "Account found and LIVE", "run", "Looking up @" + this.username + "'s LIVE room (try " + this.attempt + " of " + START_ATTEMPTS + ")...");
    else if (lookupFailed) C("live", "Account found and LIVE", "fail", err.title);
    else if (this.status === "ended") C("live", "Account found and LIVE", "fail", err ? err.title : "The LIVE ended.");
    else C("live", "Account found and LIVE", "ok", "Room " + ((this.master && this.master.roomId) || (this.masterState && this.masterState.roomId) || "found") + ".");

    if (connected) C("chat", "Chat connection open", "ok", "Connected for " + fmtAge(sinceConnect) + ".");
    else if (this.status === "connecting") C("chat", "Chat connection open", "run", "Opening the chat socket...");
    else if (this.status === "reconnecting") C("chat", "Chat connection open", "warn", "Dropped - reconnecting (try " + this.reconnectAttempt + " of " + RECONNECT_MS.length + ").");
    else if (chatFailed) C("chat", "Chat connection open", "fail", err.title);
    else C("chat", "Chat connection open", "wait", "Not open.");

    if (connected) {
      if (lastEvAge != null && lastEvAge <= SILENT_WARN_MS) C("events", "Live events arriving", "ok", "Last event " + fmtAge(lastEvAge) + " ago, " + this.chatCount + " chat message(s) so far.");
      else if (lastEvAge == null && sinceConnect < FIRST_EVENT_GRACE_MS) C("events", "Live events arriving", "run", "Waiting for the first event...");
      else C("events", "Live events arriving", "warn", lastEvAge == null ? "Nothing received since connecting (" + fmtAge(sinceConnect) + ")." : "Nothing received for " + fmtAge(lastEvAge) + ".");
    } else C("events", "Live events arriving", "wait", "Starts once the chat is connected.");

    if (connected) C("games", "Games sharing this connection", this.followers.size ? "ok" : "wait", this.followers.size ? this.followers.size + " linked" + (games.length ? ": " + games.join(", ") : "") + "." : "None open yet - every game links itself the moment you open it.");
    else C("games", "Games sharing this connection", "wait", "Starts once the chat is connected.");

    const reasons = [];
    let health = "off", headline = "", summary = "";
    if (this.mode !== "live") {
      health = "off";
      headline = this.mode === "test" ? "Test mode - no TikTok connection needed" : "Offline mode - no TikTok connection needed";
      summary = this.mode === "test" ? "Every game simulates chat by itself." : "Games are played by typing guesses on the host screen.";
    } else if (this.status === "idle") {
      health = "idle"; headline = "Live mode - not connected yet"; summary = "Type your TikTok username and press Connect.";
    } else if (this.status === "connecting") {
      health = "connecting"; headline = "Connecting to @" + this.username + "..."; summary = "Try " + this.attempt + " of " + START_ATTEMPTS + ". This can take up to a minute.";
      if (this.error) reasons.push({ level: "warn", title: "Try " + Math.max(1, this.attempt - 1) + " did not work: " + this.error.title, detail: this.error.detail, fix: "The platform is trying again by itself.", raw: this.error.raw });
    } else if (connected) {
      const silent = lastEvAge == null ? sinceConnect >= FIRST_EVENT_GRACE_MS : lastEvAge > SILENT_WARN_MS;
      if (silent) {
        health = "warn"; headline = "Connected, but TikTok is sending nothing";
        summary = lastEvAge == null ? "Nothing arrived since connecting." : "Nothing arrived for " + fmtAge(lastEvAge) + ".";
        reasons.push({ level: "warn", title: "No data from TikTok for " + (lastEvAge == null ? fmtAge(sinceConnect) : fmtAge(lastEvAge)), detail: "Either the LIVE is very quiet (no viewers, chat, likes or gifts yet), or TikTok stopped feeding this connection while keeping the socket open.", fix: "Ask someone to comment. If chat is active but nothing arrives, press Reconnect.", raw: "" });
      } else if (recentReconnects >= 3) {
        health = "warn"; headline = "Connected, but unstable"; summary = "Reconnected " + recentReconnects + " times in the last 10 minutes.";
        reasons.push({ level: "warn", title: "The connection keeps dropping (" + recentReconnects + " times in 10 min)", detail: "TikTok or the network is cutting the socket repeatedly. The platform restores it each time.", fix: "If guesses get lost, check the phone/stream network and the Render status page.", raw: "" });
      } else {
        health = "good"; headline = "Connected - all games share this one connection";
        summary = "@" + this.username + " is LIVE and events are flowing.";
      }
      if (!key) reasons.push({ level: "warn", title: "No signing key is set", detail: "Connection works now but is likely to fail on the next reconnect.", fix: "Add EULERSTREAM_API_KEY in Render > Environment.", raw: "" });
    } else if (this.status === "reconnecting") {
      health = "warn"; headline = "Connection dropped - reconnecting"; summary = "Try " + this.reconnectAttempt + " of " + RECONNECT_MS.length + ". Games stay open and resume by themselves.";
      if (err) reasons.push({ level: "warn", title: err.title, detail: err.detail, fix: err.fix, raw: err.raw });
    } else if (this.status === "ended") {
      health = "bad"; headline = "The LIVE has ended"; summary = "";
      if (err) reasons.push({ level: "bad", title: err.title, detail: err.detail, fix: err.fix, raw: err.raw });
    } else if (this.status === "failed") {
      health = "bad"; headline = "Connection failed"; summary = "@" + this.username + " could not be connected.";
      if (err) reasons.push({ level: "bad", title: err.title, detail: err.detail, fix: err.fix, raw: err.raw });
    }

    return {
      now, version: this.version, mode: this.mode, username: this.username,
      status: this.status, statusSince: this.statusSince, health, headline, summary,
      keyConfigured: key, editKeyRequired: Boolean(this.editKey),
      attempt: this.attempt, maxAttempts: START_ATTEMPTS,
      reconnectAttempt: this.reconnectAttempt, maxReconnects: RECONNECT_MS.length,
      attemptLog: this.attemptLog.map((a) => ({ n: a.n, at: a.at, title: a.title })),
      checks, reasons,
      details: {
        username: this.username || null,
        connectedAt: connected ? this.connectedAt : null,
        roomId: (this.master && this.master.roomId) || (this.masterState && this.masterState.roomId) || null,
        viewers: this.viewers,
        connectedForMs: connected ? sinceConnect : null,
        lastEventAgoMs: lastEvAge,
        chatCount: this.chatCount,
        eventsPerMinute: connected ? this.eventTimes.length : null,
        reconnectsLast10Min: recentReconnects,
        linkedGames: games,
        linkedCount: this.followers.size,
        tiktok: { lookups: tiktokStats().lookups, retries: tiktokStats().retries, lastError: tiktokStats().lastError }
      }
    };
  }

  _send(res) {
    try { res.write("data: " + JSON.stringify(this.getState()) + "\n\n"); } catch (_) { this.sseClients.delete(res); }
  }
  _broadcast() {
    this.version += 1;
    if (this._pending) return;
    this._pending = setTimeout(() => {
      this._pending = null;
      for (const res of [...this.sseClients]) this._send(res);
    }, 120 * SCALE);
    if (this._pending.unref) this._pending.unref();
  }
}

export const PlatformHub = new PlatformHubClass();
