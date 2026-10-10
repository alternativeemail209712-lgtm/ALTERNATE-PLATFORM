# Update 44 - Fix: game stopped reading comments (Maximum call stack size exceeded)

**Symptom (Render log):** `RangeError: Maximum call stack size exceeded` at `avatarFor` (shapedle-server.js), repeated on every state broadcast and every connection. Guesses from some viewers were not shown/read.

**Cause:** `avatarFor(name)` ended with `return avatarFor(name);` - it called itself forever whenever the viewer had no saved profile picture yet (new viewers, picture still downloading, host-typed/test guesses). The crash aborted the whole state broadcast, so the game appeared to ignore those comments.

**Fix:** it now falls back to the last picture link TikTok sent (`knownAvatars`), or `null` (the client shows the coloured initial circle).

File changed: server/shapedle/shapedle-server.js. No settings or data changes; deploy over Update 43.
