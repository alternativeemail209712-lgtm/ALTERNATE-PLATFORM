// ============================================================================
// ENGAGEMENT TRACKER — platform-wide Gift / Like / Share tracking.
//
// This module is completely game-agnostic: it doesn't know or care which
// of the five games is currently live. Any game's TikTok connection can be
// handed to Engagement.attach() (see engagement-hub.js) and its gift/like/
// share events flow through the exact same logic here, so every game gets
// identical alert behavior and one shared set of session counters.
//
// Responsibilities:
//   1. Raw logging FIRST — every gift/like/share payload is recorded (short,
//      truncated) before any field extraction is attempted, exactly like
//      the existing CROSSDLE diagnostics panel does for chat.
//   2. Fallback-chain field extraction — TikTok's payload shape drifts by
//      library version, so every field is pulled via a list of plausible
//      paths, never a single hardcoded one.
//   3. Gift combo buffering — a "streakable" gift (roses, etc.) fires many
//      raw events while a viewer holds it down. We buffer by
//      user+gift, wait for the official repeatEnd flag, and ALSO run a
//      short inactivity timer as a safety net in case repeatEnd never
//      arrives (a known quirk of the reverse-engineered protocol) — so a
//      combo never gets stuck un-fired.
//   4. Milestone detection — individual (per-user, this session) and room
//      (whole-session total) milestones for Likes and Shares. Because
//      likes/shares arrive in arbitrary-sized batches, "hits an exact
//      milestone" is implemented as CROSSING a threshold (previous total
//      below it, new total at/above it) rather than requiring a literal
//      equality match, which would almost never occur in practice.
//   5. A safe "baseline" step — the very first Like/Share update we ever
//      see for a user or for the room only sets the starting point; it
//      never fires milestones retroactively. Without this, connecting to
//      an account that already has (for example) 80,000 room likes from
//      earlier in the same broadcast would instantly fire eight fake
//      "just crossed 10k!" alerts the moment the host connects.
// ============================================================================

import { LADDERS, isMajor, stageInfo } from "./milestone-stages.js";
import { Records, ALERT_KINDS } from "../shared/records-store.js";

const MAX_RAW_SAMPLES = 8;
const MAX_ERROR_LOG = 25;

// (update 40) Every milestone ladder now lives in milestone-stages.js (many more stages than before, plus ladders for
// shares and gift coins). Records (server/shared/records-store.js) save EVERY stage that is crossed.
const INDIVIDUAL_LIKE_MILESTONES = LADDERS.like;
const ROOM_LIKE_MILESTONES = LADDERS.roomLike;
const ROOM_SHARE_MILESTONES = LADDERS.roomShare;

// A gift's total coin value (single gift, or a whole finished combo) at
// or above this is treated as a "big gift" -> confetti-tier alert instead
// of the small pop used for an ordinary gift.
const BIG_GIFT_COIN_THRESHOLD = 500; // default only; the host can change it (Records > Alerts)
const MAX_LIKE_BATCH = 1000;

// How long to wait, with no further update to a streakable combo, before
// we assume it's over even though repeatEnd never arrived.
const COMBO_INACTIVITY_MS = 1500;

// ---- appreciation wishes -------------------------------------------------
// Every alert pairs its headline with a short, warm thank-you line so the
// card reads as a genuine acknowledgement, not just a stat pop-up. Picked
// at random (never the same one twice in a row) to keep a long stream from
// feeling like a repeating template.
function pickWish(list, exclude) {
  if (list.length === 1) return list[0];
  let choice;
  do {
    choice = list[Math.floor(Math.random() * list.length)];
  } while (choice === exclude && list.length > 1);
  return choice;
}

const GIFT_WISHES = [
  "Thank you so much for the support!",
  "Your generosity means the world to us!",
  "We really appreciate you!",
  "Sending love right back at you!",
  "You're keeping this stream going — thank you!",
];
const BIG_GIFT_WISHES = [
  "Absolutely incredible — thank you!",
  "We are beyond grateful for this!",
  "You just made our whole day!",
  "That's a showstopper — thank you!",
];
const SHARE_WISHES = [
  "Thanks for helping the stream grow!",
  "Every share helps so much — appreciate you!",
  "You're the best kind of viewer!",
  "That means a lot — thank you!",
];
const MILESTONE_WISHES = [
  "What a legend — thank you for being here!",
  "You're on an absolute roll!",
  "Incredible energy — thank you!",
  "Loving the support today!",
];
const BIG_MILESTONE_WISHES = [
  "Certified superfan — thank you!",
  "That's a huge achievement — well done!",
  "Absolutely unstoppable!",
];
const FOLLOW_WISHES = [
  "Welcome to the family!",
  "So glad you are here!",
  "Thanks for following - you rock!",
];
const ROOM_WISHES = [
  "Thank you all for the amazing energy!",
  "This whole room is incredible right now!",
  "Let's keep this energy going — thank you everyone!",
  "What a community — thank you all!",
];

