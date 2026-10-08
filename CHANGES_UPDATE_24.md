# Update 24 - customizable color legends + 100% reliable host picture (on top of Update 23)

## 1. Color legend on every word game
Covers BLINDLE, ORACLE, COLORBLINDLE, COLORDLE, STRUCTLE, TEXTLE, RANGEDLE, CODEDLE, TWISTLE and CROSSDLE.
(FLAGLE, TRAVLE and FINDLE are not letter-color games and are unchanged; TRAVLE already has its own legend drawer.)

**Default look:** a compact legend, directly below the floating message window and above the keyboard and the
guess board. It is a normal block in the page (never absolutely positioned), so it cannot overlap the floating
window, the keyboard or the board. The games re-measure the board whenever the legend changes, and **Auto-fit**
shrinks the legend (down to 55%) if it would use more than about a quarter of the screen height.
The entries use each game's own color variables, so **Color shades** recolors the legend too.

**Settings -> Color legend** (new section right after Color shades, in every game):
- show / hide the legend; position: top (under the floating window, default), just above the guess board, or below the board
- alignment (left / center / right); title on/off and its text
- the text next to every color, and the text inside every chip (e.g. "A", "1-5", "#")
- order of the entries (up / down arrows), switch single entries off, add your own entries, change any entry's color (reset arrow)
- overall size, chip size, spacing, font (23 fonts), chip shape (rounded square / square / circle / wide bar)
- number of **columns** and **rows** (Auto by default; rows fill column by column), background panel on/off, Auto-fit on/off
- "Reset legend to default"
Settings apply instantly, are remembered in the browser (no flash on reload) and are shared by every screen connected to
the same game (OBS display + host panel), saved on the server in `data/legends.json`.

RANGEDLE and CODEDLE had their own fixed legends - those were replaced by the shared one (same wording by default).
CROSSDLE's old legend row was replaced too; its "unlimited guesses" note was kept as a small line.

## 2. Host profile picture on the starter word: now reliable for every host
Why it failed for some hosts: the browser had to load TikTok's picture link directly. Links are often `.heic`
(not drawable in most browsers), signed and short-lived (expire), sometimes refused for hot-linking, and the room info
sometimes has no owner picture - and the lookup only ran once.

Now the **server** gets the picture and serves it from your own site:
- tries the connect room info (every size, every URL, `.heic` -> `.jpeg`/`.webp` rewrite), then a fresh room-info
  request, then the host's public TikTok profile page, then the host's own chat message; retries for ~3 minutes
- checks the bytes are a real browser-friendly image (never heic), keeps it in memory, serves `/host-avatar/<username>`
- only TikTok's own picture domains are ever fetched (no open proxy); max 3 MB
- if a lookup fails entirely, a copy from an earlier session is used; if none exists the game keeps the colored initial circle
- diagnostics: `/host-avatar-status/<username>` shows whether the server holds the picture
Applies to all ten games with a starter word (all use `server/shared/host-avatar.js`).

## Files
- NEW `public/shared/legend.js`, `public/shared/legend.css`, `server/shared/legend-hub.js`
- CHANGED `server/shared/host-avatar.js` (rewritten), `server.js` (legend hub + `/host-avatar` routes)
- CHANGED the 8 `server/<game>/<game>-server.js` files, `server/twistle/twistle-tiktok.js`, `server/crossdle/crossdle-tiktok.js` (use the new avatar resolver)
- CHANGED the 10 game pages (include the legend script/style); removed the old fixed legends and their JS toggles in RANGEDLE, CODEDLE, CROSSDLE
- `package.json` version 2.14.0

## Deploy
Same as before: push to GitHub, Render redeploys. No new dependencies, no new environment variables.
Needs Node 18.18+ (already required) because the picture download uses the built-in `fetch`.
