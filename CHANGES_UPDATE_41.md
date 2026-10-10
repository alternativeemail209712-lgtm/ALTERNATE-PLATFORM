# Update 41 - Fix: "Cannot GET /records" (on top of Update 40)

**Cause:** the server's static-file handler only serves a file under its full name (`/records.html`). The short address `/records` had no route, so the new tab showed "Cannot GET /records".

**Fix (two layers, so it cannot happen again):**
1. `server.js` now has an explicit route for `/records` (also `/records/`, `/Records`, `/record`, `/records.htm`) that sends the Records page, registered before the static handler and every game.
2. Every button / link (game Settings -> Open Records, HOME Records tab, HOME 📜 button) now points to `/records.html`, which the static handler serves by itself - so the buttons work even if the short address were ever blocked.

Files changed: server.js, public/shared/engagement.js, public/home-views.js, public/platform-home.js.
