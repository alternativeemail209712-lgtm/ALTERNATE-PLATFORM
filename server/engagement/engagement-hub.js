// ============================================================================
// ENGAGEMENT HUB — the one thing every game imports.
//
// Usage from server.js (once, at startup):
//   import { Engagement } from "./server/engagement/engagement-hub.js";
//   Engagement.init(io);
//
// Usage from inside any game's TikTok connection setup (one line, right
// after `await connection.connect()` succeeds):
//   import { Engagement } from "../engagement/engagement-hub.js"; // adjust
//                                                                  // relative
//                                                                  // path
//   Engagement.attach(connection, { game: "flagle", tiktokUsername: clean });
//
// That's it — Engagement adds its OWN independent gift/like/share
// listeners onto the connection (it never removes or interferes with a
// game's existing listeners), normalizes the payload, runs it through the
// shared tracker, and broadcasts alerts + diagnostics to every open game
// page on the platform via the "/engagement" Socket.IO namespace.
//
// Findle's server file is CommonJS (.cjs) rather than ESM. Node's dynamic
// `import()` works fine from CommonJS and resolves to the SAME cached
// module instance as everyone else's static `import`, so Findle reaches
// this exact singleton with:
//   const { Engagement } = await import("../engagement/engagement-hub.js");
// ============================================================================

import { EngagementTracker } from "./engagement-tracker.js";
import { HostPresence } from "../shared/host-presence.js";
import { Records } from "../shared/records-store.js";
import { PlatformHub } from "../shared/platform-hub.js";

// Games whose pages live on their own Socket.IO namespace (used only to label WHICH game is on screen in Records).
const NAMESPACE_GAMES = ["flagle", "travle", "findle", "crossdle", "twistle", "oracle", "colorblindle", "colordle", "structle", "textle", "rangedle", "codedle", "shapedle"];

// TikTok event names we listen for, with plain-string fallbacks in case a
// particular library version doesn't export a given WebcastEvent constant
// (mirrors the defensive pattern already used elsewhere in this project,
// e.g. Findle's own CHAT_EVENT_NAME fallback).
let WebcastEvent = {};
try {
  // Lazy require avoided on purpose (this file is ESM); if the package is
  // present this import resolves synchronously at module load time same
  // as any other named import.
  ({ WebcastEvent } = await import("tiktok-live-connector"));
} catch (_) {
  // If this ever fails to resolve, the string fallbacks below still work.
}

const GIFT_EVENT = WebcastEvent.GIFT || "gift";
const LIKE_EVENT = WebcastEvent.LIKE || "like";
const SHARE_EVENT = WebcastEvent.SHARE || "share";
const FOLLOW_EVENT = WebcastEvent.FOLLOW || "follow";
const SUBSCRIBE_EVENT = WebcastEvent.SUBSCRIBE || "subscribe";

class EngagementHub {
  constructor() {
    this.io = null;
    this.nsp = null;
    this.tracker = new EngagementTracker(
      (type, payload) => this._broadcastAlert(type, payload),
      () => this._broadcastDiagnostics()
    );
    this._attachedConnections = new WeakSet();
    // (update 43) With the shared HOME connection every linked game receives the SAME TikTok message (the very same
    // object). Each game used to add its own counter, so one like was counted once PER GAME. A message object is now
    // counted exactly once, no matter how many games or connections hand it over.
    this._countedPayloads = new WeakSet();
    this.tracker.liveSource = () => PlatformHub.mode !== "live" || PlatformHub.status === "connected";
  }

  /** The game whose page is open right now (for the Records "game" column). One shared feed has no single game. */
  _openGame(connection, meta) {
    try {
      if (!this.io || typeof connection.__pfDetach !== "function") return meta.game || null;
      const open = NAMESPACE_GAMES.filter((g) => {
        const ns = this.io._nsps && this.io._nsps.get("/" + g);
        return ns && ns.sockets && ns.sockets.size > 0;
      });
      if (open.length === 1) return open[0];
      if (open.length > 1) return open.includes(meta.game) ? meta.game : open[0];
    } catch (_) { /* label only */ }
    return meta.game || null;
  }