// ---- gift -> visual theme -------------------------------------------------
// TikTok's own gift artwork is copyrighted, so instead of reproducing it we
// map a gift's NAME to an original, purely-CSS "glossy badge" theme (an
// icon + a two-tone gradient) that echoes the *feel* of the real gift
// (Rose -> soft red/pink, Galaxy -> starry purple, Lion -> gold, etc.)
// without copying any TikTok artwork. Matched by keyword, case-insensitive,
// first match wins; anything unmatched gets a generic gift-box theme.
const GIFT_THEMES = [
  { test: /rose/i, icon: "🌹", from: "#ff8fb1", to: "#c81d5b" },
  { test: /(galaxy|universe|planet)/i, icon: "🌌", from: "#8b5cf6", to: "#1e1b4b" },
  { test: /lion/i, icon: "🦁", from: "#ffd76a", to: "#b8720a" },
  { test: /(diamond|gem|ring)/i, icon: "💎", from: "#8fe3ff", to: "#0e7fa8" },
  { test: /heart/i, icon: "💖", from: "#ff9ecb", to: "#d6336c" },
  { test: /crown/i, icon: "👑", from: "#ffe27a", to: "#c98a0c" },
  { test: /(rocket|spaceship)/i, icon: "🚀", from: "#9fd8ff", to: "#1d4ed8" },
  { test: /(sports ?car|drift ?car|car)/i, icon: "🏎️", from: "#ff9a6a", to: "#b3260a" },
  { test: /(ice ?cream)/i, icon: "🍦", from: "#ffe1f0", to: "#f472b6" },
  { test: /(finger ?heart)/i, icon: "🫰", from: "#ffb3c6", to: "#e0245e" },
  { test: /(perfume)/i, icon: "🧴", from: "#e0c3fc", to: "#8e2de2" },
  { test: /(tiktok|banner)/i, icon: "✨", from: "#7cf5d0", to: "#0aa38a" },
  { test: /corn/i, icon: "🌽", from: "#ffe36e", to: "#c9970c" },
];
function pickGiftTheme(giftName) {
  const match = GIFT_THEMES.find((t) => t.test.test(giftName || ""));
  return match || { icon: "🎁", from: "#ffd76a", to: "#e0245e" };
}

function firstNonEmpty(obj, paths) {
  for (const path of paths) {
    const val = path.split(".").reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
    if (val !== undefined && val !== null && val !== "") return val;
  }
  return undefined;
}

function safeReplacer() {
  const seen = new WeakSet();
  return (key, value) => {
    if (typeof value === "bigint") return value.toString() + "n";
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) return "[circular]";
      seen.add(value);
    }
    return value;
  };
}

function stringifySample(payload) {
  let text;
  try {
    text = JSON.stringify(payload, safeReplacer(), 2);
  } catch (e) {
    text = `[unstringifiable payload: ${e.message}]`;
  }
  if (text && text.length > 3000) text = text.slice(0, 3000) + "\n...[truncated]";
  return text;
}

// ---- fallback-chain field paths (every plausible name we've seen) --------

const USERNAME_PATHS = [
  "user.uniqueId", "user.nickname", "user.username", "user.name", "user.displayId",
  "uniqueId", "nickname", "username", "authorName", "sender.uniqueId", "sender.nickname",
];

const AVATAR_PATHS = [
  "user.profilePictureUrl",
  "user.avatarThumb.urlList.0",
  "user.avatarMedium.urlList.0",
  "user.avatarLarger.urlList.0",
  "user.avatarUrl",
  "profilePictureUrl",
  "avatarUrl",
  "avatarThumb.urlList.0",
];

const GIFT_NAME_PATHS = [
  "giftDetails.giftName", "gift.name", "gift.giftName", "giftName", "describe",
];
const GIFT_ID_PATHS = ["giftDetails.giftId", "gift.id", "gift.giftId", "giftId", "gift_id"];
const GIFT_TYPE_PATHS = ["giftDetails.giftType", "gift.type", "giftType", "gift_type"];
// TikTok's payload still names the gift's coin price "diamondCount" internally,
// so those raw field names must stay exactly as-is; everything we store and
// show viewers calls it coins.
const COIN_PATHS = [
  "giftDetails.diamondCount", "gift.diamondCount", "diamondCount", "diamond_count", "gift.diamond_count",
];
const REPEAT_COUNT_PATHS = ["repeatCount", "repeat_count", "combo.repeatCount"];
const REPEAT_END_PATHS = ["repeatEnd", "repeat_end"];
const GROUP_ID_PATHS = ["groupId", "group_id", "logId", "log_id"];
const MSG_ID_PATHS = ["common.msgId", "msgId", "common.msg_id", "msg_id"];

