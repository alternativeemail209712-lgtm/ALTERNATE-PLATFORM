// ============================================================================
// TWISTLE LIVE - game module
//
// A symbol word game: every guess gets a row of mystery symbols that describe
// the letters of the SECRET word (see twistle-engine.js for the exact rules).
//
// This module plugs into the platform exactly like the other Socket.IO games
// (Flagle / TRAVLE / Findle / CROSSDLE): registerTwistle(app, rootIo) mounts
// it on its own Socket.IO namespace "/twistle" so its events never cross
// paths with any other game sharing this server.
//
// Everything AROUND the symbol rules deliberately follows BLINDLE's system,
// so the two games feel and score the same:
//   - WORD DATABASE : BLINDLE's curated answer list (secret words) and its
//                     370,000+ word dictionary (valid guesses). Imported
//                     straight from ../blindle/, so it is literally the same
//                     word bank, loaded into memory only once.
//   - SECRET WORDS  : same difficulty tiers (Normal / Medium / Hard /
//                     Random), same fixed-length or random-length-range
//                     setting, same "don't repeat a word until the pool is
//                     used up", same host "set the secret word" override.
//   - POINTS        : 10 for solving, 1 for every guess that lands on the
//                     board - Live mode only. Round + all-time leaderboards
//                     with viewers' TikTok profile pictures.
//   - CELEBRATION   : winner window -> this round's top scorers -> all-time
//                     top scorers, each shown for the same host-set number
//                     of seconds. Auto-continue waits for all of it.
//   - MODES         : Live (real TikTok chat, scores count), Test (simulated
//                     chat, scores NOT saved), Offline (host plays solo).
// ============================================================================

import { ANSWER_WORDS, MIN_WORD_LENGTH, MAX_WORD_LENGTH } from '../blindle/blindle-answers.js';
import { dictionaryState, loadDictionary, isValidGuessWord } from '../blindle/blindle-dictionary.js';
import { buildDifficultyIndex, getWordsForDifficulty } from '../blindle/blindle-difficulty.js';
import { isBlocked } from '../crossdle/crossdle-blocklist.js';
import { Diagnostics } from './twistle-diagnostics.js';
import { TikTokManager } from './twistle-tiktok.js';
import { evaluateGuess, pickSymbolMap, conceptsEqual, parseGuess, SYMBOL_POOL } from './twistle-engine.js';
import { getStrictFit, setStrictFit } from '../shared/strict-fit-store.js';
import { getStarterWord, setStarterWord } from '../shared/starter-word-store.js';

// Points - identical to BLINDLE (solving is worth 10x a plain valid guess).
const WIN_POINTS = 10;
const GUESS_POINTS = 1;

const DEFAULT_AUTO_CONTINUE_DELAY = 3;
const DEFAULT_LEADERBOARD_SHOW_SECONDS = 3;
const DEFAULT_REJECTION_TOAST_SECONDS = 4;
// After a round ends the board flips its tiles and shows the answer plus what
// each symbol meant. That is the payoff of a Twistle round, so it gets its own
// window BEFORE the win celebration covers the screen (host-adjustable).
const DEFAULT_REVEAL_SHOW_SECONDS = 4;
// The win celebration always walks through 3 stages (winner, this-round
// leaderboard, all-time leaderboard), each shown for leaderboardShowSeconds.
const CELEBRATION_STAGE_COUNT = 3;

// Only the newest rows are sent to browsers, so a marathon round with
// hundreds of guesses can't bloat every update. The total is always sent too.
const MAX_ROWS_SENT = 150;