  /** Counting API: what is being counted, and a button to start a fresh count. */
  mountApi(app, express) {
    app.get("/api/engagement/counters", (req, res) => {
      res.set("Cache-Control", "no-store");
      const st = this.tracker.getPublicState();
      res.json({ counters: st.counters, counting: st.counting });
    });
    app.post("/api/engagement/reset", express.json({ limit: "1kb" }), (req, res) => {
      if (!Records.keyOk(req)) return res.status(401).json({ error: "edit-key-required" });
      this.tracker.resetCounting();
      const st = this.tracker.getPublicState();
      res.json({ ok: true, counters: st.counters, counting: st.counting });
    });
  }

  /** Call ONCE from server.js after the Socket.IO server is created. */
  init(io) {
    if (this.io) return; // idempotent — a stray double-call never re-wires twice
    this.io = io;
    this.nsp = io.of("/engagement");

    this.nsp.on("connection", (socket) => {
      socket.emit("engagement:state", this.tracker.getPublicState());
      socket.emit("engagement:settings", { display: Records.alerts.display });

      // Host-only test panel. There's no account system on this platform
      // (see shared/session.js) — same trust model as every other host
      // control already exposed directly in each game's UI.
      socket.on("engagement:test", (payload) => {
        try {
          const kind = payload && payload.kind;
          if (["gift", "share", "milestone", "room"].includes(kind)) {
            this.tracker.triggerTest(kind);
          }
        } catch (err) {
          this.tracker.logError("test-trigger", err);
        }
      });
    });

    Records.onSettings((cfg) => { try { this.nsp.emit("engagement:settings", { display: cfg.display }); } catch (_) { /* ignore */ } });
    console.log("[engagement] hub ready on namespace /engagement");
  }

  _broadcastAlert(type, payload) {
    if (!this.nsp) return;
    this.nsp.emit("engagement:alert", { type, ...payload });
  }

  _broadcastDiagnostics() {
    if (!this.nsp) return;
    this.nsp.emit("engagement:state", this.tracker.getPublicState());
  }

  /**
   * Wires gift/like/share listeners onto an already-created (or about to
   * connect) TikTokLiveConnection instance. Safe to call multiple times on
   * the same connection object — it will only attach once.
   *
   * @param {object} connection - a TikTokLiveConnection instance
   * @param {{ game: string, tiktokUsername?: string }} meta
   */
  attach(connection, meta = {}) {
    if (!connection || typeof connection.on !== "function") return;
    if (this._attachedConnections.has(connection)) return;
    this._attachedConnections.add(connection);

    // (update 30) Every game calls attach() right after its TikTok connection succeeds, so this is the one
    // place that tells the HOME page which host is live (name + profile picture for the top-left banner).
    try {
      HostPresence.register(connection, meta);
    } catch (err) {
      this.tracker.logError("attach.host-presence", err);
    }

    const safely = (label, fn) => (data) => {
      try {
        if (data && typeof data === "object") {
          if (this._countedPayloads.has(data)) return; // this exact TikTok message was already counted via another game
          this._countedPayloads.add(data);
        }
        const roomId = connection.roomId ? String(connection.roomId) : "";
        this.tracker.startSession(roomId); // a NEW live room starts a fresh count
        fn(data, { ...meta, game: this._openGame(connection, meta), roomId });
      } catch (err) {
        this.tracker.logError(`attach.${label}`, err);
      }
    };

    connection.on(GIFT_EVENT, safely("gift", (data, m) => this.tracker.handleGift(data, m)));
    connection.on(LIKE_EVENT, safely("like", (data, m) => this.tracker.handleLike(data, m)));
    connection.on(SHARE_EVENT, safely("share", (data, m) => this.tracker.handleShare(data, m)));
    // (update 40) follows + subscriptions go to the records archive
    connection.on(FOLLOW_EVENT, safely("follow", (data, m) => this.tracker.handleSimple("follow", data, m)));
    connection.on(SUBSCRIBE_EVENT, safely("subscribe", (data, m) => this.tracker.handleSimple("subscribe", data, m)));
  }
}

export const Engagement = new EngagementHub();
