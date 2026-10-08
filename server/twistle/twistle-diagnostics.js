// ============================================================================
// TWISTLE copy of the platform's Diagnostics (same as CROSSDLE's, kept per-game
// so each game stays independent).
//
// Diagnostics: a small in-memory "black box recorder" for what is actually
// arriving over the wire, plus the field-extraction fallback chain.
//
// WHY THIS EXISTS: tiktok-live-connector is a reverse-engineered library.
// Its documented field names (data.user.uniqueId, data.comment, etc.) are
// usually right, but TikTok can change its internal payload shape at any
// time, and different versions of the library normalize things differently.
// Rather than trust one hardcoded field name and silently receive nothing,
// this module:
//   1. Records the FULL raw shape of the first few events (visible in the
//      on-screen diagnostics panel, not just server logs).
//   2. Extracts username/text via a long fallback chain of every plausible
//      field name, so the game keeps working even if the "official" field
//      goes missing or gets renamed.
// ============================================================================

const MAX_RAW_SAMPLES = 6;
const MAX_ERROR_LOG = 25;

export class Diagnostics {
  constructor() {
    this.eventsReceived = 0;
    this.recognizedCount = 0;
    this.lastReceived = null; // { username, text, ts, source }
    this.rawSamples = []; // first few raw payloads, safely stringified
    this.errors = []; // recent caught errors, safely stringified
    this.connection = { state: 'idle', message: '', attempt: 0, username: null };
  }

  recordRawSample(eventName, payload) {
    if (this.rawSamples.length >= MAX_RAW_SAMPLES) return;
    let text;
    try {
      text = JSON.stringify(payload, safeReplacer(), 2);
    } catch (e) {
      text = `[unstringifiable payload: ${e.message}]`;
    }
    if (text && text.length > 4000) text = text.slice(0, 4000) + '\n...[truncated]';
    this.rawSamples.push({ eventName, text, ts: Date.now() });
    // Also dump the FULL, untruncated shape to the server console/log as
    // required - this is the "before writing any parsing logic" step.
    console.log(`\n===== RAW ${eventName} EVENT #${this.rawSamples.length} =====`);
    console.log(text);
    console.log('===== END RAW EVENT =====\n');
  }

  recordIncoming({ username, text, source }) {
    this.eventsReceived += 1;
    this.lastReceived = { username, text, ts: Date.now(), source };
  }

  recordRecognized() {
    this.recognizedCount += 1;
  }

  logError(context, err) {
    const entry = {
      context,
      message: err && err.message ? err.message : String(err),
      ts: Date.now(),
    };
    this.errors.unshift(entry);
    if (this.errors.length > MAX_ERROR_LOG) this.errors.length = MAX_ERROR_LOG;
    console.error(`[${context}]`, err && err.stack ? err.stack : err);
  }

  setConnectionState(state, message = '', attempt = 0, username = null) {
    this.connection = { state, message, attempt, username: username ?? this.connection.username };
  }

  clearRawSamples() {
    this.rawSamples = [];
  }

  getPublicState() {
    return {
      eventsReceived: this.eventsReceived,
      recognizedCount: this.recognizedCount,
      lastReceived: this.lastReceived,
      rawSamples: this.rawSamples,
      errors: this.errors.slice(0, 8),
      connection: this.connection,
    };
  }
}

/** Prevents JSON.stringify from throwing on circular structures. */
function safeReplacer() {
  const seen = new WeakSet();
  return (key, value) => {
    if (typeof value === 'bigint') return value.toString() + 'n';
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[circular]';
      seen.add(value);
    }
    return value;
  };
}

/**
 * Digs a value out of an object by trying a list of dot-paths in order and
 * returning the first one that resolves to a non-empty value.
 */
function firstNonEmpty(obj, paths) {
  for (const path of paths) {
    const val = path.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
    if (val !== undefined && val !== null && val !== '') return val;
  }
  return undefined;
}

// Every plausible shape we've seen (or might see) across tiktok-live-connector
// versions and TikTok's own drift. New candidates can be appended here without
// touching any other code - that's the whole point of the fallback chain.
const USERNAME_PATHS = [
  'user.uniqueId',
  'user.nickname',
  'user.username',
  'user.name',
  'user.displayId',
  'uniqueId',
  'nickname',
  'username',
  'authorName',
  'sender.uniqueId',
  'sender.nickname',
  'from.uniqueId',
  'data.user.uniqueId',
  'data.user.nickname',
];

const TEXT_PATHS = [
  'comment',
  'text',
  'content',
  'message',
  'msg',
  'body',
  'data.comment',
  'data.text',
  'chatMessage.comment',
];

const AVATAR_PATHS = [
  'user.profilePictureUrl',
  'user.avatarThumb.urlList.0',
  'user.avatarMedium.urlList.0',
  'user.avatarLarger.urlList.0',
  'user.avatarUrl',
  'profilePictureUrl',
  'avatarUrl',
  'avatarThumb.urlList.0',
];

// A unique-per-message ID, used to detect the SAME message being delivered
// more than once (see the de-duplication note in tiktok.js). Different
// people typing the same word is normal and must NOT be treated as a
// duplicate - only an identical message ID means "this is literally the
// same event arriving again".
const MSG_ID_PATHS = [
  'msgId',
  'messageId',
  'msgID',
  'id',
  'common.msgId',
  'data.msgId',
  'data.common.msgId',
  'chatMessage.common.msgId',
];

/**
 * Extracts a stable message ID from a raw TikTok event, if one is present.
 * Returns null (never throws) when no plausible ID field exists.
 */
export function extractMessageId(raw) {
  try {
    const id = firstNonEmpty(raw, MSG_ID_PATHS);
    return id != null ? String(id) : null;
  } catch (e) {
    return null;
  }
}

/**
 * Extracts { username, text, avatarUrl } from a raw TikTok event using the
 * fallback chain above. Never throws - worst case it returns 'unknown' / ''
 * / null.
 */
export function extractChatFields(raw) {
  try {
    const username = firstNonEmpty(raw, USERNAME_PATHS);
    const text = firstNonEmpty(raw, TEXT_PATHS);
    const avatarUrl = firstNonEmpty(raw, AVATAR_PATHS);
    return {
      username: username != null ? String(username) : 'unknown',
      text: text != null ? String(text) : '',
      avatarUrl: avatarUrl != null ? String(avatarUrl) : null,
    };
  } catch (e) {
    return { username: 'unknown', text: '', avatarUrl: null };
  }
}
