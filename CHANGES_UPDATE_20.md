# Update 20 - Much larger answer pool for all word games (on top of Update 19)

Games affected: BLINDLE, ORACLE, COLORBLINDLE, CROSSDLE, TWISTLE, COLORDLE, STRUCTLE, TEXTLE
(all of them draw their secret words from the shared bank in `server/blindle/blindle-answers.js`).

## What changed
- **Answer bank: ~3,976 -> 8,643 words** (4-20 letters). Per length: 4-letter 1,096 / 5-letter 1,274 /
  6-letter 1,269 / 7-letter 1,238 / 8-letter 1,106 / 9-letter 838 / 10-letter 719 / 11-letter 443 /
  12-letter 291 / 13-letter 169 / 14-letter 82 / 15-letter 58 (16-20 unchanged, very few everyday words exist).
- The bank is split into **CORE_WORDS** (original curated words + a large batch of very familiar everyday words:
  animals, foods, objects, nature, jobs, feelings, verbs...) and **EXTENDED_WORDS** (real, fair, but less
  everyday words). `ANSWER_WORDS` keeps the same shape, so no game's code needed to change.
- **CROSSDLE** now reads the shared bank (`crossdle-answers.js` re-exports it) so it gets the bigger pool too.
- **TEXTLE** merges the bigger shared bank with its own extra long words automatically.
- Every possible answer is now always an accepted guess (`blindle-dictionary.js`, `crossdle-dictionary.js`),
  even if the big online dictionary failed to download and the game is on its small offline fallback list.

## Difficulty engine (`server/blindle/blindle-difficulty.js`)
- **Fast**: the old look-alike scoring would have taken minutes with thousands of words per length. It now uses
  letter bit-masks and finishes in about 0.1 s for the whole bank. Results are cached, so games sharing the
  bank only pay once at startup.
- **Fair tiers**: look-alike ambiguity is now a percentile within each length, and NORMAL / MEDIUM / HARD are
  cut by share of each length's own score range (easiest 40% / middle 38% / hardest 22%). Before, HARD was
  empty for almost every length and silently fell back to "any word"; now HARD is a real, distinct tier.
- Words from EXTENDED_WORDS get a small familiarity penalty, so NORMAL rounds lean friendly while HARD and
  RANDOM rounds give strong players more of a challenge. Tune with `DIFFICULTY_SHARES` and `DIFFICULTY_WEIGHTS`.

## Safety / quality filtering
New words exclude abbreviations, proper names, technical jargon, lazy "+s" plurals, and sexual, drug,
slur and violence-related terms (the existing Crossdle blocklist plus an extra list applied when the bank was built).

## Deploy
Same as before: push to GitHub, Render redeploys. No new dependencies, no new environment variables.
