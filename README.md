# TikTok LIVE Game Platform
> **Update 38:** HOME now has a platform-wide **Offline / Test / Live** switch (⚙️ Home settings → Mode), ONE shared TikTok connection for every game, and a floating connection window with detailed status and exact reasons. "Customize Game Cards" moved to ⚙️ Home settings → Cards - see `CHANGES_UPDATE_38.md`.
> **Update 32:** SHAPEDLE audience profile pictures are ticked automatically (untick or remove anyone), and the legend entries (order, text, colors) always apply - see `CHANGES_UPDATE_32.md`.
> **Update 31:** the legend settings are now called **LEGENDS SETTINGS**, with new positions (directly above / below the keyboard) and an exact rows x columns layout - see `CHANGES_UPDATE_31.md`.
> **Update 28:** new game SHAPEDLE (a row of cute symbols, one per letter, + green / yellow / gray clues, host-selectable symbol packs) at `/shapedle/` - see `CHANGES_UPDATE_28.md`.
> **Update 25:** **Strict fit** is now in every letter word game and ON by default (the host can switch it off per game in Settings; the choice is remembered) - see `CHANGES_UPDATE_25.md`.
> **Update 24:** every word game now has a customizable **color legend**, and the host's TikTok profile picture on the starter word is now 100% reliable (the server downloads and serves it) - see `CHANGES_UPDATE_24.md`.
> **Update 23:** new game CODEDLE (number code + green / yellow / blue / pink / gray letter clues) at `/codedle/` - see `CHANGES_UPDATE_23.md`.
> **Update 22:** new game RANGEDLE (letters colored by alphabet distance) at `/rangedle/` - see `CHANGES_UPDATE_22.md`.
> **Update 21:** TEXTLE now accepts any real word as a guess, even if it conflicts with earlier clues - see `CHANGES_UPDATE_21.md`.

One deployed link, a game-selector home screen, and **seven** independent
games — **Flagle Live**, **TRAVLE Live**, **Blindle**, **Findle Live**,
**CROSSDLE Live**, **TWISTLE Live**, and **Oracle** — each reading your TikTok LIVE
chat directly as guesses. You never touch code; follow `DEPLOY_GUIDE.md`.

> **Update 20:** the shared answer bank (used by BLINDLE, ORACLE, COLORBLINDLE, CROSSDLE, TWISTLE,
> COLORDLE, STRUCTLE and TEXTLE) grew from ~4,000 to ~8,600 words - see `CHANGES_UPDATE_20.md`.

## Layout

```
public/
  index.html        <- the game-selector home screen
  shared/           <- theme picker, one-time-login session, celebration
                       popup, shared fun extras, color shades (picker + 10-step ramps)
  flagle/           <- Flagle Live client
  travle/           <- TRAVLE Live client
  crossdle/         <- CROSSDLE Live client
  twistle/          <- TWISTLE Live client
server/
  env-bridge.js     <- mirrors the two TikTok-key env var names onto each
                       other; MUST be imported before any game module
  flagle.js         <- Flagle's server logic, Socket.IO namespace /flagle
  travle.js         <- TRAVLE's server logic, Socket.IO namespace /travle
  blindle/          <- Blindle's server logic + its own public/ client
                       folder, self-mounted at /blindle with its own
                       WebSocket path
  findle/           <- Findle's server logic + its own findle-public/
                       client folder, Socket.IO namespace /findle
  crossdle/         <- CROSSDLE's game engine, dictionary, TikTok manager
  oracle/           <- Oracle's server logic + its own public/ client folder,
                       mounted at /oracle, Socket.IO namespace /oracle
                       (imports BLINDLE's word bank + dictionary)
  twistle/          <- TWISTLE's game engine (imports BLINDLE's word
                       bank + dictionary directly), TikTok manager,
                       Socket.IO namespace /twistle
server.js           <- the ONE process Render runs — wires every game in
package.json        <- one shared dependency list (every game needs the
                       same handful of packages)
data/               <- small on-disk leaderboard/dictionary-cache files
                       some games save here (created automatically)
```

