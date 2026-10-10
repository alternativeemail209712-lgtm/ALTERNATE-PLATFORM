// ============================================================================
// CROSSDLE LIVE — game module
// Same game engine as the original standalone server.js, wrapped as
// registerCrossdle(app, rootIo) so it mounts on the platform's existing
// Express app + Socket.IO server instead of creating its own. Registered
// on its own Socket.IO namespace ("/crossdle") so its events never cross
// paths with any other game sharing this server, matching the
// Flagle/TRAVLE/Findle pattern.
// ============================================================================

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import { GameEngine, WORD_LENGTH_OPTIONS, NEXT_ROUND_DELAY_OPTIONS, getWordLanguage, getAnswerPool } from './crossdle-engine.js';
import { loadDictionary, getLoadInfo, getWordList } from './crossdle-dictionary.js';
import { Diagnostics } from './crossdle-diagnostics.js';
import { TikTokManager } from './crossdle-tiktok.js';
import { TestModeSimulator } from './crossdle-testMode.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function registerCrossdle(app, rootIo, options = {}) {
  const SIGN_API_KEY = process.env.EULERSTREAM_API_KEY || process.env.SIGN_API_KEY || process.env.TIKTOK_SIGN_API_KEY || '';
  const LEADERBOARD_FILE = path.join(__dirname, '..', '..', 'data', 'crossdle-leaderboard.json');

  const diagnostics = new Diagnostics();
  const io = rootIo.of('/crossdle');

  const engine = new GameEngine({
    onChange: () => {
      try {
        io.emit('game:update', engine.getPublicState());
      } catch (err) {
        diagnostics.logError('broadcast.gameUpdate', err);
      }
    },
  });

  loadLeaderboard();

  const tiktok = new TikTokManager({
    diagnostics,
    signApiKey: SIGN_API_KEY,
    onComment: handleIncomingComment,
    // Host's profile picture -> shown on the automatic starter-word row.
    onHostAvatar: (url) => {
      try {
        engine.hostAvatarUrl = url || null;
        io.emit('game:update', engine.getPublicState());
      } catch (err) {
        diagnostics.logError('broadcast.hostAvatar', err);
      }
    },
    onStatus: (status) => {
      try {
        io.emit('tiktok:status', status);
      } catch (err) {
        diagnostics.logError('broadcast.tiktokStatus', err);
      }
    },
  });

  // Load the real dictionary (300,000+ words) before accepting connections.
  await loadDictionary(diagnostics);
  {
    const info = getLoadInfo();
    console.log(`[crossdle:dictionary] Active source: ${info.source} (${info.totalWords.toLocaleString()} words)`);
  }

  const testMode = new TestModeSimulator(handleIncomingComment, () => {
    const len = engine.round ? engine.round.wordLength : engine.wordLength;
    return getWordLanguage() === 'en' ? getWordList(len) : getAnswerPool(len); // update 48: follow the word language
  });
  let testModeActive = false;

  function handleIncomingComment(username, text, source, avatarUrl) {
    try {
      diagnostics.recordIncoming({ username, text, source });
      io.emit('diagnostics:update', diagnostics.getPublicState());
      io.emit('chat:new', { username, text, source, avatarUrl: avatarUrl || null, ts: Date.now() });

      const result = engine.submitGuess(username, text, avatarUrl);
      if (result && result.recognized) {
        diagnostics.recordRecognized();
        io.emit('diagnostics:update', diagnostics.getPublicState());
      } else if (result && result.reason === 'not-a-word') {
        io.emit('guess:rejected', { username, guess: result.guess, ts: Date.now() });
      } else if (result && result.reason === 'no-fit') {
        io.emit('guess:rejected', {
          username,
          guess: result.guess,
          reason: 'no-fit',
          conflictIndex: result.conflictIndex,
          conflictWord: result.conflictWord,
          ts: Date.now(),
        });
      }
      if (result && (result.correct || result.roundOver)) {
        saveLeaderboard();
      }
    } catch (err) {
      diagnostics.logError('handleIncomingComment', err);
    }
  }

  function buildFullState() {
    return {
      game: engine.getPublicState(),
      diagnostics: diagnostics.getPublicState(),
      tiktokStatus: diagnostics.connection,
      testModeActive,
      wordLengthOptions: WORD_LENGTH_OPTIONS.filter((n) => n <= engine.getMaxWordLength()),
      nextRoundDelayOptions: NEXT_ROUND_DELAY_OPTIONS,
      signKeyConfigured: !!SIGN_API_KEY,
      dictionary: getLoadInfo(),
    };
  }

  function loadLeaderboard() {
    try {
      if (fs.existsSync(LEADERBOARD_FILE)) {
        const raw = JSON.parse(fs.readFileSync(LEADERBOARD_FILE, 'utf8'));
        if (Array.isArray(raw)) {
          for (const entry of raw) {
            if (entry && entry.username) {
              engine.leaderboard.set(entry.username.toLowerCase(), entry);
            }
          }
        }
      }
    } catch (err) {
      diagnostics.logError('loadLeaderboard', err);
    }
  }

  function saveLeaderboard() {
    try {
      fs.mkdirSync(path.dirname(LEADERBOARD_FILE), { recursive: true });
      fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify([...engine.leaderboard.values()]));
    } catch (err) {
      diagnostics.logError('saveLeaderboard', err);
    }
  }

  app.get('/crossdle/healthz', (req, res) => res.status(200).send('ok'));

  io.on('connection', (socket) => {
    try {
      socket.emit('state:full', buildFullState());
    } catch (err) {
      diagnostics.logError('socket.onConnectEmit', err);
    }

    socket.on('tiktok:connect', async (payload) => {
      try {
        const username = payload && payload.username;
        if (!username) return;
        if (testModeActive) {
          testModeActive = false;
          testMode.stop();
          io.emit('testMode:status', { active: false });
        }
        await tiktok.connect(username);
      } catch (err) {
        diagnostics.logError('socket.tiktok:connect', err);
      }
    });

    socket.on('tiktok:disconnect', () => {
      try {
        tiktok.disconnect();
      } catch (err) {
        diagnostics.logError('socket.tiktok:disconnect', err);
      }
    });

    socket.on('testMode:start', () => {
      try {
        testModeActive = true;
        testMode.start(() => (engine.round ? engine.round.answer : null));
        io.emit('testMode:status', { active: true });
      } catch (err) {
        diagnostics.logError('socket.testMode:start', err);
      }
    });

    socket.on('testMode:stop', () => {
      try {
        testModeActive = false;
        testMode.stop();
        io.emit('testMode:status', { active: false });
      } catch (err) {
        diagnostics.logError('socket.testMode:stop', err);
      }
    });

    socket.on('host:say', (payload) => {
      try {
        const text = payload && payload.text;
        if (!text) return;
        handleIncomingComment('HOST', text, 'host');
      } catch (err) {
        diagnostics.logError('socket.host:say', err);
      }
    });

    socket.on('host:startRound', () => {
      try {
        engine.startRound();
      } catch (err) {
        diagnostics.logError('socket.host:startRound', err);
      }
    });

    socket.on('host:skipRound', () => {
      try {
        engine.skipRound('skipped');
      } catch (err) {
        diagnostics.logError('socket.host:skipRound', err);
      }
    });

    socket.on('host:giveHint', () => {
      try {
        engine.giveHint();
      } catch (err) {
        diagnostics.logError('socket.host:giveHint', err);
      }
    });

    socket.on('host:revealAnswer', () => {
      try {
        engine.revealAnswer();
        saveLeaderboard();
      } catch (err) {
        diagnostics.logError('socket.host:revealAnswer', err);
      }
    });

    socket.on('host:setWordLength', (payload) => {
      try {
        const length = payload && payload.length;
        if (length) engine.setWordLength(length);
      } catch (err) {
        diagnostics.logError('socket.host:setWordLength', err);
      }
    });

    socket.on('host:setStarterWord', (payload) => {
      try {
        engine.setStarterWord(Boolean(payload && payload.on));
      } catch (err) {
        diagnostics.logError('socket.host:setStarterWord', err);
      }
    });

    socket.on('host:setKeyAutoColor', (payload) => {
      try {
        engine.setKeyAutoColor(Boolean(payload && payload.on));
      } catch (err) {
        diagnostics.logError('socket.host:setKeyAutoColor', err);
      }
    });

    socket.on('host:setWordLanguage', (payload) => {
      try {
        const changed = engine.setWordLanguage(payload && payload.mode);
        if (changed && engine.round && engine.round.status === 'active') engine.startRound(); // running word is in the old language
      } catch (err) {
        diagnostics.logError('socket.host:setWordLanguage', err);
      }
    });

    socket.on('host:setStrictFit', (payload) => {
      try {
        engine.setStrictFit(Boolean(payload && payload.on));
      } catch (err) {
        diagnostics.logError('socket.host:setStrictFit', err);
      }
    });

    socket.on('host:setNextRoundDelay', (payload) => {
      try {
        const seconds = payload && payload.seconds;
        if (seconds) engine.setNextRoundDelay(seconds);
      } catch (err) {
        diagnostics.logError('socket.host:setNextRoundDelay', err);
      }
    });

    socket.on('host:resetLeaderboard', () => {
      try {
        engine.resetLeaderboard();
        saveLeaderboard();
      } catch (err) {
        diagnostics.logError('socket.host:resetLeaderboard', err);
      }
    });

    socket.on('disconnect', () => {
      // Nothing to clean up per-socket — game state is global/shared.
    });
  });

  console.log(
    `[crossdle] registered on namespace /crossdle. ` +
      (SIGN_API_KEY
        ? 'Sign API key detected.'
        : 'WARNING: No EULERSTREAM_API_KEY set — TikTok connections will use the unreliable free/no-key path.')
  );

  return { diagnostics, engine };
}