const NICK_PATHS = ["user.nickname", "nickname", "user.displayName", "sender.nickname"];
const LIKE_COUNT_PATHS = ["likeCount", "count", "like_count"];
const TOTAL_LIKE_PATHS = ["totalLikeCount", "total", "total_like_count"];

function tierLabel(n) {
  const trim = (x) => String(Math.round(x * 100) / 100);
  if (n >= 1000000) return trim(n / 1000000) + "m";
  if (n >= 1000) return trim(n / 1000) + "k";
  return String(n);
}

export class EngagementTracker {
  /**
   * @param {(type: string, payload: object) => void} onAlert - called once
   *   per fully-formed alert, ready to display (queueing happens client-side).
   * @param {() => void} onDiagnosticsChange - called whenever counters/raw
   *   samples/errors change, so the caller can re-broadcast public state.
   */
  constructor(onAlert, onDiagnosticsChange) {
    this.onAlert = onAlert || (() => {});
    this.onDiagnosticsChange = onDiagnosticsChange || (() => {});

    this.rawSamples = []; // { kind, text, ts }
    this.errors = []; // { context, message, ts }
    this.lastEvents = { gift: null, like: null, share: null };
    this.sessionKey = "";
    this.liveSource = null; // () => true when the platform's shared connection is LIVE (set by the hub)
    this._recentShown = []; // timestamps of alerts shown on screen (auto-throttle)
    this._viewerShown = new Map(); // username -> last time an alert for them was shown (cooldown)
    this._initCounting();
  }

  // ------------------------------------------------- counting session (update 43) --
  // ONE counting session = one TikTok LIVE room. Everything the tracker counts (totals, per-viewer likes / shares / coins,
  // the milestone ladders already passed) starts again from zero when a NEW live room is connected, so a new stream never
  // inherits the previous stream's numbers. Reconnecting to the same room keeps counting.
  _initCounting() {
    this.counters = { totalGifts: 0, totalLikes: 0, totalShares: 0, totalCoins: 0 };
    this.sessionStartedAt = Date.now();
    this.dup = { blocked: 0, comboRepeats: 0 };
    this._seenIds = new Map(); // kind|messageId -> true (bounded): one TikTok message is counted once, ever
    this._comboDone = new Map(); // gift combo key -> how many repeats were already counted

    this._roomLikeTotal = 0;
    this._roomLikeBaselineSet = false;
    this._roomLikeMilestonesHit = new Set();
    this.tiktokRoomLikes = null; // the room total TikTok itself reports (the number the TikTok app shows)

    this._roomShareTotal = 0;
    this._roomShareMilestonesHit = new Set();

    this._perUserLikes = new Map(); // username -> { total, baselineSet, hit:Set }
    this._perUserShares = new Map(); // username -> count (session)

    this._perUserCoins = new Map(); // username -> { total, hit:Set }
    this._roomCoinTotal = 0;
    this._roomCoinMilestonesHit = new Set();

    this._pendingAlerts = new Map(); // ladder|user -> highest milestone alert of the current event
    if (this._comboBuffers) for (const b of this._comboBuffers.values()) clearTimeout(b.timer);
    this._comboBuffers = new Map(); // key -> { data, timer }
  }

  /** A different room key (new LIVE) starts a fresh count. Same key (reconnect) changes nothing. */
  startSession(key) {
    key = key ? String(key) : "";
    if (!key || key === this.sessionKey) return false;
    const first = !this.sessionKey;
    this.sessionKey = key;
    if (!first) {
      this._initCounting();
      console.log("[engagement] new LIVE room " + key + " - counters restarted from zero");
    } else {
      this.sessionStartedAt = Date.now();
    }
    this.onDiagnosticsChange();
    return true;
  }

  /** Host pressed "Start a fresh count" (or a new stream is about to begin). */
  resetCounting() {
    this._initCounting();
    this.onDiagnosticsChange();
  }

  /** True the FIRST time a TikTok message id is seen. Messages without an id cannot be checked (counted as new). */
  _isNew(kind, raw) {
    const id = firstNonEmpty(raw, MSG_ID_PATHS);
    if (id === undefined) return true;
    const k = kind + "|" + String(id);
    if (this._seenIds.has(k)) { this.dup.blocked += 1; return false; }
    this._seenIds.set(k, true);
    if (this._seenIds.size > 8000) {
      let n = 0;
      for (const key of this._seenIds.keys()) { this._seenIds.delete(key); if (++n >= 2000) break; }
    }
    return true;
  }

  // -------------------------------------------------------------- utils --

