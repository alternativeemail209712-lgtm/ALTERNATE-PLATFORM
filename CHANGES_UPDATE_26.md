# Update 26 - Keyboard auto-color switch + CODEDLE legend / gray-key fixes (on top of Update 25)

## 1. New host switch: "Auto-color keyboard keys" (ON by default)
- Settings -> **Auto-color keyboard keys** (in CROSSDLE: Host panel -> "Auto-color keyboard keys").
- **ON (default):** every key takes the color its letter has earned on the tiles, exactly as before.
- **OFF:** all keys stay plain/neutral; viewers read the colors only on the tiles.
- Applies right away (no new round needed) on every screen connected to that game.
- The host's choice is remembered per game in `data/key-autocolor.json`, so a server restart does not turn it back on.
  A game the host never touched stays ON.
- Available in every game that has a self-coloring keyboard: **CODEDLE, COLORDLE, COLORBLINDLE, TEXTLE, RANGEDLE, CROSSDLE**.
  (BLINDLE, ORACLE and TWISTLE use a manual click-to-mark scratchpad keyboard, so they are unchanged.)

## 2. CODEDLE
- **Legend wording shortened** to fit one line on narrow phones: `Blue — within 3 letters`
  (was "Blue — within 3 letters of target"). Hosts who already customized/saved their legend keep their saved text;
  use Settings -> Color legend -> "Reset legend to default" to pick up the new wording.
- **Keyboard: confirmed-gray letters always show gray.** Priority is still green > pink > yellow > blue, but a letter that is
  CONFIRMED absent now turns gray even if it was blue earlier. "Confirmed absent" = in some guess it got a gray tile and no
  tile of the same letter in that same guess was green / yellow / pink (this avoids wrongly graying a letter that is in the
  word but whose duplicate copy was merely "used up").

## Files
- NEW `server/shared/key-autocolor-store.js`
- `server/{codedle,colordle,colorblindle,textle,rangedle}/*-server.js`, `public/*-game.js`, `public/*-index.html`
- `server/crossdle/crossdle-engine.js`, `server/crossdle/crossdle.js`, `public/crossdle/app.js`, `public/crossdle/index.html`
- `server/codedle/codedle-server.js` (gray rule), `public/shared/legend.js` (wording)

Deploy exactly like Update 25 (see DEPLOY_GUIDE.md): replace the repository contents with this folder and redeploy.
