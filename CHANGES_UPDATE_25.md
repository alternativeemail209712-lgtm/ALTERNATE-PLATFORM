# Update 25 - STRICT FIT on every word game, ON by default (on top of Update 24)

## What changed
1. **RANGEDLE and CODEDLE: Strict fit is now ON by default.** (It used to be off.) The host can still switch it off in
   Settings -> **Strict fit**, and it applies right away without restarting the round.
2. **Strict fit now exists in every letter word game**, each one applying it to its *own* clues, and **ON by default**.
   Settings -> **Strict fit** (a switch, same place and look in every game; in CROSSDLE it is in the Host panel).
3. **The host's choice is remembered.** It is saved per game in `data/strict-fit.json`, so a server restart does not
   quietly turn Strict fit back on. A game the host never touched stays ON.

## What "fits" means in each game
| Game | With Strict fit ON, a guess is accepted only if... | With Strict fit OFF |
|---|---|---|
| BLINDLE | it gives the same green / yellow / red **counts** as every guess already on the board (this was already BLINDLE's rule - it is now a switch) | any real word of the right length |
| ORACLE | it fits every earlier clue under **at least one column-color order** (the order may differ from clue to clue, because nobody knows which column is which) - unchanged rule, now a switch | any real word |
| COLORBLINDLE | it has the same **color counts** as the hidden word AND reproduces the **green / gray pattern** of every earlier guess | any real word |
| COLORDLE | every letter wears the **color of the box** it sits in AND it reproduces the green / gray pattern of every earlier guess | any real word |
| STRUCTLE | it would have given the **same two numbers** (straight lines / curves) as every earlier guess | any real word |
| TEXTLE | it agrees with the **segment clues** (green / yellow / gray boxes) of every earlier guess | any real word |
| RANGEDLE | it fits the **alphabet-distance colors** of every earlier guess | any real word |
| CODEDLE | it fits the **green / yellow / blue / pink / gray** colors of every earlier guess | any real word |
| TWISTLE | it **groups the letter positions the same way** as every earlier symbol row (which positions share a symbol). Nobody knows what the symbols mean, so the meanings may be assigned differently for each row - accepting or rejecting never gives the answer away | any real word |
| CROSSDLE | it is still a **possible answer**: for every earlier row, some decoy word could explain the tiles that were shown (the decoy is secret, so the test is "could a decoy explain it?") | any real word |

In every game the **hidden word always passes** Strict fit, so the round can always be won.
A guess that doesn't fit shows the short rejection message (how long it shows is still set in Settings) and is skipped -
it is not added to the board and earns no points.
FLAGLE, TRAVLE and FINDLE are not letter-guess games and are unchanged.

## Things that behave differently from Update 24 (on purpose)
- **TEXTLE, STRUCTLE and TWISTLE** used to accept any real word. With Strict fit ON by default they now only accept guesses
  that fit the earlier clues. If you prefer the old open behavior, switch Strict fit off in that game's Settings once - it is remembered.
  The old TEXTLE environment variable `TEXTLE_STRICT_CLUES` is no longer used (the Settings switch replaces it).
- **A word already on the board is now skipped silently in every word game** (it used to show a "conflicts" note in the
  BLINDLE-style games). This also stops one viewer farming the 1-point-per-guess reward by repeating a word. STRUCTLE keeps
  its own "Already guessed" note.
- With Strict fit ON the number of acceptable words shrinks quickly after a few guesses (that is the point of the rule). If a
  round feels too quiet on stream, switch Strict fit off for that game.

## Files
- NEW `server/shared/strict-fit-store.js` (the on/off switch per game, saved in `data/strict-fit.json`)
- CHANGED the 8 `server/<game>/<game>-server.js` files (blindle, oracle, colorblindle, colordle, structle, textle, codedle, rangedle),
  `server/twistle/twistle.js`, `server/crossdle/crossdle-engine.js` and `server/crossdle/crossdle.js`
- CHANGED the matching pages: `server/<game>/public/<game>-index.html` + `<game>-game.js` (new Strict fit switch, how-to-play text),
  `public/twistle/index.html` + `app.js`, `public/crossdle/index.html` + `app.js`
- `package.json` version 2.15.0

## Deploy
Same as before: push to GitHub, Render redeploys. No new dependencies, no new environment variables.
(`data/strict-fit.json` is created automatically the first time a host changes a switch. On a host with a temporary disk
the choice lasts until the next redeploy; after that the games start with Strict fit ON again.)