  _recordRawSample(kind, payload) {
    if (this.rawSamples.length >= MAX_RAW_SAMPLES) this.rawSamples.shift();
    const text = stringifySample(payload);
    this.rawSamples.push({ kind, text, ts: Date.now() });
    console.log(`\n===== RAW ENGAGEMENT ${kind.toUpperCase()} EVENT =====`);
    console.log(text);
    console.log("===== END RAW EVENT =====\n");
    this.onDiagnosticsChange();
  }

  logError(context, err) {
    const entry = { context, message: (err && err.message) || String(err), ts: Date.now() };
    this.errors.unshift(entry);
    if (this.errors.length > MAX_ERROR_LOG) this.errors.length = MAX_ERROR_LOG;
    console.error(`[engagement:${context}]`, (err && err.stack) || err);
    this.onDiagnosticsChange();
  }

  _extractUser(raw) {
    const username = firstNonEmpty(raw, USERNAME_PATHS);
    const avatar = firstNonEmpty(raw, AVATAR_PATHS);
    const nick = firstNonEmpty(raw, NICK_PATHS);
    return {
      username: username != null ? String(username) : "viewer",
      avatarUrl: avatar != null ? String(avatar) : null,
      nickname: nick != null ? String(nick) : "",
    };
  }

  // (update 40) Every alert is ALSO saved to the records archive (all stages), but is only SHOWN on screen when it
  // passes the host's alert mode: "all" (default) = every stage, "major" = only the stages that existed before update 40.
  _fireAlert(type, payload, tier, ladder, meta = {}) {
    const full = { ...payload, tier, ts: Date.now(), host: meta.tiktokUsername || "" };
    try { Records.addAlert(type, full); } catch (err) { this.logError("records.addAlert", err); }
    const cfg = Records.alerts;
    if (ladder && meta.game !== "test" && cfg.alertMode === "major" && !isMajor(ladder, payload.milestone)) return;
    if (ladder) {
      // One event can jump over several stages (a big like batch, a big gift). All of them are saved to the records,
      // but only the HIGHEST one is shown on screen (see _flushAlerts), so the stream never gets a burst of alerts.
      this._pendingAlerts.set(ladder + "|" + (payload.username || "room"), { type, full });
      return;
    }
    this._deliver(type, full);
  }

  /** (update 43) The host's alert rules. Everything is ALWAYS saved to Records; these rules only decide what pops up on screen. */
  _deliver(type, full) {
    const cfg = Records.alerts;
    const isTest = full.game === "test";
    if (!isTest) {
      if (cfg.kinds[type] === false) return; // this kind of alert is switched off
      if (type === "gift" && (Number(full.totalCoinValue) || 0) < cfg.minGiftCoins) return; // too small to announce
      if (cfg.onlyWhenLive && this.liveSource && !this.liveSource()) return; // auto: only while the platform is LIVE
      const now = Date.now();
      const high = full.tier === "confetti" || full.big === true || String(type).startsWith("room_");
      if (cfg.viewerCooldownSec > 0 && full.username && !high) {
        const last = this._viewerShown.get(full.username) || 0;
        if (now - last < cfg.viewerCooldownSec * 1000) return; // same viewer alerted too recently
      }
      this._recentShown = this._recentShown.filter((t) => now - t < 60000);
      if (cfg.autoThrottle.on && !high && this._recentShown.length >= cfg.autoThrottle.maxPerMinute) return; // busy: only big ones get through
      this._recentShown.push(now);
      if (full.username) {
        this._viewerShown.set(full.username, now);
        if (this._viewerShown.size > 3000) { const k = this._viewerShown.keys().next().value; this._viewerShown.delete(k); }
      }
    }
    this.onAlert(type, full);
  }

  _flushAlerts() {
    if (!this._pendingAlerts.size) return;
    const list = [...this._pendingAlerts.values()];
    this._pendingAlerts.clear();
    for (const a of list) this._deliver(a.type, a.full);
  }

  /** Shared look + wording for every milestone alert, with its stage number and tier (Bronze ... Mythic). */
  _milestoneLook(ladder, m, unit) {
    const scopeNote = ladder.startsWith("room") ? (ladder === "roomLike" && this.tiktokRoomLikes != null ? "TikTok total" : "counted live") : "since connect";
    const info = stageInfo(ladder, m);
    return {
      stage: info.stage, stages: info.stages, tierName: info.tier, metric: unit,
      icon: info.icon, gradientFrom: info.from, gradientTo: info.to,
      stat: `${info.tier} · stage ${info.stage}/${info.stages} · ${tierLabel(m)} ${unit}` + (scopeNote ? " · " + scopeNote : ""),
    };
  }

  // -------------------------------------------------------------- gifts --

