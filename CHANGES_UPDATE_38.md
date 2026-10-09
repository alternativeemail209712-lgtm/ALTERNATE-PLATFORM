# Update 38 - HOME: platform mode, ONE connection for every game, floating connection window (on top of Update 37)

## 1. "Customize Game Cards" moved into Home settings
The 🎛️ button is gone from the top bar. Open **⚙️ Home settings → 🎴 Cards → Customize Game Cards** (same panel, same saved designs, same optional HOME_EDIT_KEY).

## 2. Mode switch on HOME: Offline / Test / Live
**⚙️ Home settings → 📡 Mode** (the first tab). The choice applies to ALL games and is remembered by the server.
* **Offline** - no TikTok; you type guesses on the game screen.
* **Test** - no TikTok; every game simulates chat.
* **Live** - real TikTok chat through ONE shared connection.
A small pill in the top bar always shows the state (OFFLINE / TEST / LIVE @name / CONNECTING / NOT CONNECTED). Tap it to open the window (Live) or the Mode tab.
Games follow the mode by themselves when you open them. You can still change a single game by hand inside it; the platform only re-applies when the HOME mode or connection changes.
Findle has no Offline mode: Offline = stopped.

## 3. ONE connection for every game
In Live mode the server (`server/shared/platform-hub.js`) opens ONE real TikTok connection for your username. Any game that asks for a connection to that same username is handed a lightweight link to it: same events, but no second room lookup / signing request / websocket. The games' own code did not change. Each game page auto-connects to it (`public/shared/platform-sync.js`), so you never type the username or press Connect inside a game.
* If you open a game while HOME is still connecting, the game waits and shares it.
* If TikTok drops the connection the hub reconnects by itself (10 tries, growing waits); games resume.
* If a game is connected to a DIFFERENT username by hand, it keeps its own connection.
* After a Render restart the hub resumes automatically if it was connected in the last 3 hours (set PLATFORM_AUTORESUME=0 to turn off).

## 4. Floating connection window (opens by itself when you choose Live)
Draggable (bottom sheet on phones), minimize, close (closing never disconnects). It has: username box + Connect / Reconnect / Disconnect, **Run check** (asks the server what TikTok shows for that account), a big status banner (green good / yellow warning / red failed / blue connecting), a 5-step checklist (signing key, account found & LIVE, chat open, events arriving, games linked), live details (room id, viewers, connected for, last event, events per minute, chat messages, reconnects, linked games) and **Copy report**.
Every problem shows WHAT failed, WHY and WHAT TO DO, plus what TikTok literally said: not LIVE, wrong username, no key, key rejected, quota, rate limit, TikTok blocking the server, network/DNS, websocket refused, restrictions, stream ended, connection dropped, "connected but TikTok sends nothing for 2 min", "keeps dropping".

## Files
New: server/shared/platform-hub.js, public/shared/platform-sync.js, public/platform-home.js, public/platform-home.css.
Changed: server.js (mounts the hub), server/shared/tiktok-resilience.js (shared-connection hook), public/index.html, public/home-views.js (Mode + Cards tabs), the 14 game pages (one script tag each).
API: GET /api/platform, GET /api/platform/stream, POST /api/platform/{mode,connect,disconnect,retry}. If HOME_EDIT_KEY is set, the POST routes need it (HOME asks once per device).

## Honest limits
* The hub's settings file (data/platform.json) is erased by Render's free disk on redeploy; the mode then falls back to Test until you choose again.
* TikTok itself can still refuse a connection (not LIVE, blocked address, plan limits); the window now tells you exactly which.