export async function registerTwistle(app, rootIo, options = {}) {
  const SIGN_API_KEY =
    process.env.EULERSTREAM_API_KEY || process.env.SIGN_API_KEY || process.env.TIKTOK_SIGN_API_KEY || '';

  const io = rootIo.of('/twistle');
  const diagnostics = new Diagnostics();

  const difficultyIndex = buildDifficultyIndex(ANSWER_WORDS);
  // Every curated word is always an acceptable guess, even if the big
  // dictionary hasn't loaded (offline fallback mode).
  const answerSet = new Set(Object.values(ANSWER_WORDS).flat());
  const wordBankSize = answerSet.size;

  // A viewer's most-recently-seen profile picture, so the real TikTok avatar
  // can be shown next to every guess, win and leaderboard row that mentions
  // them. Host / Test / Offline guesses have none - the page falls back to a
  // coloured initial.
  const knownAvatars = new Map();

  // Profile picture of the HOST of the current TikTok LIVE session - shown on the
  // automatic starter-word row. Null in Test / Offline mode or when unavailable.
  let hostAvatarUrl = null;

  const game = {
    mode: 'test',
    status: 'idle', // idle | live | won | lost
    roundNumber: 0,
    wordLength: 5,
    difficulty: 'normal',
    // "fixed" plays wordLength every round; "random" picks a new random length
    // inside [lengthMin, lengthMax] at the start of every round.
    lengthMode: 'fixed',
    lengthMin: 4,
    lengthMax: 8,
    secretWord: null,
    symbolMap: null, // { correct, misplaced, absent } -> symbol ids. SECRET until the round ends.
    rows: [], // every guess on the board, in order
    guessed: new Set(), // words already on the board
    endReason: null, // 'guessed' | 'revealed'
    hintsUsed: 0,
    hintSuggestions: [],
    lastWinInfo: null, // { username, points, word, avatarUrl }
    lastRejection: null, // { word, reason, at } - a brief on-screen toast, BLINDLE-style
    rejectionToastSeconds: DEFAULT_REJECTION_TOAST_SECONDS,
    // STRICT FIT (update 25): ON by default; the host can switch it off in Settings (remembered in
    // data/strict-fit.json). ON = a new guess must fit the symbol row of every guess already on the
    // board. OFF = any real word of the right length goes onto the board.
    strictFit: getStrictFit('twistle'),
    // STARTER WORD (update 27): ON by default; the host can switch it off in Settings (remembered in
    // data/starter-word.json). ON = every round opens with one automatic, never-winning symbol row.
    starterWord: getStarterWord('twistle'),
    usedWords: new Set(),
    roundScores: new Map(),
    totalScores: new Map(),
    autoContinue: false,
    autoContinueDelaySeconds: DEFAULT_AUTO_CONTINUE_DELAY,
    autoContinueAt: null,
    leaderboardShowSeconds: DEFAULT_LEADERBOARD_SHOW_SECONDS,
    revealShowSeconds: DEFAULT_REVEAL_SHOW_SECONDS,
  };

  // -------------------------------------------------------------------------
  // Secret-word selection (BLINDLE's system)
  // -------------------------------------------------------------------------

  function clampWordLength(n) {
    const v = Number(n);
    if (!Number.isFinite(v)) return 5;
    return Math.min(MAX_WORD_LENGTH, Math.max(MIN_WORD_LENGTH, Math.round(v)));
  }

  function randomWordLengthInRange() {
    const lo = clampWordLength(game.lengthMin);
    const hi = Math.max(lo, clampWordLength(game.lengthMax));
    return lo + Math.floor(Math.random() * (hi - lo + 1));
  }

  function pickAnswer(wordLength, difficulty) {
    const candidates = getWordsForDifficulty(ANSWER_WORDS, difficultyIndex, wordLength, difficulty);
    const unused = candidates.filter((w) => !game.usedWords.has(w));
    const list = unused.length > 0 ? unused : candidates;
    if (unused.length === 0) game.usedWords.clear();
    const pick = list[Math.floor(Math.random() * list.length)];
    game.usedWords.add(pick);
    return pick;
  }

  // -------------------------------------------------------------------------
  // Points & leaderboards (BLINDLE's system)
  // -------------------------------------------------------------------------

  function awardPoints(caller, points) {
    if (game.mode !== 'live' || !caller) return;
    game.roundScores.set(caller, (game.roundScores.get(caller) || 0) + points);
    game.totalScores.set(caller, (game.totalScores.get(caller) || 0) + points);
  }

  function getLeaderboard(map) {
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([username, score]) => ({ username, score, avatarUrl: knownAvatars.get(username) || null }));
  }

  // -------------------------------------------------------------------------
  // The round
  // -------------------------------------------------------------------------

  // A round used to open on a totally blank board, so the very first
  // audience guess had zero information to reason from. Every round now
  // opens with one random, automatically-played guess before any audience
  // guessing happens - never the secret word itself, and never worth
  // points to anyone - so its row of symbols gives viewers an immediate
  // starting clue instead of a cold guess.
  const STARTER_GUESS_LABEL = '🎲 Starter word';

  function pickStarterWord(wordLength) {
    const pool = getWordsForDifficulty(ANSWER_WORDS, difficultyIndex, wordLength, 'random')
      .filter((w) => w !== game.secretWord);
    if (pool.length === 0) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function seedStarterGuess() {
    if (!game.starterWord) return;
    const starter = pickStarterWord(game.wordLength);
    if (!starter) return; // nothing eligible at this length - round still starts fine, just blank
    const { states, symbols } = evaluateGuess(game.secretWord, starter);
    game.guessed.add(starter);
    game.rows.push({
      word: starter,
      caller: STARTER_GUESS_LABEL,
      avatarUrl: null,
      isStarter: true,
      states,
      concepts: symbols,
      symbols: symbols.map((concept) => game.symbolMap[concept]),
    });
  }

  function startRound(overrideWord) {
    if (!overrideWord && game.lengthMode === 'random') {
      game.wordLength = randomWordLengthInRange();
    }
    game.secretWord = overrideWord || pickAnswer(game.wordLength, game.difficulty);
    game.symbolMap = pickSymbolMap();
    game.rows = [];
    game.guessed = new Set();
    game.endReason = null;
    game.hintsUsed = 0;
    game.hintSuggestions = [];
    game.lastWinInfo = null;
    game.lastRejection = null;
    game.roundScores.clear();
    game.roundNumber += 1;
    game.status = 'live';
    game.autoContinueAt = null;
    seedStarterGuess();
    broadcastState();
  }

  function endRound(status, reason) {
    game.status = status;
    game.endReason = reason;
    if (game.autoContinue) {
      // Wait out the reveal (tiles flip, answer + symbol meanings) and - on a
      // win - the whole 3-window celebration BEFORE the configured delay even
      // starts, so a new round never interrupts either one mid-display.
      const celebrationSeconds = status === 'won' ? game.leaderboardShowSeconds * CELEBRATION_STAGE_COUNT : 0;
      game.autoContinueAt =
        Date.now() + (game.revealShowSeconds + celebrationSeconds + game.autoContinueDelaySeconds) * 1000;
    }
    broadcastState();
  }

  // STRICT FIT for TWISTLE.
  // Nobody is told which symbol means "correct spot" / "wrong spot" / "not in your guess", so a
  // viewer can only see WHICH LETTER POSITIONS share a symbol. A candidate word therefore fits an
  // earlier row when, if it were the secret word, that row would have grouped the letter positions
  // in exactly the same way - the meanings may be assigned to the symbols in any way, and (like
  // ORACLE) independently for every row. The real secret word always fits, and accepting or
  // rejecting a word never reveals what any symbol means.
  function partitionKey(row) {
    const labels = new Map();
    return row.map((c) => {
      if (!labels.has(c)) labels.set(c, labels.size);
      return labels.get(c);
    }).join(',');
  }

  function checkStrictFit(word) {
    for (let i = 0; i < game.rows.length; i++) {
      const row = game.rows[i];
      const hypothetical = evaluateGuess(word, row.word).symbols; // the row `row.word` would show if `word` were the secret
      if (partitionKey(hypothetical) !== partitionKey(row.concepts)) {
        return { ok: false, conflictIndex: i, conflictWord: row.word };
      }
    }
    return { ok: true };
  }

  function isAcceptableGuess(word) {
    if (answerSet.has(word)) return true;
    return isValidGuessWord(word) && !isBlocked(word);
  }

  /**
   * One guess (already normalised to lowercase letters of the right length).
   *   { ok: true, won: true }   - solved it
   *   { ok: true, added: true } - a fresh, valid word: now a row on the board
   *   { ok: false, error }      - refused (not a word / already on the board / no round)
   */
  function submitGuess(word, caller) {
    if (game.status !== 'live') return { ok: false, error: 'No round in progress.' };

    const avatarUrl = knownAvatars.get(caller) || null;

    // The secret word always wins, however many guesses are already on the board.
    if (word === game.secretWord) {
      awardPoints(caller, WIN_POINTS);
      game.lastWinInfo = {
        username: caller,
        points: game.mode === 'live' ? WIN_POINTS : null,
        word,
        avatarUrl,
      };
      endRound('won', 'guessed');
      return { ok: true, won: true };
    }

    if (!isAcceptableGuess(word)) {
      const error = "That's not in the word list.";
      game.lastRejection = { word, reason: error, at: Date.now() };
      return { ok: false, error, reason: 'not-a-word' };
    }
    if (game.guessed.has(word)) {
      const error = 'That word is already on the board.';
      game.lastRejection = { word, reason: error, at: Date.now() };
      return { ok: false, error, reason: 'already-played' };
    }

    // Strict fit ON (default): the word must fit the symbol row of every guess on the board.
    if (game.strictFit) {
      const fit = checkStrictFit(word);
      if (!fit.ok) {
        const error = `Doesn't fit the symbols of guess #${fit.conflictIndex + 1} (${fit.conflictWord.toUpperCase()})`;
        game.lastRejection = { word, reason: error, at: Date.now() };
        return { ok: false, error, reason: 'no-fit' };
      }
    }

    const { states, symbols } = evaluateGuess(game.secretWord, word);
    game.guessed.add(word);
    game.rows.push({
      word,
      caller,
      avatarUrl,
      states, // hidden from browsers until the round ends
      concepts: symbols, // what each symbol MEANS - hidden from browsers until the round ends
      symbols: symbols.map((concept) => game.symbolMap[concept]),
    });
    awardPoints(caller, GUESS_POINTS);
    broadcastState();
    return { ok: true, added: true };
  }

  function revealAnswer() {
    if (game.status !== 'live') return;
    endRound('lost', 'revealed');
  }

  function skipRound() {
    if (game.status !== 'live') return;
    startRound();
  }

  function setSecretWord(rawWord) {
    const word = String(rawWord || '').toLowerCase().normalize('NFKD').replace(/[^a-z]/g, '');
    if (!word || word.length !== game.wordLength) {
      return { ok: false, error: `Must be exactly ${game.wordLength} letters, A-Z only.` };
    }
    startRound(word);
    return { ok: true };
  }

  // A word that fits every clue so far (never the secret itself): for every
  // guess already on the board, it would have produced the very same row of
  // symbol meanings.
  function useHint() {
    if (game.status !== 'live') return;
    let candidates = getWordsForDifficulty(ANSWER_WORDS, difficultyIndex, game.wordLength, game.difficulty);
    candidates = candidates.filter((w) => w !== game.secretWord && !game.guessed.has(w));
    for (const row of game.rows) {
      candidates = candidates.filter((w) => conceptsEqual(evaluateGuess(w, row.word).symbols, row.concepts));
    }
    candidates = candidates.filter((w) => !game.hintSuggestions.includes(w));
    if (candidates.length === 0) return;
    game.hintSuggestions.push(candidates[Math.floor(Math.random() * candidates.length)]);
    game.hintsUsed += 1;
    broadcastState();
  }

  function applySettings(s) {
    const { mode, wordLength, difficulty, lengthMode, lengthMin, lengthMax, autoContinue, autoContinueDelaySeconds } = s;

    if (['live', 'test', 'offline'].includes(mode)) {
      if (mode !== 'live' && game.mode === 'live') tiktok.disconnect();
      game.mode = mode;
    }
    if (wordLength !== undefined) game.wordLength = clampWordLength(wordLength);
    if (['normal', 'medium', 'hard', 'random'].includes(difficulty)) game.difficulty = difficulty;
    if (['fixed', 'random'].includes(lengthMode)) game.lengthMode = lengthMode;
    if (lengthMin !== undefined || lengthMax !== undefined) {
      let lo = clampWordLength(lengthMin !== undefined ? lengthMin : game.lengthMin);
      let hi = clampWordLength(lengthMax !== undefined ? lengthMax : game.lengthMax);
      if (lo > hi) [lo, hi] = [hi, lo]; // never let the range invert
      game.lengthMin = lo;
      game.lengthMax = hi;
    }
    if (typeof autoContinue === 'boolean') game.autoContinue = autoContinue;
    if (autoContinueDelaySeconds !== undefined) {
      const v = Number(autoContinueDelaySeconds);
      game.autoContinueDelaySeconds = Number.isFinite(v)
        ? Math.min(120, Math.max(3, Math.round(v)))
        : DEFAULT_AUTO_CONTINUE_DELAY;
    }

    if (game.mode === 'test') startTestMode();
    else stopTestMode(); // Live stays connected if it already was; Offline never runs a simulator.

    startRound();
  }

  const autoContinueTimer = setInterval(() => {
    try {
      if (!game.autoContinueAt) return;
      if (Date.now() >= game.autoContinueAt) {
        game.autoContinueAt = null;
        startRound();
      } else {
        broadcastState(true);
      }
    } catch (err) {
      diagnostics.logError('autoContinueTick', err);
    }
  }, 1000);
  if (autoContinueTimer.unref) autoContinueTimer.unref();

  // -------------------------------------------------------------------------
  // Chat input (TikTok comments in Live mode, simulated chat in Test mode)
  // -------------------------------------------------------------------------

  function handleIncomingComment(username, text, source, avatarUrl) {
    try {
      diagnostics.recordIncoming({ username, text, source });
      if (avatarUrl) knownAvatars.set(username, avatarUrl);

      // Real chat only counts in Live mode, simulated chat only in Test mode,
      // and Offline mode ignores chat entirely.
      const countsHere = (game.mode === 'live' && source === 'tiktok') || (game.mode === 'test' && source === 'test');
      if (countsHere && game.status === 'live') {
        const word = parseGuess(text, game.wordLength);
        if (word) {
          const result = submitGuess(word, username);
          if (result.ok) diagnostics.recordRecognized();
        }
      }
      broadcastState();
    } catch (err) {
      diagnostics.logError('handleIncomingComment', err);
    }
  }

  const tiktok = new TikTokManager({
    diagnostics,
    signApiKey: SIGN_API_KEY,
    onComment: handleIncomingComment,
    onStatus: () => broadcastState(),
    onHostAvatar: (url) => {
      hostAvatarUrl = url || null;
      broadcastState();
    },
  });

  // -------------------------------------------------------------------------
  // Test mode - fake chat, same rules, scores NOT saved
  // -------------------------------------------------------------------------

  const FAKE_USERNAMES = ['comet_fan', 'wordwiz99', 'livstream_lu', 'night.owl', 'byte_buddy', 'quiz.queen', 'pixel_pete'];
  const FAKE_JUNK = ['hi', 'lol', 'go team', 'so fun', 'love this game', 'hmm', 'wait what', 'what do the symbols mean'];
  let testModeTimer = null;

  function startTestMode() {
    stopTestMode();
    tiktok.disconnect();
    diagnostics.setConnectionState('idle', 'Test Mode is simulating chat - nothing to connect.', 0, null);
    testModeTimer = setInterval(() => {
      try {
        if (game.mode !== 'test') return;
        const username = FAKE_USERNAMES[Math.floor(Math.random() * FAKE_USERNAMES.length)];
        const roll = Math.random();
        let text;
        if (game.status === 'live' && game.secretWord && roll < 0.04 + 0.006 * game.rows.length) {
          text = game.secretWord; // somebody cracked it - likelier the more guesses are on the board
        } else if (game.status === 'live' && roll < 0.55) {
          const pool = ANSWER_WORDS[game.wordLength] || [];
          text = pool.length ? pool[Math.floor(Math.random() * pool.length)] : FAKE_JUNK[0];
        } else {
          text = FAKE_JUNK[Math.floor(Math.random() * FAKE_JUNK.length)];
        }
        handleIncomingComment(username, text, 'test');
      } catch (err) {
        diagnostics.logError('testMode.tick', err);
      }
    }, 900);
    if (testModeTimer.unref) testModeTimer.unref();
  }

  function stopTestMode() {
    if (testModeTimer) clearInterval(testModeTimer);
    testModeTimer = null;
  }

  // -------------------------------------------------------------------------
  // What browsers see
  // -------------------------------------------------------------------------

  function buildStatePayload() {
    const ended = game.status === 'won' || game.status === 'lost';
    const usedLetters = [...new Set(game.rows.flatMap((r) => r.word.split('')))];
    const rows = game.rows.slice(-MAX_ROWS_SENT).map((r) => ({
      word: r.word,
      caller: r.caller,
      // The automatic starter word shows the LIVE host's profile picture.
      avatarUrl: r.isStarter ? hostAvatarUrl : r.avatarUrl,
      symbols: r.symbols,
      // The tile colours only exist once the round is over.
      ...(ended ? { states: r.states } : {}),
    }));

    return {
      game: {
        mode: game.mode,
        status: game.status,
        roundNumber: game.roundNumber,
        wordLength: game.wordLength,
        difficulty: game.difficulty,
        lengthMode: game.lengthMode,
        lengthMin: game.lengthMin,
        lengthMax: game.lengthMax,
        // Answer, symbol meanings and tile colours are revealed only at the end.
        secretWord: ended ? game.secretWord : null,
        legend: ended ? { ...game.symbolMap } : null,
        endReason: ended ? game.endReason : null,
        rows,
        guessesMade: game.rows.length,
        usedLetters,
        hintsUsed: game.hintsUsed,
        hintSuggestions: game.hintSuggestions,
        lastWinInfo: game.lastWinInfo,
        lastRejection: game.lastRejection,
        strictFit: game.strictFit,
        starterWord: game.starterWord,
        rejectionToastSeconds: game.rejectionToastSeconds,
        autoContinue: game.autoContinue,
        autoContinueDelaySeconds: game.autoContinueDelaySeconds,
        autoContinueSecondsLeft: game.autoContinueAt
          ? Math.max(0, Math.ceil((game.autoContinueAt - Date.now()) / 1000))
          : 0,
        leaderboardShowSeconds: game.leaderboardShowSeconds,
        revealShowSeconds: game.revealShowSeconds,
        minWordLength: MIN_WORD_LENGTH,
        maxWordLength: MAX_WORD_LENGTH,
        wordBankSize,
      },
      roundLeaderboard: getLeaderboard(game.roundScores),
      totalLeaderboard: getLeaderboard(game.totalScores),
      diagnostics: {
        ...diagnostics.getPublicState(),
        rawSamples: undefined, // server-log material, not needed on screen
        signKeyConfigured: Boolean(SIGN_API_KEY),
        dictionarySource: dictionaryState.source,
        dictionaryWordCount: dictionaryState.wordCount,
        dictionaryLoading: dictionaryState.loading,
      },
    };
  }

  // Updates are coalesced (many guesses in the same instant -> one broadcast).
  let broadcastPending = false;
  function broadcastState(lightweight = false) {
    if (broadcastPending) return;
    broadcastPending = true;
    const t = setTimeout(() => {
      broadcastPending = false;
      try {
        io.emit('state', buildStatePayload());
      } catch (err) {
        diagnostics.logError('broadcast.state', err);
      }
    }, lightweight ? 0 : 100);
    if (t.unref) t.unref();
  }

  // -------------------------------------------------------------------------
  // Socket wiring. Host controls are open to anyone on the page - the same
  // trust model as every other game on this platform (no accounts).
  // -------------------------------------------------------------------------

  const guarded = (label, fn) => (...args) => {
    try {
      return fn(...args);
    } catch (err) {
      diagnostics.logError(`socket.${label}`, err);
    }
  };
  const reply = (ack, payload) => { if (typeof ack === 'function') ack(payload); };
  const clampSeconds = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(30, Math.max(1, Math.round(n))) : fallback;
  };

  app.get('/twistle/healthz', (req, res) => res.status(200).send('ok'));

  io.on('connection', (socket) => {
    try {
      socket.emit('state', buildStatePayload());
    } catch (err) {
      diagnostics.logError('socket.onConnectEmit', err);
    }

    socket.on('host:connectTikTok', guarded('connectTikTok', async (payload) => {
      const username = String((payload && payload.username) || '').trim().replace(/^@/, '');
      if (game.mode !== 'live') {
        diagnostics.setConnectionState('idle', 'Switch to Live mode first (Settings, Mode, Live, then Apply), then connect.', 0, null);
        broadcastState();
        return;
      }
      if (!username) {
        diagnostics.setConnectionState('error', 'Type a TikTok username first.', 0, null);
        broadcastState();
        return;
      }
      stopTestMode();
      await tiktok.connect(username);
    }));

    socket.on('host:disconnectTikTok', guarded('disconnectTikTok', () => {
      tiktok.disconnect();
      broadcastState();
    }));

    socket.on('host:applySettings', guarded('applySettings', (payload) => applySettings(payload || {})));
    socket.on('host:playAgain', guarded('playAgain', () => startRound()));
    socket.on('host:revealAnswer', guarded('revealAnswer', () => revealAnswer()));
    socket.on('host:skipRound', guarded('skipRound', () => skipRound()));
    socket.on('host:useHint', guarded('useHint', () => useHint()));

    socket.on('host:setSecretWord', guarded('setSecretWord', (payload, ack) => {
      reply(ack, setSecretWord(payload && payload.word));
    }));

    // Offline mode: the host types guesses straight in.
    socket.on('host:offlineGuess', guarded('offlineGuess', (payload, ack) => {
      const word = String((payload && payload.word) || '').toLowerCase().normalize('NFKD').replace(/[^a-z]/g, '');
      if (game.status !== 'live') return reply(ack, { ok: false, error: 'No round in progress.' });
      if (word.length !== game.wordLength) return reply(ack, { ok: false, error: `Guess must be ${game.wordLength} letters.` });
      reply(ack, submitGuess(word, 'Host'));
    }));

    socket.on('host:resetRoundLeaderboard', guarded('resetRoundLeaderboard', () => {
      game.roundScores.clear();
      broadcastState();
    }));
    socket.on('host:resetTotalLeaderboard', guarded('resetTotalLeaderboard', () => {
      game.totalScores.clear();
      broadcastState();
    }));
    socket.on('host:setLeaderboardShowSeconds', guarded('setLeaderboardShowSeconds', (payload) => {
      game.leaderboardShowSeconds = clampSeconds(payload && payload.seconds, DEFAULT_LEADERBOARD_SHOW_SECONDS);
      broadcastState();
    }));
    socket.on('host:setRevealShowSeconds', guarded('setRevealShowSeconds', (payload) => {
      game.revealShowSeconds = clampSeconds(payload && payload.seconds, DEFAULT_REVEAL_SHOW_SECONDS);
      broadcastState();
    }));
    socket.on('host:setStarterWord', guarded('setStarterWord', (payload) => {
      game.starterWord = setStarterWord('twistle', Boolean(payload && payload.on));
      broadcastState();
    }));
    socket.on('host:setStrictFit', guarded('setStrictFit', (payload) => {
      game.strictFit = setStrictFit('twistle', Boolean(payload && payload.on));
      broadcastState();
    }));
    socket.on('host:setRejectionToastSeconds', guarded('setRejectionToastSeconds', (payload) => {
      game.rejectionToastSeconds = clampSeconds(payload && payload.seconds, DEFAULT_REJECTION_TOAST_SECONDS);
      broadcastState();
    }));
  });

  // The shared dictionary is loaded once per server start (BLINDLE and TWISTLE
  // share it), so this returns straight away when BLINDLE already loaded it.
  await loadDictionary();

  console.log(
    `[twistle] registered on namespace /twistle. ${wordBankSize} secret words, ` +
      `${dictionaryState.wordCount.toLocaleString()} accepted guesses (${dictionaryState.source} list), ` +
      `${SYMBOL_POOL.length} symbols. ` +
      (SIGN_API_KEY
        ? 'Sign API key detected.'
        : 'WARNING: No EULERSTREAM_API_KEY set - TikTok connections will use the unreliable free/no-key path.')
  );

  return { diagnostics, game };
}
