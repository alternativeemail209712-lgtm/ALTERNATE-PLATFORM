# Update 23 - new game: CODEDLE (on top of Update 22)

## What it is
A BLINDLE copy built on the SEQUENC-O idea. At the start of each round the board shows a **number code**; chat
guesses the hidden word behind it.

**The code:** each number is the position of that letter if the hidden word's letters were sorted alphabetically
(repeated letters are numbered left to right). Example: `tell` sorts to e-l-l-t, so its code is `4 1 2 3`.

**Tile colors**

| Color  | Meaning |
|--------|---------|
| Green  | correct letter in the correct spot |
| Yellow | the letter is in the word, but in the wrong spot |
| Blue   | the letter is close to the hidden letter of that spot (within 3 letters of the alphabet) |
| Pink   | meets both the yellow and the blue conditions |
| Gray   | the letter is not in the word |

Duplicates are counted like Wordle (greens use up their letter first, then yellows go left to right). The rules
were checked against every row of the SEQUENC-O screenshots (ADVERSARY, LIPID, BELLE, METAPHOR, VERSION, BALLET).

## Screen (top to bottom)
floating message window -> **color legend** -> self-coloring keyboard -> number code row -> guess board.
Nothing overlaps; the code numbers sit exactly above the tile columns.

## Keyboard
No manual coloring and no number-columns clue. Every key colors itself with the best color its letter has earned in
any guess this round (priority green > pink > yellow > blue > gray) and clears every round.

## Scoring (Live mode)
1 point for every guess placed on the board, 5 points for the guess that solves the round.

## Same as BLINDLE / RANGEDLE
Word bank, 370k dictionary, difficulty tiers, word length (fixed or random range), unlimited guesses and hints,
Live/Test/Offline, auto-continue, win celebration + leaderboards, TikTok avatars, engagement alerts.
Any real word of the right length is accepted; a word already on the board is skipped.
Settings: **Strict fit** (off by default) and **Starter word** (on by default). **Color shades** has all 5 colors.

## Also in this update
The board is now sized from the real height of the host-controls bar, so collapsing "Host controls" gives the
tiles more room.

## Files
- NEW `server/codedle/` (server + `public/` client). Reuses BLINDLE's word bank and dictionary (loaded once).
- `server.js` mounts it; `public/index.html` has the new card; `public/shared/color-shades.js` and
  `game-chrome.css` have its colors/title style; `package.json` version 2.13.0.

## Deploy
Same as before: push to GitHub, Render redeploys. No new dependencies, no new environment variables.
