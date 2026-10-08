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

const MAX_RAW_SAMPLES = 8;
const MAX_ERROR_LOG = 25;

// Individual (per-user, this session) LIKE milestones. Per spec: exact
// named early milestones, then round-number thousands after that.
const INDIVIDUAL_LIKE_MILESTONES = [
  100, 300, 500, 700, 1000, 2000, 3000, 4000, 5000, 10000,
  20000, 30000, 40000, 50000, 75000, 100000, 150000, 200000, 250000, 500000, 1000000,
];

// Room-wide (whole session, all viewers combined) milestones — bigger,
// "massive alert" tier.
const ROOM_LIKE_MILESTONES = [
  1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000, 2000000, 5000000, 10000000,
];
const ROOM_SHARE_MILESTONES = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000];

// A gift's total coin value (single gift, or a whole finished combo) at
// or above this is treated as a "big gift" -> confetti-tier alert instead
// of the small pop used for an ordinary gift.
const BIG_GIFT_COIN_THRESHOLD = 500;

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

const LIKE_COUNT_PATHS = ["likeCount", "count", "like_count"];
const TOTAL_LIKE_PATHS = ["totalLikeCount", "total", "total_like_count"];

function tierLabel(n) {
  if (n >= 1000000) {
    const m = n / 1000000;
    return (Number.isInteger(m) ? m : m.toFixed(1)) + "m";
  }
  if (n >= 1000) {
    const k = n / 1000;
    return (Number.isInteger(k) ? k : k.toFixed(1)) + "k";
  }
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

    this.counters = { totalGifts: 0, totalLikes: 0, totalShares: 0, totalCoins: 0 };
    this.rawSamples = []; // { kind, text, ts }
    this.errors = []; // { context, message, ts }
    this.lastEvents = { gift: null, like: null, share: null };

    this._roomLikeTotal = 0;
    this._roomLikeBaselineSet = false;
    this._roomLikeMilestonesHit = new Set();

    this._roomShareTotal = 0;
    this._roomShareMilestonesHit = new Set();

    this._perUserLikes = new Map(); // username -> { total, baselineSet, hit:Set }
    this._perUserShares = new Map(); // username -> count (session)

    this._comboBuffers = new Map(); // key -> { data, timer }
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
    return {
      username: username != null ? String(username) : "viewer",
      avatarUrl: avatar != null ? String(avatar) : null,
    };
  }

  _fireAlert(type, payload, tier) {
    this.onAlert(type, { ...payload, tier, ts: Date.now() });
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
      this._recordRawSample("gift", raw);
      const { username, avatarUrl } = this._extractUser(raw);
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

      const finalize = (data) => {
        this.counters.totalGifts += 1;
        this.counters.totalCoins += data.totalCoinValue;
        const big = data.totalCoinValue >= BIG_GIFT_COIN_THRESHOLD;
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
          },
          big ? "confetti" : "pop"
        );
        this.onDiagnosticsChange();
      };

      if (!isStreakable) {
        // Single, non-combo gift — finalize immediately, nothing to buffer.
        finalize({ username, avatarUrl, giftName, repeatCount, coinCount, totalCoinValue: coinCount * repeatCount });
        return;
      }

      // Streakable — buffer until the combo is actually finished.
      const key = `${username}|${giftId != null ? giftId : giftName}|${groupId != null ? groupId : ""}`;
      const existing = this._comboBuffers.get(key);
      if (existing) clearTimeout(existing.timer);

      const data = { username, avatarUrl, giftName, repeatCount, coinCount, totalCoinValue: coinCount * repeatCount };

      if (repeatEnd) {
        this._comboBuffers.delete(key);
        finalize(data);
        return;
      }

      const timer = setTimeout(() => {
        this._comboBuffers.delete(key);
        finalize(data);
      }, COMBO_INACTIVITY_MS);

      this._comboBuffers.set(key, { data, timer });
    } catch (err) {
      this.logError("handleGift", err);
    }
  }

  // --------------------------------------------------------------- likes --

  handleLike(raw, meta = {}) {
    try {
      this._recordRawSample("like", raw);
      const { username, avatarUrl } = this._extractUser(raw);
      const batch = Number(firstNonEmpty(raw, LIKE_COUNT_PATHS)) || 1;
      const roomTotalReported = Number(firstNonEmpty(raw, TOTAL_LIKE_PATHS));

      this.lastEvents.like = { username, batch, ts: Date.now() };
      this.counters.totalLikes += batch;

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
            const big = m >= 10000;
            this._fireAlert(
              "like_milestone",
              {
                game: meta.game || null,
                username,
                avatarUrl,
                milestone: m,
                icon: big ? "🏆" : m >= 1000 ? "⭐" : "👍",
                gradientFrom: big ? "#ffe27a" : m >= 1000 ? "#ffd76a" : "#a7f3d0",
                gradientTo: big ? "#c98a0c" : m >= 1000 ? "#e0a409" : "#0f9b6c",
                message: `@${username} just hit ${tierLabel(m)} likes!`,
                appreciation: pickWish(big ? BIG_MILESTONE_WISHES : MILESTONE_WISHES),
                stat: `${tierLabel(m)} likes this session`,
              },
              big ? "confetti" : m >= 1000 ? "pop-big" : "pop"
            );
          }
        }
      }

      // ---- room-wide milestone ----
      const prevRoomTotal = this._roomLikeTotal;
      // Prefer the library's own running total if it reports one and it's
      // sane (monotonic, not a reset-looking value); otherwise fall back
      // to our own running sum of batches.
      if (Number.isFinite(roomTotalReported) && roomTotalReported >= prevRoomTotal) {
        this._roomLikeTotal = roomTotalReported;
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
                icon: "🌟",
                gradientFrom: "#ff9ecb",
                gradientTo: "#8b5cf6",
                message: `The room just hit ${tierLabel(m)} likes!`,
                appreciation: pickWish(ROOM_WISHES),
                stat: `${tierLabel(m)} total likes this session`,
              },
              "confetti"
            );
          }
        }
      }

      this.onDiagnosticsChange();
    } catch (err) {
      this.logError("handleLike", err);
    }
  }

  // -------------------------------------------------------------- shares --

  handleShare(raw, meta = {}) {
    try {
      this._recordRawSample("share", raw);
      const { username, avatarUrl } = this._extractUser(raw);

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
        },
        "glow-gold"
      );

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
              icon: "🌟",
              gradientFrom: "#9fd8ff",
              gradientTo: "#1d4ed8",
              message: `The room just hit ${tierLabel(m)} shares!`,
              appreciation: pickWish(ROOM_WISHES),
              stat: `${tierLabel(m)} total shares this session`,
            },
            "confetti"
          );
        }
      }

      this.onDiagnosticsChange();
    } catch (err) {
      this.logError("handleShare", err);
    }
  }

  // ---------------------------------------------------------- test mode --

  /** Feeds a synthetic payload through the SAME code path as a real event,
   * so Test Mode exercises exactly the same parsing/combo/milestone logic
   * as production traffic — never a separately-maintained fake. */
  triggerTest(kind) {
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
      const next = INDIVIDUAL_LIKE_MILESTONES.find((m) => !user.hit.has(m)) || INDIVIDUAL_LIKE_MILESTONES[0];
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
      lastEvents: this.lastEvents,
      rawSamples: this.rawSamples,
      errors: this.errors.slice(0, 8),
    };
  }
}
