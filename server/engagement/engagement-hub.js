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

class EngagementHub {
  constructor() {
    this.io = null;
    this.nsp = null;
    this.tracker = new EngagementTracker(
      (type, payload) => this._broadcastAlert(type, payload),
      () => this._broadcastDiagnostics()
    );
    this._attachedConnections = new WeakSet();
  }

  /** Call ONCE from server.js after the Socket.IO server is created. */
  init(io) {
    if (this.io) return; // idempotent — a stray double-call never re-wires twice
    this.io = io;
    this.nsp = io.of("/engagement");

    this.nsp.on("connection", (socket) => {
      socket.emit("engagement:state", this.tracker.getPublicState());

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
        fn(data);
      } catch (err) {
        this.tracker.logError(`attach.${label}`, err);
      }
    };

    connection.on(GIFT_EVENT, safely("gift", (data) => this.tracker.handleGift(data, meta)));
    connection.on(LIKE_EVENT, safely("like", (data) => this.tracker.handleLike(data, meta)));
    connection.on(SHARE_EVENT, safely("share", (data) => this.tracker.handleShare(data, meta)));
  }
}

export const Engagement = new EngagementHub();
