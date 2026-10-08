# Update 27 - "Starter word" host switch in every word game, ON by default (on top of Update 26)

## What changed
Every word game now has **Settings -> Starter word** (CROSSDLE: Host panel -> "Starter word"), the same switch CODEDLE had.
- **ON (default):** each round opens with one automatic, random, never-winning starter word (worth no points, shown with the
  host's TikTok picture and the "Starter word" label) so chat has a first set of clues to read.
- **OFF:** each round starts on a blank board.
- Takes effect from the **next round**. The host's choice is remembered per game in `data/starter-word.json`
  (survives a server restart). A game the host never touched stays ON.

## How the starter word adapts to each game's own rules
| Game | Starter word gives chat... |
|---|---|
| BLINDLE | the green / yellow / red **counts** for a random word |
| ORACLE | the first set of **counts** (column colors stay unknown) |
| COLORBLINDLE | the first **color pattern** |
| COLORDLE | a word chosen to **fit the colored boxes** when possible (green / gray clue) |
| TEXTLE | the first **segment clues** (green / yellow / gray boxes) |
| RANGEDLE | the first **alphabet-distance colors** |
| STRUCTLE | the first pair of **numbers** (straight lines / curves) - never a word that would already solve the round |
| CODEDLE | the first **five-color clue** next to the number code |
| TWISTLE | the first **row of symbols** (which positions share a symbol) |
| CROSSDLE | the first **green / yellow / gray row** (with a hidden decoy, like any row) |
The starter word is never the secret word, so it can never be a free win, and it always agrees with the hidden word, so
Strict fit stays consistent.

## Behavior changes from Update 26 (on purpose)
- **TEXTLE, STRUCTLE and COLORDLE** had their starter word switched off in earlier updates. It is now **ON by default** again
  (as you asked); switch it off once in that game's Settings if you prefer the blank board - it is remembered.
- **BLINDLE, ORACLE, COLORBLINDLE, RANGEDLE, TWISTLE, CROSSDLE** always had a starter word; they now have the off switch.
- **CODEDLE's** switch no longer waits for the "Apply" button, and it is now remembered across server restarts.
- FLAGLE, TRAVLE and FINDLE are not letter-guess games and are unchanged.

## Files
NEW `server/shared/starter-word-store.js`; the server, page script and settings page of BLINDLE, ORACLE, COLORBLINDLE,
COLORDLE, TEXTLE, RANGEDLE, STRUCTLE, CODEDLE; `server/twistle/twistle.js`, `public/twistle/app.js`, `public/twistle/index.html`;
`server/crossdle/crossdle-engine.js`, `server/crossdle/crossdle.js`, `public/crossdle/app.js`, `public/crossdle/index.html`.

Deploy exactly like before (see DEPLOY_GUIDE.md): replace the repository contents with this folder and redeploy.
