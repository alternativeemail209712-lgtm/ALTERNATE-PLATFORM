# Update 39 - Readable tiles: guesses never shrink the tiles, scrolling instead (on top of Update 38)

Applies to BLINDLE, ORACLE, COLORBLINDLE, COLORDLE, STRUCTLE, TEXTLE, RANGEDLE, CODEDLE, SHAPEDLE and TWISTLE
(CROSSDLE already scrolls its own board and was not changed; FLAGLE/TRAVLE/FINDLE have no letter tiles).

## 1. Tiles keep their size no matter how many guesses there are
Before: the tile size was the smaller of a width-fit and a height-fit, and the height-fit shrank every tile as rows were added.
Now: the number of guesses is ignored when sizing (`const rows = 1` in each game's `computeTileMetrics`).

## 2. Auto-scroll + manual scrolling
The guess board is now a scroll box (the newest guess is on top):
* **Auto-scroll:** while you are at the top, the board stays on the newest guess.
* **Manual scroll:** scroll down to read older guesses; the board holds your place when new guesses arrive (no jumping).
  Auto-scroll resumes when you scroll back to the top or tap the **⬆ Latest** button that appears.
* Touch, mouse wheel and the thin scrollbar all work.

## 3. Switch: "Auto-resize tiles to fit long words"
In each game's **Settings** (under the word length), box **🔠 Tile size & scrolling**. One setting for all games, remembered on this device:
* **ON (default):** a long word always fits on one line (tiles get smaller for very long words, as before).
* **OFF:** tiles keep a fixed readable size (the size used for 15 letters); a word longer than 15 letters scrolls sideways.
Use OFF when you choose lengths above about 15. A second switch, **Auto-scroll to the newest guess**, turns the auto-scroll on/off.
Changing a switch redraws the board at once.

## Files
New: public/shared/tile-fit.js. Changed: the 9 *-game.js files (`computeTileMetrics`), public/twistle/app.js (`computeLayout`) + style.css, and one script tag in the 10 game pages.
