# TikTok LIVE Game Platform — Complete Setup Guide (No Coding Required)

This guide assumes you have never written code and will never touch code
directly. You will do three things: (1) get one free key, (2) upload a
folder to GitHub, (3) click some buttons on Render. That's it — one setup
covers all fourteen games (Flagle Live, TRAVLE Live, Blindle, Findle Live,
CROSSDLE Live, TWISTLE Live, Oracle, Colorblindle, Colordle, Structle, Textle, Rangedle, Codedle, Shapedle).

---

## Part 0 — What you're about to set up

- **GitHub** stores your project's code (cloud storage for code that
  Render can read from).
- **Render** runs your code 24/7 as a live website/server.
- **EulerStream** is a free service that lets your server reliably listen
  to TikTok LIVE chat. TikTok doesn't offer an official way to do this, so
  every tool that does it (including this platform) relies on a "signing"
  service like this one — without it, connections are unreliable and get
  rate-limited fast.

`GitHub (your code) → Render (runs the code) → EulerStream (talks to TikTok)`

---

## Part 1 — Get your free EulerStream key (do this first)

1. Go to **https://www.eulerstream.com** and sign up for a free account.
2. Find the **API Keys** section of their dashboard and create a new key.
3. Copy the key somewhere safe — you'll paste it into Render in Part 3.
   One key powers all fourteen games.

---

## Part 2 — Upload the project to GitHub

1. Go to **https://github.com** and log in.
2. Click **+** (top-right) → **New repository**. Name it something like
   `live-game-platform`. Public or Private both work. Do **not** check
   "Add a README" (this project already has one). Click **Create
   repository**.
