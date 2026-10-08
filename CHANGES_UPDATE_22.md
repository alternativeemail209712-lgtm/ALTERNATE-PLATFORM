# Update 22 - new game: RANGEDLE (on top of Update 21)

## What it is
A BLINDLE copy with a different clue. Every letter of a guess is colored by how far it is **along the
alphabet** (forward or backward, no wrap-around) from the letter in the same position of the hidden word:

| Color  | Meaning            |
|--------|--------------------|
| Red    | 1-5 away           |
| Orange | 6-10 away          |
| Yellow | 11-15 away         |
| Blue   | 16-20 away         |
| Purple | 21-25 away         |
| Green  | correct letter     |

## Screen (top to bottom)
floating rejection-message area -> numbered keyboard (1-26 above each key, keys turn green by
themselves once that letter was matched) -> color legend -> guess board.
No manual key coloring and no number-columns clue.

## Scoring (Live mode)
1 point for every guess placed on the board, 5 points for the guess that solves the round.

## Differences from BLINDLE (on purpose)
- Any real word of the right length is accepted (BLINDLE's "must fit every earlier clue" rule leaves
  almost no legal guesses with these precise colors). Host switch in Settings: **Strict fit**.
- A word already on the board is skipped (no point farming).
- Hints suggest the word that best fits the colors so far (never the answer).
- Runs on its own Socket.IO namespace `/rangedle` (like ORACLE), page at `/rangedle/`.

## Files
- NEW `server/rangedle/` (server + `public/` client). Reuses BLINDLE's word bank and dictionary.
- `server.js` mounts it; `public/index.html` has the new card; `public/shared/color-shades.js` and
  `game-chrome.css` have its colors/title style; `package.json` version 2.12.0.

## Deploy
Same as before: push to GitHub, Render redeploys. No new dependencies, no new environment variables.