Each game is fully self-contained on the client side — its own HTML/CSS/JS
and its own TikTok connection UI. On the server side, five of the six
(Flagle, TRAVLE, Findle, CROSSDLE, TWISTLE) run on their own **Socket.IO
namespace** (`/flagle`, `/travle`, `/findle`, `/crossdle`, `/twistle`) so
their events never cross paths. Blindle instead opens its own **WebSocket**
server on a dedicated path (`/blindle-ws`) — a different real-time
technology, but still bound to the one shared HTTP server, so it coexists
safely with everything else.

TWISTLE is BLINDLE's sibling: it imports BLINDLE's curated secret-word
list, its 370,000+ word guess dictionary, and its difficulty-scoring engine
directly (literally the same files, the same in-memory word bank, loaded
only once even though two games use it), and follows BLINDLE's exact
points (10 for solving, 1 per guess that lands on the board, Live mode
only) and round-end celebration (winner → this round's top scorers →
all-time top scorers). Only the guessing mechanic itself is TWISTLE's own —
see "All six games" below.

### One-time login

Every game shares one TikTok username via `public/shared/session.js`
(stored in the browser's `localStorage`, this device only — there's no
account system, just a shared "who am I streaming as"). Connect once on
any game, and every other game pre-fills that username and auto-connects
the moment you open it — no re-typing, no re-clicking Connect, when you
switch games mid-broadcast. Typing a different username on any game's
connect screen updates it everywhere the next time you switch.

### Theme system

All six share the same platform **theme picker** (cream / sky blue /
meadow green / blossom pink / lavender violet / honey gold) via
`public/shared/theme.css` + `theme.js` — pick a color on any page and it
carries over to the rest via `localStorage`. Each game keeps its own
signature accent colors (Blindle's gold/coral, Findle's leaf/citrus/berry,
CROSSDLE's decoy-blue/green/yellow tiles, etc.) — only the backgrounds,
panels, borders and body text follow the shared theme. Each theme now
defines three visibly distinct tonal steps (page background → card →
nested/secondary panel) plus a shared elevation shadow, so panels actually
separate from the page instead of blending into it, and every bright
accent color used as text (not just as a background/border) has a
dedicated darker "-text" variant so it stays readable against a light
background instead of the dark backgrounds these games originally shipped
with.

They also share one TikTok sign-in key. Some of the original games used
the env var name `TIKTOK_SIGN_API_KEY`, others used `EULERSTREAM_API_KEY`
— both names refer to the same EulerStream key, and `server/env-bridge.js`
mirrors whichever one you set onto the other, so you only need to set
**one** environment variable in Render. This file is deliberately the
*first* thing imported in `server.js` — ES module imports are hoisted and
evaluated before the importing file's own code runs, and several games
read their key from `process.env` at their own module-load time, so the
mirroring has to happen before those modules load or it's too late to help.

## Engagement alerts (Gifts, Likes, Shares) — every game

On top of each game's own mechanics, the whole platform shares one
**Engagement** layer (`server/engagement/`, `public/shared/engagement.js`)
that watches whichever game currently has a live TikTok connection and
shows on-screen alerts for gifts, likes, and shares — no per-game setup
needed, it's already wired into all six games.

- **Gift combos** (holding down a rose, etc.) are buffered until the combo
  actually finishes, so a 10x rose doesn't fire ten separate alerts.
- **Individual milestones** — a specific viewer hitting 100/300/500/700/
  1k/2k/3k/4k/5k/10k+ likes (this session), or sharing the LIVE, gets a
  personalized alert with their name and profile picture (when TikTok
  provides one).
- **Room milestones** — the whole session's cumulative likes/shares
  crossing a big round number (1k, 10k, 100k, ...) gets a bigger,
  confetti-tier alert.
- **A queue, not a stack** — alerts show one at a time for ~3.5 seconds
  each, so a burst of simultaneous events never piles up or breaks the UI.
- **Host tools live inside each game's Settings** (⚙️ — for CROSSDLE, the
  Host panel), under **Live event tools**, so nothing floats over the game
  while you're streaming. There you'll find a 📊 live statistics readout —
  Total Gifts / Coins / Shares / Likes since the server started (the same
  "raw payload" logging style already used elsewhere on this platform is
  written to the server log) — and a 🧪 **host-only Test Event panel**:
  Fake Gift / Fake Share / Fake Milestone / Fake Room Milestone buttons
  that run the exact same code real events do, so you can check the
  animations look right without ever going live.
