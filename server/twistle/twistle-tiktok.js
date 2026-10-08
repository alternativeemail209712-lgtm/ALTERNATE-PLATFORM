// ============================================================================
// TWISTLE's TikTok Live connection manager (same hardened design as CROSSDLE's).
//
// TikTok Live connection manager.
//
// Everything that can throw is wrapped in try/catch. Nothing in this file
// is allowed to crash the process - a bad or unexpected event should be
// logged to diagnostics and ignored, never take down the server.
//
// This file also guards against the SAME chat message being processed more
// than once, which has two separate possible causes and is fixed at both
// layers:
//   1. More than one live connection ending up active at the same time
//      (e.g. the host tapping "Connect" more than once, or a reconnect
//      racing a still-in-flight retry) - each connection independently
//      receives every chat message, so two connections means every
//      message is handled twice, three means three times, etc. Fixed with
//      a "generation" counter: starting a new connect attempt immediately
//      invalidates any previous one, and a superseded attempt tears itself
//      down the moment it notices, even mid-connect.
//   2. TikTok's own delivery occasionally redelivering the same message
//      (a known behavior of the underlying protocol on reconnect/retry).
//      Fixed with a short-term de-duplication cache keyed by the
//      message's own ID - never by username+text, since two different
//      people (or the same person, deliberately) typing the same word is
//      completely normal and must NOT be filtered out.
// ============================================================================

import { TikTokLiveConnection, WebcastEvent, ControlEvent } from 'tiktok-live-connector';
import { extractChatFields, extractMessageId } from './twistle-diagnostics.js';
import { Engagement } from '../engagement/engagement-hub.js';
import { resolveHostAvatar, adoptHostAvatar, isHostUser } from '../shared/host-avatar.js';

const MAX_CONNECT_ATTEMPTS = 3;
const BACKOFF_MS = [2000, 5000, 10000]; // short backoff between retries
const SEEN_ID_WINDOW_MS = 30000; // how long a message ID is remembered for dedup
const SEEN_ID_MAX = 2000; // hard cap so this can never grow unbounded

export class TikTokManager {
  /**
   * @param {object} opts
   * @param {import('./twistle-diagnostics.js').Diagnostics} opts.diagnostics
   * @param {(username:string, text:string, source:string) => void} opts.onComment
   * @param {(status:object) => void} opts.onStatus
   */
  constructor({ diagnostics, onComment, onStatus, signApiKey, onHostAvatar }) {
    this.diagnostics = diagnostics;
    this.onComment = onComment;
    this.onStatus = onStatus || (() => {});
    this.signApiKey = signApiKey || null;
    // Profile picture of the HOST of the current LIVE session (the connected
    // account). Shown on the automatic starter-word row. Null when not connected.
    this.hostAvatarUrl = null;
    this.onHostAvatar = onHostAvatar || (() => {});
    this.connection = null;
    this.desiredUsername = null;
    this.manuallyDisconnected = false;
    this._reconnecting = false;
    this._generation = 0; // bumped on every connect() call; invalidates older attempts
    this._seenMsgIds = new Map(); // msgId -> firstSeenAt, for de-duplication
  }

  _setHostAvatar(url) {
    const next = url || null;
    if (next === this.hostAvatarUrl) return;
    this.hostAvatarUrl = next;
    try { this.onHostAvatar(next); } catch (err) { this.diagnostics.logError('tiktok.hostAvatar', err); }
  }

  get isConnected() {
    return !!this.connection && this.connection.isConnected;
  }

  /**
   * Public entry point: (re)connect to a given TikTok @username. Safe to
   * call repeatedly (e.g. an impatient double-tap on "Connect") - any
   * previous connection or in-flight retry loop is invalidated and torn
   * down, so exactly one connection is ever active.
   */
  async connect(username) {
    this._generation += 1;
    const myGeneration = this._generation;
    this.manuallyDisconnected = false;
    this.desiredUsername = normalizeUsername(username);
    this._setHostAvatar(null); // a new connect may be a different host

    if (this.connection) {
      try { this.connection.disconnect(); } catch (_) { /* ignore */ }
      this.connection = null;
    }

    await this._connectWithRetry(this.desiredUsername, myGeneration);
  }

  disconnect() {
    this._generation += 1; // invalidate anything still in flight
    this.manuallyDisconnected = true;
    try {
      if (this.connection) this.connection.disconnect();
    } catch (err) {
      this.diagnostics.logError('tiktok.disconnect', err);
    }
    this.connection = null;
    this._setHostAvatar(null);
    this._setStatus('idle', 'Disconnected.');
  }

  _setStatus(state, message, attempt = 0) {
    this.diagnostics.setConnectionState(state, message, attempt, this.desiredUsername);
    this.onStatus(this.diagnostics.connection);
  }

  /** True if a newer connect()/disconnect() call has superseded this one. */
  _isStale(myGeneration) {
    return myGeneration !== this._generation;
  }