  /**
   * Handles one raw GIFT event. Streakable gifts (a "combo", e.g. holding
   * down a rose) get buffered here until the combo actually finishes —
   * either the library tells us via repeatEnd, or (safety net) the combo
   * simply goes quiet for COMBO_INACTIVITY_MS.
   */
  handleGift(raw, meta = {}) {
    try {
      if (meta.game !== "test" && !this._isNew("gift", raw)) return; // the same TikTok message is never counted twice
      this._recordRawSample("gift", raw);
      const { username, avatarUrl, nickname } = this._extractUser(raw);
      const giftName = String(firstNonEmpty(raw, GIFT_NAME_PATHS) || "a gift");
      const giftId = firstNonEmpty(raw, GIFT_ID_PATHS);
      const giftType = firstNonEmpty(raw, GIFT_TYPE_PATHS);
      const isStreakable = Number(giftType) === 1; // TikTok convention: giftType 1 == streakable/combo-able
      const coinCount = Number(firstNonEmpty(raw, COIN_PATHS)) || 0;
      const repeatCount = Number(firstNonEmpty(raw, REPEAT_COUNT_PATHS)) || 1;
      const repeatEndRaw = firstNonEmpty(raw, REPEAT_END_PATHS);
      const repeatEnd = typeof repeatEndRaw === "boolean" ? repeatEndRaw : true; // non-streakable gifts are always "done"
      const groupId = firstNonEmpty(raw, GROUP_ID_PATHS);

      this.lastEvents.gift = { username, giftName, repeatCount, ts: Date.now() };

      // A streak that pauses for >1.5 s is finished early by the safety timer and can then continue under the SAME group
      // id with a higher cumulative repeat count. Count only the NEW repeats each time, never the whole streak again.
      const finalize = (data, comboKey) => {
        let first = true;
        if (comboKey) {
          const prior = this._comboDone.get(comboKey) || 0;
          first = prior === 0;
          const fresh = data.repeatCount - prior;
          if (fresh <= 0) { this.dup.comboRepeats += 1; return; }
          this._comboDone.set(comboKey, data.repeatCount);
          if (this._comboDone.size > 3000) { const k = this._comboDone.keys().next().value; this._comboDone.delete(k); }
          data = { ...data, repeatCount: fresh, totalCoinValue: data.coinCount * fresh };
        }
        if (first) this.counters.totalGifts += 1;
        this.counters.totalCoins += data.totalCoinValue;
        const big = data.totalCoinValue >= Math.max(1, Records.alerts.bigGiftCoins);
        const theme = pickGiftTheme(data.giftName);
        this._fireAlert(
          "gift",
          {
            game: meta.game || null,
            username: data.username,
            avatarUrl: data.avatarUrl,
            giftName: data.giftName,
            repeatCount: data.repeatCount,
            coinValue: data.coinCount,
            totalCoinValue: data.totalCoinValue,
            big,
            icon: theme.icon,
            gradientFrom: theme.from,
            gradientTo: theme.to,
            message:
              data.repeatCount > 1
                ? `@${data.username} sent ${data.repeatCount}x ${data.giftName}!`
                : `@${data.username} sent ${/^[aeiou]/i.test(data.giftName) ? "an" : "a"} ${data.giftName}!`,
            appreciation: pickWish(big ? BIG_GIFT_WISHES : GIFT_WISHES),
            stat: data.totalCoinValue > 0 ? `${data.totalCoinValue.toLocaleString()} ${data.totalCoinValue === 1 ? "coin" : "coins"}` : null,
            nickname: data.nickname,
          },
          big ? "confetti" : "pop",
          null,
          meta
        );
        this._giftMilestones(data, meta);
        this._flushAlerts();
        this.onDiagnosticsChange();
      };

      if (!isStreakable) {
        // Single, non-combo gift — finalize immediately, nothing to buffer.
        finalize({ username, avatarUrl, nickname, giftName, repeatCount, coinCount, totalCoinValue: coinCount * repeatCount }, null);
        return;
      }

      // Streakable — buffer until the combo is actually finished.
      const key = `${username}|${giftId != null ? giftId : giftName}|${groupId != null ? groupId : ""}`;
      const existing = this._comboBuffers.get(key);
      if (existing) clearTimeout(existing.timer);

      const data = { username, avatarUrl, nickname, giftName, repeatCount, coinCount, totalCoinValue: coinCount * repeatCount };

      const comboKey = (meta.game === "test" ? "t|" : "") + key;
      if (repeatEnd) {
        this._comboBuffers.delete(key);
        finalize(data, comboKey);
        return;
      }

      const timer = setTimeout(() => {
        this._comboBuffers.delete(key);
        try { finalize(data, comboKey); } catch (err) { this.logError("gift-combo-timer", err); }
      }, COMBO_INACTIVITY_MS);

      this._comboBuffers.set(key, { data, timer });
    } catch (err) {
      this.logError("handleGift", err);
    }
  }

