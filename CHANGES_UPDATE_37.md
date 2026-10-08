# Update 37 - SHAPEDLE audience pictures + exact connection problems (on top of Update 36)

## 1. SHAPEDLE audience profile pictures - why some were missed, and the fixes
Causes found in the code:
* only ONE picture link per person was kept (often a HEIC file browsers cannot draw) - now ALL links (every size/format) are kept, newest first, JPEG/WEBP tried before HEIC
* a person was only noticed from a few event types, and by whatever name the event carried (sometimes the display name, which can never be matched to a picture) - now every TikTok message of every kind is scanned (join, chat, like, gift, follow, share, top-viewers list, subscribe, emotes, ...), viewers are identified only by their real @username (uniqueId or displayId), and every person inside an event is found (e.g. gift receivers, top viewers)
* after 8 failed tries a person's picture was abandoned for good - now it never gives up: the wait grows (45 s up to 15 min), a new picture link from a new message is tried at once, and a background sweep retries everyone still missing every 30 s
* 2 pictures downloaded at a time -> 4; a second try on slow/timeout answers
* guesses and the leaderboard used the raw TikTok link (can expire / be HEIC) -> they now use the server's saved copy as soon as it exists
New in the SHAPEDLE audience list (Settings): each person without a picture shows the exact reason ("TikTok refused or expired the picture link", "TikTok only offered a HEIC picture", ...) and a **🔄 Retry missing pictures** button.
Honest limits: TikTok never gives a game the full list of people watching - only the ones who join, chat, like, gift, follow, share, plus its top-viewers list. A person who only watches silently cannot be seen by anyone. And Render's free disk is erased on each restart/redeploy, so saved pictures are fetched again the next time that person shows up.

## 2. Exact connection problem, in every game
New `server/shared/tiktok-errors.js`. Instead of a vague message, every game (Blindle, Codedle, Colorblindle, Colordle, Oracle, Rangedle, Shapedle, Structle, Textle, Flagle, TRAVLE, Crossdle, Twistle) now says WHAT failed, WHY, WHAT TO DO and what TikTok literally said, e.g.:
NOT LIVE yet | wrong username | no API key set | key rejected (401/403) | plan quota reached | rate limit (429) | TikTok refusing this server (HTTP 403 / robot check) | this server cannot reach tiktok.com | DNS failure | websocket refused | age/region restriction | live exists but the signing service refused.
For the "Failed to retrieve Room ID" case the server now checks TikTok's public page at that moment to tell these apart (live / not live / blocked / no such account / network).
While retrying, the screen shows why each try failed ("Try 2 failed. ...") instead of only the last one.
Files: server/shared/tiktok-errors.js (new); tiktok-resilience.js, host-avatar.js, viewer-roster-store.js, shapedle server + client, the 9 game servers, flagle.js, travle.js, crossdle/twistle tiktok files.