3. On the empty repo page, click **"uploading an existing file"** (or
   **Add file → Upload files** if you don't see that link).
4. On your computer, open the `deploy` folder you were given. Select
   **everything inside it** (Ctrl+A / Cmd+A) and drag it all onto the
   GitHub upload page — GitHub recreates the `public/`, `server/`, and
   `data/` folder structure automatically as long as you drag the folders
   themselves, not their contents one file at a time.
5. Wait for the upload to finish, scroll down, and click the green
   **Commit changes** button.
6. Double check the repo shows `server/`, `public/`, `public/flagle/`,
   `public/travle/`, `public/crossdle/`, `public/twistle/`,
   `server/blindle/`, `server/oracle/`, `server/colorblindle/`, `server/colordle/`, `server/structle/`, `server/textle/`, `server/rangedle/`, `server/findle/`, and `server/twistle/` as real
   folders — if anything landed flat with slashes
   in the filename instead, open it and rename it with the full path to
   move it into place.

---

## Part 3 — Deploy on Render

1. **render.com** → **New +** → **Web Service** → connect your repo.
2. **Runtime:** Node · **Build Command:** `npm install` · **Start
   Command:** `npm start`.
3. Before creating it, add one environment variable: **Key**
   `EULERSTREAM_API_KEY`, **Value** = the key from Part 1. (This one key
   works for all fourteen games — the server automatically shares it with
   whichever internal name each game expects.)
4. **Create Web Service.** Wait for the first build (a couple of minutes).
   Your address will look like `https://your-app.onrender.com`.

> Free-tier sleep warning: the free tier "falls asleep" after 15 minutes
> with no visitors, which would disconnect your game mid-stream if nobody
> has the page open. Open the link a minute or two before going live, or
> upgrade to a paid tier for a real broadcast.

---

## Part 4 — Using the platform

1. Open your Render link. You'll land on a **home screen** with ten game
   cards.
2. Tap one to open it — each game has its own address, so you can also
   bookmark a game directly and skip the home screen:
   - Flagle Live → `/flagle/`
   - TRAVLE Live → `/travle/`
   - Blindle → `/blindle/`
   - Findle Live → `/findle`
   - CROSSDLE Live → `/crossdle/`
   - TWISTLE Live → `/twistle/`
   - Oracle → `/oracle/`
   - Colorblindle → `/colorblindle/`
   - Colordle → `/colordle/`
   - Structle → `/structle/`
   - Textle → `/textle/`
3. Inside a game, everything works as documented for that game — Live /
   Test / Offline modes, TikTok connect, host controls, etc. Every game
   also has a **🎨 theme picker** in its header — pick a color once and it
   carries over to every other game on the platform.
4. **One-time login:** the first time you connect your TikTok username on
   any game, every other game remembers it too (saved on this browser
   only) and auto-connects with it the moment you open them — you never
   have to re-type your username or tap Connect again when switching
   games mid-broadcast. Typing a different username on any game's connect
   screen updates it everywhere.
5. Going live on TikTok: open the game's page in your browser, start
   TikTok LIVE in **Mobile Gaming** mode pointed at that tab, then
   connect from inside the game using your TikTok **@username**.
6. **Switching games mid-stream:** navigate to another game's address in
   the same browser tab you're broadcasting — the audience sees whatever's
   on screen. Each game reconnects to TikTok independently when opened,
   and tapping **🏠** inside any game takes you back to the home screen.

### Test Mode (try this first, before going live)

Every game has a Test Mode that simulates fake chat with no TikTok
connection needed — use it after any future change to confirm the game
still works before relying on it live.

### Testing Gift/Like/Share alerts

Open any game's **Settings** (the ⚙️ button; in CROSSDLE it's the **Host**
button) and scroll to **Live event tools**. The **📊 Live statistics**
box shows running Total Gifts / Coins / Shares / Likes counters, and the
**🧪 Test alerts** box has buttons to fire a fake Gift, Share, Milestone,
or Room Milestone — use these to see the alert animations before you're
live. They work in Test Mode, Offline mode, or even with no TikTok
connection at all. (They're tucked away in Settings on purpose, so they
never get in the way of the game while you're streaming.)

### Troubleshooting

- **No chat is coming through** → double-check the exact TikTok username
  (no spaces, `@` optional) and that the account is truly LIVE right now.
  Every game retries a connection a couple of times automatically before
  giving up and showing a plain-English error.
- **Messages arrive but nothing happens** → that's normal for ordinary
  chit-chat; only clean guesses in the game's expected format get
  recognized (e.g. a single word matching the round's length).
- **Something looks broken** → each game is built so one bad message
  never crashes the whole server — everyone else's game keeps running.
  Some games (Blindle, CROSSDLE, Findle, TWISTLE) have an on-screen
  diagnostics panel that shows exactly what's arriving and any recent
  errors.
- **A leaderboard reset unexpectedly** → on Render's free tier, a full
  redeploy always starts fresh; ordinary restarts preserve leaderboards
  that are saved to disk (CROSSDLE). In-memory-only leaderboards (Flagle,
  TRAVLE, Blindle, Findle, TWISTLE) reset on every server restart. Ask if you'd
  like persistent storage added later — it's a small add-on.

---

## Part 5 — Making changes later

You said you'll never touch code directly, so here's the safe way:

1. Come back and describe what you want changed.
2. You'll get the updated file(s), or a fresh `reupload` folder if you're
   picking this project back up in a new conversation.
3. On GitHub, open the file that changed, click the pencil (edit) icon,
   replace its contents with the new version, and **Commit changes**.
4. Render notices and redeploys automatically within a minute or two.

### The `reupload` folder

Alongside `deploy`, you were given a second folder called `reupload`.
It's **not** meant to be deployed — it's the same project with every file
renamed with a game-specific prefix (`flagle-*`, `travle-*`, `blindle-*`,
`findle-*`, `crossdle-*`, `shared-*`, `root-*`) so nothing collides if you
come back later and want to hand individual files back for edits or add a
sixth game. Use `deploy` to actually run the site; use `reupload` only
when you need to share files back for more work.

---

## A note on reliability

TikTok doesn't publish an official way to read LIVE chat, so every tool
that does this (including this platform) is built on top of
reverse-engineered access via EulerStream. It works reliably in practice,
but TikTok could technically change something on their end at any time —
if a connection ever behaves strangely after months of working fine, it's
usually a quick library update away from being fixed.

---

## Update 8 changes
- Answer word banks for BLINDLE, CROSSDLE, TWISTLE, ORACLE and COLORBLINDLE expanded to several hundred common words per length (`server/blindle/blindle-answers.js` and `server/crossdle/crossdle-answers.js`).
- New shared stylesheet `public/shared/game-chrome.css`: themed title banner above each game, single-row top toolbar, theme-colored top/bottom bars.
- Deploy exactly as before: upload this whole folder; start command `npm start`.

## Update 9 changes
- Title font picker (15 fonts) in each game's Settings / Host Controls: `public/shared/title-font.js`.
- Stronger green / yellow / red on tiles, number columns and keyboards: `public/shared/game-colors.css` (edit the `--strong-*` variables at the top to retune all games).
- Deploy exactly as before: upload this whole folder; start command `npm start`.


---

## Using the HOME connection (update 38)

1. Open your site's HOME page, tap ⚙️ → **Mode** → **Live**. A window opens by itself.
2. Type your TikTok username (start your LIVE first) and press **Connect**. Green = good. Anything else tells you exactly why and what to do.
3. Open any game: it links to that one connection automatically. No connecting inside games.
4. Deploy as before (upload the folder to GitHub, Render redeploys). Nothing new to set up.


---

## Optional (Update 40) - keep your Records between deployments
Your Records (every gift, like, milestone...) are saved on the server's disk. Render's free plan wipes that disk at every redeploy, so either:
1. Open **/records -> Backup & settings -> Backup (JSON)** after each stream and **Restore** it later, **or**
2. In Render add a **Disk** (Settings -> Disks), mount path `/var/data`, then add the environment variable `RECORDS_DIR` = `/var/data`. Records then survive redeploys by themselves.


---

## Optional - word language (update 48)

Nothing extra is needed to use it: open any word game -> Settings -> **Word language**.
To make Indonesian / Malay accept many more guessed words, either put a text file (one word per line)
at `data/dictionary-id.txt` / `data/dictionary-ms.txt`, or add the environment variables
`ID_DICTIONARY_URL` / `MS_DICTIONARY_URL` (a link to a raw text file) in Render -> Environment.
Details in `CHANGES_UPDATE_48.md`. Update 49 only changes word data (`server/shared/lang/`) - deploy exactly as before, no new settings; see `CHANGES_UPDATE_49.md`.

## Update 50 - fuller Indonesian / Malay dictionaries
See CHANGES_UPDATE_52.md. For the most complete coverage, merge a KBBI / Dewan Bahasa dan Pustaka word list with `node tools/import-wordlist.mjs id|ms yourlist.txt` and deploy the `data/` folder with the rest.