  /** (update 40) Coins climb two ladders: this viewer's coins and the whole room's coins. */
  _giftMilestones(data, meta) {
    const coins = data.totalCoinValue || 0;
    if (coins <= 0) return;
    const u = this._perUserCoins.get(data.username) || { total: 0, hit: new Set() };
    this._perUserCoins.set(data.username, u);
    const prev = u.total;
    u.total += coins;
    for (const m of LADDERS.gift) {
      if (prev < m && u.total >= m && !u.hit.has(m)) {
        u.hit.add(m);
        const look = this._milestoneLook("gift", m, "coins");
        this._fireAlert(
          "gift_milestone",
          {
            game: meta.game || null, username: data.username, avatarUrl: data.avatarUrl, nickname: data.nickname, milestone: m,
            ...look,
            message: `@${data.username} has gifted ${tierLabel(m)} coins!`,
            appreciation: pickWish(m >= 10000 ? BIG_MILESTONE_WISHES : MILESTONE_WISHES),
          },
          m >= 10000 ? "confetti" : m >= 1000 ? "pop-big" : "pop",
          "gift",
          meta
        );
      }
    }
    const prevRoom = this._roomCoinTotal;
    this._roomCoinTotal += coins;
    for (const m of LADDERS.roomGift) {
      if (prevRoom < m && this._roomCoinTotal >= m && !this._roomCoinMilestonesHit.has(m)) {
        this._roomCoinMilestonesHit.add(m);
        const look = this._milestoneLook("roomGift", m, "coins");
        this._fireAlert(
          "room_gift_milestone",
          {
            game: meta.game || null, milestone: m, ...look,
            message: `The room just gifted ${tierLabel(m)} coins!`,
            appreciation: pickWish(ROOM_WISHES),
          },
          "confetti",
          "roomGift",
          meta
        );
      }
    }
  }

  // --------------------------------------------------------------- likes --

  handleLike(raw, meta = {}) {
    try {
      if (meta.game !== "test" && !this._isNew("like", raw)) return; // the same TikTok message is never counted twice
      this._recordRawSample("like", raw);
      const { username, avatarUrl, nickname } = this._extractUser(raw);
      const reported = Number(firstNonEmpty(raw, TOTAL_LIKE_PATHS));
      const haveTotal = Number.isFinite(reported) && reported > 0;
      // How many likes THIS message adds: TikTok's own per-message count. If it is missing, use how much TikTok's
      // room total moved; only as a last resort assume 1. Never more than MAX_LIKE_BATCH (a single message cannot
      // legitimately carry thousands of taps).
      let batch = Number(firstNonEmpty(raw, LIKE_COUNT_PATHS));
      if (!Number.isFinite(batch) || batch <= 0) {
        batch = haveTotal && this.tiktokRoomLikes != null && reported > this.tiktokRoomLikes ? reported - this.tiktokRoomLikes : 1;
      }
      if (batch > MAX_LIKE_BATCH && meta.game !== "test") { this.logError("handleLike", new Error("a like message claimed " + batch + " likes - counted as " + MAX_LIKE_BATCH)); batch = MAX_LIKE_BATCH; }
      const roomTotalReported = haveTotal ? reported : NaN;

      this.lastEvents.like = { username, batch, ts: Date.now() };
      this.counters.totalLikes += batch;
      if (haveTotal) this.tiktokRoomLikes = Math.max(this.tiktokRoomLikes || 0, reported);
      try { Records.addLike({ username, nick: nickname, batch, game: meta.game, host: meta.tiktokUsername, sessionKey: meta.roomId }); } catch (err) { this.logError("records.addLike", err); }

      // ---- per-user individual milestone ----
      let user = this._perUserLikes.get(username);
      if (!user) {
        user = { total: 0, baselineSet: false, hit: new Set() };
        this._perUserLikes.set(username, user);
      }
      const prevUserTotal = user.total;
      user.total += batch;
      if (!user.baselineSet) {
        // First time we see this user — record baseline only, no alert,
        // so an already-active viewer never retroactively "hits" a dozen
        // milestones the instant the host connects mid-stream.
        user.baselineSet = true;
      } else {
        for (const m of INDIVIDUAL_LIKE_MILESTONES) {
          if (prevUserTotal < m && user.total >= m && !user.hit.has(m)) {
            user.hit.add(m);
            const look = this._milestoneLook("like", m, "likes");
            this._fireAlert(
              "like_milestone",
              {
                game: meta.game || null,
                username,
                avatarUrl,
                nickname,
                milestone: m,
                ...look,
                message: `@${username} just hit ${tierLabel(m)} likes!`,
                appreciation: pickWish(m >= 10000 ? BIG_MILESTONE_WISHES : MILESTONE_WISHES),
              },
              m >= 10000 ? "confetti" : m >= 1000 ? "pop-big" : "pop",
              "like",
              meta
            );
          }
        }
      }

      // ---- room-wide milestone ----
      const prevRoomTotal = this._roomLikeTotal;
      // TikTok's own room total (the number the TikTok app shows) is the truth whenever it is reported, so the room
      // milestones always agree with TikTok. Only when a message carries no total do we add this message's count.
      if (Number.isFinite(roomTotalReported)) {
        this._roomLikeTotal = Math.max(prevRoomTotal, roomTotalReported);
      } else {
        this._roomLikeTotal += batch;
      }
      if (!this._roomLikeBaselineSet) {
        this._roomLikeBaselineSet = true;
      } else {
        for (const m of ROOM_LIKE_MILESTONES) {
          if (prevRoomTotal < m && this._roomLikeTotal >= m && !this._roomLikeMilestonesHit.has(m)) {
            this._roomLikeMilestonesHit.add(m);
            this._fireAlert(
              "room_like_milestone",
              {
                game: meta.game || null,
                milestone: m,
                ...this._milestoneLook("roomLike", m, "likes"),
                message: `The room just hit ${tierLabel(m)} likes!`,
                appreciation: pickWish(ROOM_WISHES),
              },
              "confetti",
              "roomLike",
              meta
            );
          }
        }
      }

      this._flushAlerts();
      this.onDiagnosticsChange();
    } catch (err) {
      this.logError("handleLike", err);
    }
  }

