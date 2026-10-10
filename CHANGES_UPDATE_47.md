# Update 47 - Scrolling top-scorers ticker in every game (+ settings)

**New: `public/shared/score-ticker.js`** - one shared module, loaded by every game page.

* **Games that did not have a ticker** (BLINDLE, ORACLE, COLORBLINDLE, COLORDLE, STRUCTLE, TEXTLE, RANGEDLE, CODEDLE, SHAPEDLE, TWISTLE) now get the same news-style scrolling strip as FLAGLE: medal/rank, profile picture, name, points, scrolling right-to-left, pauses while you hover/touch it.
* **No overlapping, by design:** the strip is a normal block placed directly under each game's top bar (no fixed/absolute positioning). It has its own fixed height, clips its own content, and pushes the page down; the games re-measure their boards when it appears, disappears or changes size. Checked on a 390px-wide phone screen in all games: it starts exactly where the top bar ends and the next section starts exactly where it ends, with no sideways scroll.
* **Games that already had a ticker** (FLAGLE, TRAVLE, CROSSDLE, FINDLE host + display) keep their own; the on/off, speed, text size and profile-picture settings below are applied to them too.
* **Settings:** every game's Settings drawer has a new section **"Scrolling top-scorers ticker"** (just above "Live event tools"):
  show/hide, who it shows (all-time or this round's leaders), number of players (3/5/10), scroll speed, text size, profile pictures on/off, points on/off, hide until someone has scored, label text, accent colour, and Reset.
  (Who/number/points/hide-empty/label/colour apply to the games that use the new strip; the others hide those controls.)
* Settings are remembered on the device/browser and shared by all games; they apply instantly, also in other open tabs.
* Small hook added to the 10 games' client scripts (`render(state)`): `ScoreTicker.update(state)`. No server or data changes.