  async _connectWithRetry(username, myGeneration) {
    for (let attempt = 1; attempt <= MAX_CONNECT_ATTEMPTS; attempt++) {
      if (this.manuallyDisconnected || this._isStale(myGeneration)) return;
      this._setStatus('connecting', `Connecting to @${username} (attempt ${attempt}/${MAX_CONNECT_ATTEMPTS})...`, attempt);
      try {
        await this._attemptConnectOnce(username, myGeneration);
        if (this._isStale(myGeneration)) {
          // A newer connect()/disconnect() call arrived while this one was
          // in progress - this attempt lost the race, so shut it down
          // instead of leaving a second live connection running.
          try { this.connection && this.connection.disconnect(); } catch (_) { /* ignore */ }
          return;
        }
        this._setStatus('connected', `Connected to @${username}.`);
        return; // success
      } catch (err) {
        if (this._isStale(myGeneration)) return;
        this.diagnostics.logError('tiktok.connect', err);
        const isLastAttempt = attempt === MAX_CONNECT_ATTEMPTS;
        if (isLastAttempt) {
          this._setStatus('error', friendlyConnectError(err, username));
          return;
        }
        const wait = BACKOFF_MS[attempt - 1] || 8000;
        this._setStatus('connecting', `Attempt ${attempt} failed (${friendlyConnectError(err, username)}). Retrying in ${Math.round(wait / 1000)}s...`, attempt);
        await sleep(wait);
      }
    }
  }

  /** Returns true (and remembers the ID) only the FIRST time an ID is seen. */
  _isNewMessage(msgId) {
    if (!msgId) return true; // no ID available - can't dedupe, let it through
    const now = Date.now();
    if (this._seenMsgIds.has(msgId)) return false;

    this._seenMsgIds.set(msgId, now);
    if (this._seenMsgIds.size > SEEN_ID_MAX) {
      // Evict the oldest entries in insertion order (Map preserves it).
      const cutoff = now - SEEN_ID_WINDOW_MS;
      for (const [id, seenAt] of this._seenMsgIds) {
        if (seenAt < cutoff || this._seenMsgIds.size > SEEN_ID_MAX) {
          this._seenMsgIds.delete(id);
        } else {
          break;
        }
      }
    }
    return true;
  }

  async _attemptConnectOnce(username, myGeneration) {
    const options = {};
    if (this.signApiKey) options.signApiKey = this.signApiKey;

    const connection = new TikTokLiveConnection(username, options);
    this.connection = connection;

    // ---- Step 1: log the FULL raw shape of the first few events ----------
    connection.on(ControlEvent.DECODED_DATA, (eventName, decodedData) => {
      try {
        if (this.diagnostics.rawSamples.length < 6) {
          this.diagnostics.recordRawSample(String(eventName), decodedData);
        }
      } catch (err) {
        this.diagnostics.logError('tiktok.decodedData', err);
      }
    });

    // ---- Step 2 + 3: fallback-chain field extraction on every chat msg ----
    connection.on(WebcastEvent.CHAT, (data) => {
      try {
        if (this._isStale(myGeneration)) return; // a superseded connection's leftover events
        const msgId = extractMessageId(data);
        if (!this._isNewMessage(msgId)) return; // duplicate delivery of the same message
        const { username: user, text, avatarUrl } = extractChatFields(data);
        // Late fallback: the host's own chat message carries their profile picture.
        if (avatarUrl && !this.hostAvatarUrl && isHostUser(user, this.desiredUsername)) {
          // The server downloads the picture and serves its own copy (raw TikTok links are often .heic / expired / blocked).
          adoptHostAvatar(this.desiredUsername, avatarUrl).then((url) => {
            if (url && !this.hostAvatarUrl && !this._isStale(myGeneration)) this._setHostAvatar(url);
          });
        }
        this.onComment(user, text, 'tiktok', avatarUrl);
      } catch (err) {
        this.diagnostics.logError('tiktok.chatHandler', err);
      }
    });

    connection.on(ControlEvent.ERROR, (info) => {
      try {
        this.diagnostics.logError('tiktok.controlError', (info && info.exception) || info);
      } catch (_) { /* ignore */ }
    });

    connection.on(WebcastEvent.STREAM_END, () => {
      try {
        if (this._isStale(myGeneration)) return;
        this._setStatus('idle', 'The TikTok LIVE stream ended.');
      } catch (_) { /* ignore */ }
    });

    connection.on(ControlEvent.DISCONNECTED, () => {
      try {
        if (this.manuallyDisconnected || this._reconnecting || this._isStale(myGeneration)) return;
        this._reconnecting = true;
        this._setStatus('reconnecting', 'Connection dropped. Reconnecting...');
        this._connectWithRetry(this.desiredUsername, myGeneration).finally(() => {
          this._reconnecting = false;
        });
      } catch (err) {
        this.diagnostics.logError('tiktok.disconnectedHandler', err);
      }
    });

    const connectState = await connection.connect();
    Engagement.attach(connection, { game: 'twistle', tiktokUsername: username });

    // Look up the host's profile picture without holding up the connection.
    resolveHostAvatar(connection, connectState, username, () => this._isStale(myGeneration) || this.connection !== connection).then((url) => {
      if (url && !this._isStale(myGeneration) && this.connection === connection) this._setHostAvatar(url);
    });
  }
}

function normalizeUsername(username) {
  return String(username || '').trim().replace(/^@/, '');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function friendlyConnectError(err, username) {
  const msg = (err && err.message) || String(err);
  if (/offline|not.*live|UserOfflineError/i.test(msg)) {
    return `@${username} does not look like they're LIVE right now.`;
  }
  if (/not found|does not exist/i.test(msg)) {
    return `Couldn't find a TikTok account called @${username}.`;
  }
  if (/rate.?limit/i.test(msg)) {
    return 'Rate-limited by the signing service. Add a sign-in key (see setup) or wait a bit.';
  }
  if (/sign/i.test(msg)) {
    return 'The signing service rejected the connection. Double-check your sign API key.';
  }
  return msg || 'Unknown connection error.';
}
