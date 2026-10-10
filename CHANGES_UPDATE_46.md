# Update 46 - FLAGLE: leaderboard now works like the word games

* **🏆 Leaderboard button** (top bar) opens a drawer with **This session / All-time** tabs, rows shown as rank, picture, name, points - same layout as BLINDLE / CODEDLE. Test mode shows "Test Mode scores aren't saved to the leaderboard", Offline shows "Offline mode is solo".
* **Win sequence:** after a LIVE win the floating windows now appear one after another - Round Winner (with the answer) -> This Session leaderboard -> All-Time leaderboard (top 10 each, with pictures).
* **New setting "Show leaderboard for (seconds)"** (Host settings, default 4, applies instantly) controls how long each window stays.
* **Live-only scoring:** Test and Offline rounds no longer add to the session or all-time leaderboards (before, they did).
* Reset buttons unchanged (session reset is server-side, all-time reset is in this browser). All-time scores are still kept in the browser that runs Flagle.
* Files: server/flagle.js, public/flagle/app.js, index.html, style.css. Includes Updates 44 and 45.
