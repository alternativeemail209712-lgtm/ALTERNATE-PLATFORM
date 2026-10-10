// ============================================================================
// Test Mode: a fast, fully self-contained fake chat feed. It never touches
// the network or TikTok - it just calls the exact same onComment() function
// that real TikTok chat messages go through, so the whole game can be
// verified after any code change without ever going live.
// ============================================================================

const FAKE_USERNAMES = [
  'viewer_87', 'sunny.days', 'kopi_o_kaw', 'nightowl22', 'pixel.pusher',
  'giggles', 'streamfan1', 'mochi_bear', 'grumpy_cat9', 'looloo',
  'wanderer', 'byte_sized', 'quietstorm', 'zestyzeb', 'popcorn_time',
];

const FAKE_CHATTER = [
  'hi from malaysia!', 'lol nice', 'omg', 'good morning', 'first time here',
  '\u{1F525}\u{1F525}\u{1F525}', 'this is fun', 'can you say hi', 'love this game', 'wait what',
  'hello everyone', 'haha', "let's go", 'wow', 'nice one',
];

export class TestModeSimulator {
  /**
   * @param {(username:string, text:string, source:string) => void} onComment
   * @param {() => string[]} getWordPool - returns candidate answer words so
   *   simulated guesses occasionally solve the round (to exercise that path).
   */
  constructor(onComment, getWordPool) {
    this.onComment = onComment;
    this.getWordPool = getWordPool;
    this.timer = null;
    this.active = false;
    this.currentAnswerGetter = null;
  }

  start(currentAnswerGetter) {
    if (this.active) return;
    this.active = true;
    this.currentAnswerGetter = currentAnswerGetter;
    this._scheduleNext();
  }

  stop() {
    this.active = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  _scheduleNext() {
    if (!this.active) return;
    const delay = 900 + Math.random() * 1600;
    this.timer = setTimeout(() => {
      try {
        this._fireOne();
      } catch (err) {
        // Test mode must never crash the server either.
        console.error('[testMode]', err);
      }
      this._scheduleNext();
    }, delay);
  }

  _fireOne() {
    const username = pick(FAKE_USERNAMES);
    const roll = Math.random();
    let text;

    if (roll < 0.5) {
      // A plausible guess matching the current round's word length.
      const pool = this.getWordPool ? this.getWordPool() : [];
      text = pool.length ? pick(pool) : 'apple';
      // Occasionally simulate someone actually nailing the answer, so the
      // "solved" path gets exercised in Test Mode too.
      if (Math.random() < 0.12 && this.currentAnswerGetter) {
        const ans = this.currentAnswerGetter();
        if (ans) text = ans;
      }
    } else if (roll < 0.7) {
      // A guess wrapped in typical chat noise/punctuation.
      const pool = this.getWordPool ? this.getWordPool() : ['apple'];
      text = `${pick(['its', 'i think', 'guess:', 'maybe'])} ${pick(pool)}!!`;
    } else {
      // Plain chatter that should NOT be recognized as a guess - this
      // exercises the "arriving but not recognized" diagnostics path.
      text = pick(FAKE_CHATTER);
    }

    this.onComment(username, text, 'test');
  }
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