  // -------------------------------------------------------------- shares --

  handleShare(raw, meta = {}) {
    try {
      if (meta.game !== "test" && !this._isNew("share", raw)) return; // the same TikTok message is never counted twice
      this._recordRawSample("share", raw);
      const { username, avatarUrl, nickname } = this._extractUser(raw);

      this.lastEvents.share = { username, ts: Date.now() };
      this.counters.totalShares += 1;

      this._perUserShares.set(username, (this._perUserShares.get(username) || 0) + 1);

      this._fireAlert(
        "share",
        {
          game: meta.game || null,
          username,
          avatarUrl,
          icon: "🔥",
          gradientFrom: "#ffe27a",
          gradientTo: "#e0a409",
          message: `@${username} just shared the Live!`,
          appreciation: pickWish(SHARE_WISHES),
          stat: null,
          nickname,
        },
        "glow-gold",
        null,
        meta
      );

      // (update 40) a viewer's own share ladder
      const myShares = this._perUserShares.get(username);
      if (LADDERS.share.includes(myShares)) {
        this._fireAlert(
          "share_milestone",
          {
            game: meta.game || null, username, avatarUrl, nickname, milestone: myShares,
            ...this._milestoneLook("share", myShares, "shares"),
            message: `@${username} has shared the Live ${myShares} times!`,
            appreciation: pickWish(MILESTONE_WISHES),
          },
          myShares >= 25 ? "confetti" : "pop-big",
          "share",
          meta
        );
      }

      const prevRoomShares = this._roomShareTotal;
      this._roomShareTotal += 1;
      for (const m of ROOM_SHARE_MILESTONES) {
        if (prevRoomShares < m && this._roomShareTotal >= m && !this._roomShareMilestonesHit.has(m)) {
          this._roomShareMilestonesHit.add(m);
          this._fireAlert(
            "room_share_milestone",
            {
              game: meta.game || null,
              milestone: m,
              ...this._milestoneLook("roomShare", m, "shares"),
              message: `The room just hit ${tierLabel(m)} shares!`,
              appreciation: pickWish(ROOM_WISHES),
            },
            "confetti",
            "roomShare",
            meta
          );
        }
      }

      this._flushAlerts();
      this.onDiagnosticsChange();
    } catch (err) {
      this.logError("handleShare", err);
    }
  }

  // ------------------------------------------------- follows / subscriptions --
  // (update 40) Saved to the records archive only (no on-screen alert, so nothing changes during a stream).
  handleSimple(kind, raw, meta = {}) {
    try {
      if (meta.game !== "test" && !this._isNew(kind, raw)) return;
      this._recordRawSample(kind, raw);
      const { username, avatarUrl, nickname } = this._extractUser(raw);
      Records.addSimple(kind, { username, nick: nickname, game: meta.game, host: meta.tiktokUsername, sessionKey: meta.roomId });
      // (update 43) optional on-screen thank-you (off by default; switch on in Records > Alerts)
      this._deliver(kind, {
        type: kind, game: meta.game || null, username, avatarUrl, nickname, tier: "pop", ts: Date.now(), host: meta.tiktokUsername || "",
        icon: kind === "follow" ? "➕" : "⭐", gradientFrom: kind === "follow" ? "#a7f3d0" : "#ffe27a", gradientTo: kind === "follow" ? "#0f9b6c" : "#c98a0c",
        message: kind === "follow" ? `@${username} just followed!` : `@${username} just subscribed!`,
        appreciation: pickWish(kind === "follow" ? FOLLOW_WISHES : GIFT_WISHES), stat: null,
      });
    } catch (err) {
      this.logError("handle." + kind, err);
    }
  }