- **Gift values are shown in coins**, the way TikTok prices gifts (e.g.
  "500 coins"), and a gift worth 500+ coins gets the confetti-tier alert.

Like the rest of the platform, there's no account system — the statistics
and test buttons are just part of the Settings screen, the same trust
model as every other host control already on these screens.

## Running it locally (optional — most people can skip straight to Render)

```bash
npm install
cp .env.example .env   # then paste your EulerStream key into .env
npm start
```

Then open `http://localhost:3000` in a browser.

## Deploying for real

See `DEPLOY_GUIDE.md`.

## Sharing with a co-host

She opens your link, picks a game, and connects her own TikTok username
(this overwrites the saved one-time-login username on her own browser
only — it's stored per-device, not shared between people). Flagle,
CROSSDLE, and TWISTLE support both of you hosting *simultaneously* on the
same link (each browser tab gets its own independent connection). TRAVLE,
Blindle, and Findle currently support **one active TikTok connection at a
time per game** — if you're both live on the same one of those at the exact same
moment, the second person's connect takes over from the first. Not a bug
to fix urgently — just tell me if you'd like any of those upgraded to
Flagle's per-host model later.

## Host picture on the starter word

Every game that opens a round with an automatic "starter word" (BLINDLE, ORACLE, COLORBLINDLE, COLORDLE,
STRUCTLE, TEXTLE, RANGEDLE, CODEDLE, TWISTLE and CROSSDLE) shows the TikTok profile picture of the **host of the
current LIVE session** (the account the game is connected to) in the starter word's circle.
Shared logic: `server/shared/host-avatar.js`.

Since update 24 the **server downloads the picture itself** and serves its own copy at `/host-avatar/<username>`, so
the browser never depends on TikTok's CDN (which used to fail for some hosts: .heic files, expired links, blocked
hot-links). It looks for the picture in this order and keeps retrying for a few minutes: the room info from the connect
call, a fresh room-info request, the host's public TikTok profile page, and finally the host's own chat messages.
Troubleshooting: open `/host-avatar-status/<username>` on your site to see whether the server has the picture.
It goes back to the plain colored circle in Test/Offline mode or after Disconnect.

## Strict fit on every word game (update 25)

Every letter word game (BLINDLE, ORACLE, COLORBLINDLE, COLORDLE, STRUCTLE, TEXTLE, RANGEDLE, CODEDLE, TWISTLE, CROSSDLE) has a
**Strict fit** switch in its Settings (CROSSDLE: Host panel). It is **ON by default**; the host can turn it off per game, applies
instantly, and is remembered in `data/strict-fit.json` (`server/shared/strict-fit-store.js`). ON = a guess must still fit the
clues already on the board, using that game's own rules (see the table in `CHANGES_UPDATE_25.md`); OFF = any real word of the right
length is accepted. The hidden word always passes, and a guess that doesn't fit is skipped with a short on-screen reason.

## Color legend on every word game (update 24)

