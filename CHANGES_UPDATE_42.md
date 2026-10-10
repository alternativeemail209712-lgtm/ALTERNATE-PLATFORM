# Update 42 - Own LIVE not read + HOME links every game by itself (on top of Update 41)

## 1. "Connected" but your own LIVE's comments are not read
**Most likely cause (found in the code):** the platform remembered the room id of each host for 6 hours and re-used it on
every new Connect. If you had connected to your account earlier (an earlier or ended LIVE) and then started a NEW live, a new
Connect could attach to the OLD room: it shows "connected" but no comments ever arrive. Other people's lives worked because
they had never been remembered.

**Fix (server/shared/tiktok-resilience.js, server/shared/platform-hub.js):**
* A fresh Connect (HOME button, Retry, game Connect) always looks the live room up from scratch - the remembered id is no longer used.
* The remembered id is only kept for 2 minutes (a quick network blip) and is deleted on disconnect / stream end.
* New watchdog: if nothing at all arrives within 30 s of connecting, the platform checks TikTok's current room for the host and
  reconnects from scratch (max 2 refreshes per Connect). The HOME window shows "Old room detected - reconnected".
* The HOME connection window now shows the last comment received (who + text), so you can see at once that comments are arriving.
* The server log prints the room id used: "[platform] one shared connection is up for @you (room ...)".

## 2. Connect once on HOME = every game connected
Until now a game only linked itself when its page was opened. Now the HOME connection links the nine Blindle-family games
(Blindle, Oracle, Colorblindle, Colordle, Structle, Textle, Rangedle, Codedle, Shapedle) on the server the moment it connects
(and again after every reconnect) - no page needs to be open, nothing to press inside any game.
Flagle, Travle, Crossdle, Twistle and Findle keep linking the moment their page opens (their sessions live in the browser tab).

Files changed: server/shared/tiktok-resilience.js, server/shared/platform-hub.js, the nine server/<game>/<game>-server.js files, package.json.