  // ---------------------------------------------------------- test mode --

  /** Feeds a synthetic payload through the SAME code path as a real event,
   * so Test Mode exercises exactly the same parsing/combo/milestone logic
   * as production traffic — never a separately-maintained fake. */
  triggerTest(kind) {
    // Test alerts must NEVER change the real numbers: run them on a scratch copy of the counting state, then put the
    // real state back untouched.
    const saved = {
      counters: this.counters, sessionStartedAt: this.sessionStartedAt, dup: this.dup, seen: this._seenIds, comboDone: this._comboDone,
      rl: this._roomLikeTotal, rlb: this._roomLikeBaselineSet, rlh: this._roomLikeMilestonesHit, tkl: this.tiktokRoomLikes,
      rs: this._roomShareTotal, rsh: this._roomShareMilestonesHit, pul: this._perUserLikes, pus: this._perUserShares,
      puc: this._perUserCoins, rc: this._roomCoinTotal, rch: this._roomCoinMilestonesHit, pend: this._pendingAlerts,
      combo: this._comboBuffers, last: this.lastEvents,
    };
    this._comboBuffers = null; // keep the real combo timers alive
    this._initCounting();
    this.lastEvents = { gift: null, like: null, share: null };
    try {
      this._triggerTestInner(kind);
    } finally {
      this._comboBuffers = saved.combo;
      this.counters = saved.counters; this.sessionStartedAt = saved.sessionStartedAt; this.dup = saved.dup; this._seenIds = saved.seen; this._comboDone = saved.comboDone;
      this._roomLikeTotal = saved.rl; this._roomLikeBaselineSet = saved.rlb; this._roomLikeMilestonesHit = saved.rlh; this.tiktokRoomLikes = saved.tkl;
      this._roomShareTotal = saved.rs; this._roomShareMilestonesHit = saved.rsh; this._perUserLikes = saved.pul; this._perUserShares = saved.pus;
      this._perUserCoins = saved.puc; this._roomCoinTotal = saved.rc; this._roomCoinMilestonesHit = saved.rch; this._pendingAlerts = saved.pend;
      this.lastEvents = saved.last;
      this.onDiagnosticsChange();
    }
  }

  _triggerTestInner(kind) {
    const fakeUser = "test_viewer_" + Math.floor(Math.random() * 900 + 100);
    if (kind === "gift") {
      const big = Math.random() < 0.5;
      this.handleGift(
        {
          user: { uniqueId: fakeUser },
          giftDetails: { giftName: big ? "TikTok Universe" : "Rose", diamondCount: big ? 34999 : 1, giftType: big ? 0 : 1 },
          repeatCount: big ? 1 : 5,
          repeatEnd: true,
        },
        { game: "test" }
      );
    } else if (kind === "share") {
      this.handleShare({ user: { uniqueId: fakeUser } }, { game: "test" });
    } else if (kind === "milestone") {
      // Force an individual user across the next un-hit milestone.
      let user = this._perUserLikes.get(fakeUser);
      if (!user) {
        user = { total: 0, baselineSet: true, hit: new Set() };
        this._perUserLikes.set(fakeUser, user);
      }
      const next = INDIVIDUAL_LIKE_MILESTONES[Math.floor(Math.random() * INDIVIDUAL_LIKE_MILESTONES.length)];
      this.handleLike({ user: { uniqueId: fakeUser }, likeCount: next - user.total, totalLikeCount: this._roomLikeTotal }, { game: "test" });
    } else if (kind === "room") {
      // Bonus test button target: force the very next room-wide milestone.
      const nextRoom = ROOM_LIKE_MILESTONES.find((m) => !this._roomLikeMilestonesHit.has(m)) || ROOM_LIKE_MILESTONES[0];
      const needed = Math.max(1, nextRoom - this._roomLikeTotal);
      this.handleLike({ user: { uniqueId: fakeUser }, likeCount: needed, totalLikeCount: this._roomLikeTotal + needed }, { game: "test" });
    }
  }

  // ------------------------------------------------------------- public --

  getPublicState() {
    return {
      counters: { ...this.counters },
      counting: {
        sessionKey: this.sessionKey || null,
        since: this.sessionStartedAt,
        platformLikes: this.counters.totalLikes,
        tiktokRoomLikes: this.tiktokRoomLikes,
        duplicatesBlocked: this.dup.blocked,
        comboRepeatsSkipped: this.dup.comboRepeats,
        viewersTracked: this._perUserLikes.size,
      },
      lastEvents: this.lastEvents,
      rawSamples: this.rawSamples,
      errors: this.errors.slice(0, 8),
    };
  }
}