Each word game shows a small legend explaining what every color means (like RANGEDLE's). By default it sits
directly under the floating message window and above the keyboard and the guess board; nothing overlaps - the board
simply uses the height that is left (and the legend auto-shrinks if it ever gets too tall).
Open **Settings -> LEGENDS SETTINGS** to change: show/hide, position (top / directly above the keyboard / directly below the keyboard / just above the board / below the board),
alignment, title, the text and the chip text of every entry, the order of the entries (arrows), which entries show,
custom entries and colors, overall size, chip size, row and column spacing, maximum width, font, chip shape, an exact **rows x columns** grid (quick layouts, fill order, what to do with extra entries),
background panel, and Auto-fit. Changes apply instantly and are shared by every screen connected to that game.
Files: `public/shared/legend.js` + `legend.css` (the legend, its defaults per game and the settings panel) and
`server/shared/legend-hub.js` (Socket.IO namespace `/legends`; saved in `data/legends.json`).

## Codedle (new)

**Codedle** - a BLINDLE copy built on the SEQUENC-O idea (copied from RANGEDLE's board, keyboard and scoring
structure). Same platform machinery: word bank, 370k-word dictionary, difficulty tiers, unlimited guesses,
Live/Test/Offline, hints, leaderboards, celebration, engagement alerts, color shades.

- **The code.** Each round the board shows a row of numbers, one per letter of the hidden word. A number is that
  letter's place if the word's letters were **sorted alphabetically** (repeats numbered left to right).
  `tell` -> e l l t -> code **4 1 2 3**. The numbers sit exactly above the tile columns.
- **Tile colors** (per letter, Wordle-style duplicate counting: greens first, then yellows left to right):
  **green** right letter, right spot - **yellow** in the word, wrong spot - **blue** within 3 letters of the hidden
  letter of that spot (and not in the word) - **pink** both yellow and blue - **gray** not in the word.
- **Legend** (what each color means) sits directly under the floating message window and above the board.
  Screen order: floating message -> legend -> keyboard -> code row -> guess board (nothing overlaps).
- **Self-coloring keyboard.** No manual coloring. Each key takes the best color its letter earned in any guess this
  round: green > pink > yellow > blue > gray. No number columns clue.
- **Scoring (Live):** 1 point for every guess placed on the board, 5 points for the guess that solves the round.
- A word already on the board is skipped. Settings: **Strict fit** (BLINDLE's "must fit every earlier clue" rule, **on by default since
  update 25**; switch it off to accept any real word) and **Starter word** (on by default, like BLINDLE).
- Hints suggest a word with the same code (when one exists) that best fits the colors so far - never the answer.

Files: `server/codedle/codedle-server.js` + its own `public/` client folder, mounted at `/codedle/` on Socket.IO
namespace `/codedle`. Clue logic lives in `buildCode()` and `scoreClue()` at the top of the server file.

## Shapedle (new)

**Shapedle** - a BLINDLE copy built on the SHAPE-O idea (board, keyboard, hints and scoring copied from CODEDLE).

- **The symbol row.** Each round a row of cute symbols appears above the board, one per letter of the hidden word. Every
  distinct letter has its own symbol and a repeated letter repeats its symbol (`cascade` -> star heart square star heart
  triangle circle). The row only reveals which positions hold the same letter.
- **Tile colors** (Wordle-style duplicate counting): **green** right letter, right spot - **yellow** in the word, wrong spot -
  **gray** not in the word.
- **Self-coloring keyboard** (no manual coloring, no number columns): each key takes the best color its letter earned in any
  guess this round (green > yellow > gray). The host can switch it off (Settings -> Auto-color keyboard keys).
- **Symbols (host choice):** Settings -> Symbols - Cute Faces (default), Plush Toys (TWISTLE's), Classic Shapes, Animals,
  Sweets & Fruit, Sky & Garden, or "Surprise me" (a different pack every round). Applies right away; remembered in
  `data/symbol-pack.json`.
- **Scoring (Live):** 1 point for every guess placed on the board, 5 points for the guess that solves the round.
- Settings: **Strict fit** (on by default: the guess must repeat letters like the symbol row AND fit every earlier color),
  **Starter word** (on by default), **Auto-color keyboard keys** (on by default).

Files: `server/shapedle/shapedle-server.js` + its own `public/` client folder, mounted at `/shapedle/` on Socket.IO namespace
`/shapedle`. Clue logic lives in `scoreClue()` / `buildSymbolRow()` / `patternKey()` at the top of the server file; the artwork
is `server/shapedle/public/shapedle-symbols.js`.

## Colorblindle (new)

**Colorblindle** — modelled on COLORBLIND-O, built on BLINDLE's platform machinery
(word bank, 370k-word dictionary, difficulty tiers, unlimited guesses, clue-consistency
check, points, leaderboards, celebration, Live/Test/Offline, hints, engagement alerts).
What's different:

- Every round each letter A-Z is secretly given one of **four colors** (red / blue /
  yellow / purple), **reshuffled every round**. The on-screen keyboard is painted with them,
  so there is no manual coloring / scratchpad here.
- A row of four numbers shows **how many letters of each color** the hidden word contains
  (repeated letters count every time).
- Guess feedback is **green** (right letter, right spot) or **gray** (incorrect). No yellow tier.
- A guess is accepted only if it has the **same color counts** as the hidden word and
  reproduces the **green/gray pattern of every earlier guess**; otherwise a short rejection
  note is shown. Hints follow the same rule and never reveal the answer.

Files: `server/colorblindle/colorblindle-server.js` + its own `public/` client folder,
mounted at `/colorblindle/` on Socket.IO namespace `/colorblindle` (imports BLINDLE's
word bank, dictionary and difficulty engine - loaded only once).

## Colordle (new)

**Colordle** — a sibling of Colorblindle (copied from it), modelled on COLOR-O. Same
platform machinery, same shuffled 4-color keyboard (red / blue / yellow / purple,
**reshuffled every round**) and same green / gray tile feedback. What's different:

- **No color counts are shown.** Instead the board shows a row of **empty colored boxes**,
  one per letter of the hidden word. Box *i* wears the color of the hidden word's *i*-th letter.
- Viewers read the keyboard to see which letters wear each color, then guess a word whose
  letters fit the boxes (e.g. red, purple, blue, red, yellow).
- After each guess the letter boxes turn **green** (correct) or **gray** (incorrect).
- A guess is accepted only if **every letter wears the color of the box it sits in** and it
  reproduces the green/gray pattern of every earlier guess; otherwise a short rejection note
  names the offending box. Hints follow the same rule and never reveal the answer.
- **No starter word:** every round begins with just the empty colored boxes (the automatic first guess other games use is switched off for Colordle only).
- **Color shades (update 16):** Settings → *Color shades* now covers **every color in the game** - red, blue, yellow and purple (keyboard keys + empty boxes) **plus the green and gray** of the guess tiles - with **10 shades each** (lightest → darkest, shade 5 = Standard). See *Color shades on every game* below.
- When a round is given up, the boxes fill in with the answer.

Files: `server/colordle/colordle-server.js` + its own `public/` client folder, mounted at
`/colordle/` on Socket.IO namespace `/colordle`. Colorblindle is unchanged and still at `/colorblindle/`.

## Structle (new)

**Structle** — a sibling of Blindle modelled on MORPH-O. Same platform machinery (word bank,
370k-word dictionary, difficulty tiers, unlimited guesses, clue-consistency check, leaderboards,
celebration, Live/Test/Offline, hints, engagement alerts). What's different:

- Every capital letter is made of **straight lines** and **curves** (A = 3 straight, S = 1 curve,
  P = 1 straight + 1 curve …). The full table is `LETTER_SHAPES` at the top of the clue helpers in
  `server/structle/structle-server.js` (mirrored for display in `structle-game.js`). It reproduces
  every clue in the MORPH-O screenshots; edit it if you want to tweak a letter (G, J, Q are the
  judgement calls).
- Each guess shows **two number columns** instead of Blindle's three colored ones: the first
  (— symbol) is the *difference in total straight lines* between the guess and the hidden word, the
  second (curve symbol) the *difference in total curves*. Always 0 or more.
- **You win when both numbers are 0** — the guess has exactly the same total straight lines and curves
  as the hidden word. It does *not* have to be the hidden word: any real word meeting both totals is
  accepted and earns **1 point**. Other valid guesses earn nothing.
- **No keyboard and no manual coloring.** **Starter word removed (update 15):** a Structle round now opens on a blank board - the automatic random first guess is switched off for Structle. With **Strict fit** on (the default since update 25) a guess must give the same two numbers as every earlier guess; with it
  switched off, **any real word of the right length is accepted** so viewers can test any word. A word already guessed this round is not added again:
  a short **"Already guessed"** note appears with the two numbers that word got (duration set in Settings).
  Words not in the dictionary or of the wrong length are ignored. Hints still suggest a word that fits every clue so far and never one that would already win.
- Number highlighting: a lone 0 stays plain. The row (tiles and both numbers) only turns green when **both** numbers are 0.
- When a round is given up, the answer and its totals are shown. The how-to-play window includes the letter chart.

Files: `server/structle/structle-server.js` + its own `public/` client folder, mounted at `/structle/`
on Socket.IO namespace `/structle`.

## Color shades on every game (update 16)

Every game's host settings now has a **Color shades** section. For each color the game really uses, the host
picks one of **10 shades** (lightest → darkest; the 5th is always the original "Standard" look). It applies
instantly (no new round), and **every screen connected to that game changes together** (e.g. the host page and
an OBS browser source). **Reset all to standard** is at the bottom of each section.

| Game | Colors you can shade |
|---|---|
| Flagle | green (correct/win), orange-red (wrong), gold (accent), blue (live/chat), purple (hints), pink (gifts/timer) |
| TRAVLE | start & target, shortest path, accepted guess, wrong guess, land (not guessed) - globe, trail, chips and legend all follow |
| Blindle | green, yellow, red (tiles + keyboard) |
| Findle | green (found), orange (score/emphasis), red (alerts), blue (info) |
| CROSSDLE | green, yellow, gray (tiles, keys, chips) |
| TWISTLE | green, yellow, red |
| Oracle | green, gold, red (count badges) |
| Colorblindle / Colordle | red, blue, yellow, purple + green (hit) + gray (miss) |
| Structle | green (a clue of 0 / solved row) |
| Textle | green, yellow, gray (segments + keyboard) |

How it works (files): `public/shared/color-shades.js` (the color lists per game, the 10-step ramps, the picker and the
live sync), `public/shared/color-shades.css` (picker look), `server/shared/color-shades-hub.js` (Socket.IO namespace
`/shades`; remembers each game's choices in `data/color-shades.json` so they survive a restart where the disk is kept).
To give a **new game** shades: add its colors to `GAMES` in `color-shades.js`, add
`<script src="/shared/color-shades.js" data-game="yourgame"></script>` to its page and a `<div data-color-shades></div>` to its
settings. Text on every colored tile switches between dark and white automatically so it stays readable at every shade.

## Textle (new)

**Textle** — an ARRANG-O-style sibling of Blindle (same word bank, 370k-word dictionary, difficulty tiers,
unlimited guesses, clue-consistency check, points, leaderboards, celebration, Live/Test/Offline, hints,
engagement alerts). What's different:

- **Segment clues instead of color counts.** Every guess is cut into colored segments:
  **green** = the letters match *and* their order corresponds to the hidden word (letters that sit side by side
  in both words share one box); **yellow** = the letter is in the word but must be rearranged; **gray** = the letter
  is not in the word, or every copy of it is already used up (neighbouring grays merge into one box).
  A green segment at the very **start/end** of the guess gets a **rounded edge** when it also starts/ends the hidden word.
- How the green letters are chosen (`computeClue` in `server/textle/textle-server.js`): the longest set of guess
  letters that appear in the hidden word in the same left-to-right order; ties prefer matches that are side by side in
  both words, then earlier letters. Remaining letters are yellow while the hidden word still has an unused copy, else gray.
  This reproduces every row in the ARRANG-O screenshots.
- **The keyboard colors itself** (display-only, no manual coloring). **Update 16: strictly two rows of 13 keys (A-M on top, N-Z below).** To change the letter order, edit `KEYBOARD_ROWS` in `server/textle/public/textle-game.js` (keep both rows the same length): a letter is green once it was green in any
  guess, yellow once it was yellow (and never green), gray once it has only ever been gray. Clears every round.
- **Word length:** random 4-15 letters every round by default; Settings → Word length lets the host choose any range
  (or a fixed length) from 4 up to 20 letters. Answer pools for 11-20 letters were enlarged (`server/textle/textle-answers.js`).
- Like Blindle, a guess must still fit every earlier clue. **Update 16: no starter word** - every round opens on a blank board.
  (To bring the automatic first guess back, set `STARTER_WORD_ENABLED = true` in `textle-server.js`.)
- **Update 16: the guessed tiles are centered** on the board; each guesser's avatar stays pinned to the left edge.
- **Color shades:** Settings → *Color shades* (green, yellow, gray; 10 shades each).

Files: `server/textle/textle-server.js` + `textle-answers.js` + its own `public/` client folder, mounted at `/textle/`
on Socket.IO namespace `/textle`. Blindle is unchanged.

## Oracle (new)

**Oracle** — inspired by SEER-O, and identical to Blindle in every way (word
bank, dictionary, difficulty tiers, unlimited guesses, clue-consistency check,
points, leaderboards, celebration, Live/Test/Offline, hints, engagement alerts)
except the clue columns: the three number columns are **shuffled at the start
of every round** and stay **uncolored** — chat has to work out which column is
green, yellow and red. The colors are only revealed once the round ends (word
guessed, or host gives up). The server never sends the color mapping to browsers
mid-round. Runs on Socket.IO namespace `/oracle` at `/oracle/`.

Host scratchpad in Oracle: on top of the click-to-mark letters/keyboard, the
host can also click any number to mark its **whole column** red / yellow /
green / none (the columns keep the same meaning all round). All manual colors
(letters, keys, columns) are cleared automatically when a new round begins.
Oracle never auto-colors anything - that would give away which column is which.

Blindle scratchpad: a guess showing 0 green and 0 yellow means every letter in
it is red, so those letters/keys are painted red automatically (once - the host
can still change them by hand). All manual + automatic colors are cleared when
a new round begins. The server sends a per-round counter (`roundNumber`) so the
page knows exactly when that happens.

## All six original games, briefly

**Flagle Live** — guess the blurred flag before time runs out; the flag
sharpens continuously and wrong guesses add a distance-and-direction hint.
Live top-10 ticker, Top Likes/Gifters tabs, host hint button, celebration
animation, full-screen toggle. 198 countries including Palestine.

**TRAVLE Live** — two random countries are picked; chat calls out any
country that could form a land-border chain between them, building inward
from both ends, no guess limit. Scored 3/1/0 points depending on whether
the guess is on the shortest path, a valid-but-longer connection, or
neither. Real country shapes on a draggable, zoomable 3D globe.

**Blindle** (formerly WORD500) — chat deduces a hidden word (4-20
letters, host-tunable) from green/yellow/red **count** clues alone — never
which letter is where. Unlimited guesses, a scored difficulty engine
(Normal/Medium/Hard/Random) picks how tricky the secret word is, and a
370,000+ word dictionary checks every guess for validity.

**Findle Live** — a themed word-search grid; chat calls out hidden words
as they spot them in any of 8 directions. A letter only clears once every
word using it has been found, consecutive finds build a combo multiplier,
and a synthesized sound effect plays on every find (host-side, no audio
files to host). The grid stays a true, fixed-shape square at any screen
size, including full screen.

**CROSSDLE Live** — an "ambiguous Wordle": after every guess, a *second*,
hidden decoy word is also chosen, and a tile turns green if it matches the
real answer **or** the decoy — so a green tile is a clue, never proof.
Both the real answer and the decoy word are drawn from the same curated,
always-recognizable word list Blindle uses (not the full 370,000+ word
dictionary, which is still used to validate that a viewer's guess is a
real word) — so the word chat is solving is never an obscure dictionary
entry nobody would guess. Unlimited guesses, no clock, a round runs until
it's solved or the host skips/reveals it.

**TWISTLE Live** — BLINDLE's sibling: the SAME curated word bank, 370,000+
word dictionary, difficulty tiers (Normal/Medium/Hard/Random), and points
(10 for solving, 1 per guess, round + all-time leaderboards with TikTok
profile pictures), but a different clue: each round draws 3 mystery
symbols, each secretly meaning "right spot", "wrong spot", or "not in your
guess" — nobody's told which is which. Every guess that lands on the board
gets a row of symbols describing the SECRET word's letters (not the
guess's), and the tiles' true colors only reveal once the round ends.
Unlimited guesses, host-tunable word length (fixed or random range),
unlimited hints, Live/Test/Offline modes, full TikTok engagement alerts.

Full details for each game's own mechanics are documented inside that
game — tap **?** / **How to Play** on its own screen.


## Update 29
SHAPEDLE Settings -> Symbols: tick several symbol sets (new: Flags, Professions, Sports, Transport), color intensity / brightness / size, animation, and use selected viewers' round TikTok profile pictures as symbols (saved even after they leave). See `CHANGES_UPDATE_29.md`.

## Update 30
HOME page: the top-left banner now reads **"<HOST NAME> LIVE GAMES"** with the host's round TikTok picture while a TikTok host is connected (any game), and every game card can be restyled from the 🎛️ button (colors, border, corners, 3D edge, font, words, hide, reorder). See `CHANGES_UPDATE_30.md`.
