# Update 28 - NEW GAME: SHAPEDLE (on top of Update 27)

Play it at `/shapedle/` (Socket.IO namespace `/shapedle`). It is a copy of BLINDLE's platform machinery (via CODEDLE's board, keyboard,
hints and scoring) built on the SHAPE-O idea.

## How it plays
- **The symbol row.** Each round a row of cute symbols appears above the board - one per letter of the hidden word. Every distinct letter
  has its own symbol and a repeated letter shows the same symbol again (`cascade` -> star heart square star heart triangle circle).
  The row reveals only which positions hold the same letter, never the letters.
- **Clues** (classic Wordle duplicate counting): **green** right letter, right spot - **yellow** in the word, wrong spot -
  **gray** not in the word.
- **Self-coloring keyboard.** No manual coloring and no number columns. Every key takes the best color its letter has earned in any
  guess this round (green > yellow > gray). The host can switch it off (Settings -> Auto-color keyboard keys, ON by default).
- **Scoring (Live):** 1 point for every guess that fits the board, 5 points for the guess that solves the round.
- **Strict fit** (ON by default): a guess must repeat letters exactly like the symbol row AND fit the colors of every earlier guess.
  Off = any real word of the right length. The hidden word always passes.
- **Starter word** (ON by default): the round opens with one free, never-winning word - chosen with the same letter pattern as the
  symbol row when possible. Host can switch it off.
- Hints (unlimited) suggest a word with the same letter pattern that best fits the colors so far - never the answer.
- Same as every word game: Live / Test / Offline, difficulty tiers, word length 4-20 (fixed or random range), host-set secret word,
  auto-continue, win celebration, leaderboards, color shades, customizable color legend, host profile picture on the starter row.

## Host choice of symbols (Settings -> Symbols)
Applies right away on every connected screen, even mid-round, and is remembered in `data/symbol-pack.json`.
| Pack | Look |
|---|---|
| **Cute Faces** (default) | hand-drawn kawaii shapes with little faces (13 shapes x 2 colors) |
| **Plush Toys** | TWISTLE's squishy plush toys (+ cute shapes for the rest) |
| **Classic Shapes** | flat colored shapes like the original SHAPE-O |
| **Animals** | cute animal emoji |
| **Sweets & Fruit** | yummy treat emoji |
| **Sky & Garden** | stars, flowers, rainbows... |
| **Surprise me** | a different pack every round |
Every pack has 26 symbols, so a word with any number of different letters always works.

## Files
NEW `server/shapedle/` (server + `public/` page, styles, script, `shapedle-symbols.js` artwork) and `server/shared/symbol-pack-store.js`.
Registered in `server.js`, the home screen (`public/index.html`), `public/shared/color-shades.js`, `public/shared/legend.js`,
`public/shared/game-chrome.css`, `README.md`, `DEPLOY_GUIDE.md`, `package.json`.

Deploy exactly like before (see DEPLOY_GUIDE.md): replace the repository contents with this folder and redeploy.
