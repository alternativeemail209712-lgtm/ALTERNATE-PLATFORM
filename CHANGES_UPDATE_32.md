# Update 32 - SHAPEDLE audience pictures tick themselves + legend entries always apply (on top of Update 31)

## 1 - SHAPEDLE: audience profile pictures are ticked automatically
Settings -> Symbols -> **5 - Audience profile pictures**.
* Every **new** person who joins, chats, likes, gifts, follows or shares is **ticked automatically**. As soon as their round
  profile picture has been saved it can be used as a symbol, from the next round on (a round's symbols never change mid-round).
* **Untick** a person and they **stay unticked** (even when they keep chatting).
* **Remove** a person with the **x** button and they are **kept out for good** - not added back when they chat again - until you
  press the new **Allow removed people again (N)** button. (Saved in `data/viewer-removed.json`.)
* New switch **Use ticked pictures automatically**: ON (default) = the ticked pictures are used in every round without also
  ticking "Audience profile pictures" in the symbol sets, even when "one set per round" drew another set.
  Switch it OFF to go back to the old behaviour (the set must be ticked).
* "Forget everyone" is a fresh start: it also clears the removed-people list, so people who join afterwards are added (and ticked) again.
* People saved before this update keep the tick they had; press **Tick everyone with a picture** once if you want them all on.
* The list can hold 3000 people; when it is full the oldest un-ticked people are dropped first, then the oldest ticked ones.

## 2 - LEGENDS SETTINGS -> Entries (order, text, colors): every change now lands
Bugs fixed (they could make a change not appear or be undone):
* While you typed in an entry's text, chip text or color, the server's echo of your *previous* change could come back and
  overwrite what you had just typed, and later edits could go to an outdated copy of the entry. Now each screen ignores its own
  echo, keeps its unsent edits, and every edit (text, chip text, color, show/hide, order, delete, color reset) always applies to the
  current entry.
* If the server forgot the legend (for example its disk was wiped by a redeploy on Render's free plan) the browser used to reset
  the host's legend to the default. Now the browser gives its saved legend back to the server.
* Changes made on another screen of the same game still appear instantly.

## Files
CHANGED `server/shared/viewer-roster-store.js`, `server/shared/symbol-options-store.js`, `server/shapedle/shapedle-server.js`,
`server/shapedle/public/shapedle-index.html`, `server/shapedle/public/shapedle-game.js`, `public/shared/legend.js`,
`server/shared/legend-hub.js`, `README.md`, `package.json` (2.18.0). NEW `CHANGES_UPDATE_32.md`.
