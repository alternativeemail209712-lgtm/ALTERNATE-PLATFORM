# Update 36 - TikTok connection fix for every game + HOME settings panel (on top of Update 35)

## 1. TikTok "Failed to retrieve Room ID from all sources" - fixed at the root, for ALL games
Your log showed the live connection worked, then every reconnect failed at the room-id lookup (4 tries in ~15 seconds).
New file `server/shared/tiktok-resilience.js` (loaded once from server.js) now wraps the connection for every game:
* remembers each host's room id after a good connection and reuses it on reconnect (no lookup, so no lookup failure)
* if the lookup fails, tries its own lookup from TikTok's public page, then retries patiently (waits 3s, 8s, 15s) instead of hammering
* spaces lookups out across all games (one key shared by 14 games was being hit at once)
* if the connection drops, reconnects by itself in the background (up to ~10 tries, stops if the LIVE really ended or you press Disconnect); the game screen goes back to "live" by itself
* one shared API key for both names (EULERSTREAM_API_KEY / TIKTOK_SIGN_API_KEY)
* friendlier on-screen message when it still cannot connect
Games updated to react to the automatic reconnect: Blindle, Codedle, Colorblindle, Colordle, Oracle, Rangedle, Shapedle, Structle, Textle, TRAVLE. (Crossdle and Twistle already reconnect by themselves and now also benefit from the room-id memory; Flagle benefits from the retries.)
Check anytime: open  https://YOUR-SITE/api/tiktok-health?user=YOURTIKTOKNAME  while LIVE. It says if a key is set, and whether this server can see your LIVE.
What no code can do: if TikTok itself refuses Render's server address, or the account is not LIVE yet, the connect still fails. The health page tells you which.

## 2. HOME page
* The 5 icons (Live chat / Test / Offline / Leaderboard / Gifts) are removed.
* Layout, Groups and Search are now hidden behind the new ⚙️ button next to the 🎛️ button (tabs: Find, Layout, Groups).
* When a search or group filter is active, a small "Showing X of Y - Show all" bar appears so nobody gets lost.
Files: server/shared/tiktok-resilience.js (new), server.js (+3 lines), 9 game server files + server/travle.js (small additions), public/index.html, public/home-views.js, public/home-views.css.
