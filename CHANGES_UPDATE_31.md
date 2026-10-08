# Update 31 - LEGENDS SETTINGS: keyboard positions + exact rows x columns layout (on top of Update 30)

Only the shared legend changed (`public/shared/legend.js`, `legend.css`, `server/shared/legend-hub.js`), so all 11 games
that have a legend get the new options at once. No game file was edited.

## 1 - Section renamed
The settings section **Color legend** is now **LEGENDS SETTINGS** (in every game's Settings panel).

## 2 - Position (5 choices instead of 3)
| Choice | Where the legend goes |
|---|---|
| Top - under the floating message window | as before |
| **Directly above the keyboard** (new) | right before the on-screen keyboard |
| **Directly below the keyboard** (new) | right after the on-screen keyboard |
| Just above the guess board | as before |
| Below the guess board | as before |

STRUCTLE has no keyboard, so the two keyboard choices are not offered there.

## 3 - Layout: exactly how many rows and columns
* **Quick layouts** (one tap): Auto, 1 row, 1 column, 2 rows, 2 columns, 2x2, 2x3, 3x2, 3x3, 2x4, 4x2.
* **Columns** and **Rows** (Auto, or 1-12):
  * only Columns set -> that many columns, the rows follow;
  * only Rows set -> that many rows, the columns follow;
  * **both set -> an exact rows x columns grid** (before, "rows" simply won). Example: 2 rows x 3 columns = 6 cells.
* **Fill order**: across (row by row) or down (column by column).
* **Too many entries** for the grid: add extra rows/columns so everything shows, or hide the entries that do not fit.
* A live line under the settings tells you what you get, e.g. "5 entries shown in 2 rows x 3 columns. 1 empty cell."
* **Each entry**: color chip then text / text then color chip / color chip above the text.
* **Cell width**: equal-width cells or compact (fit to each entry). **Inside each cell**: same as Alignment / left / center / right.
* **Row spacing** and **Column spacing** (separate sliders, 0-60 px) and **Maximum width** (200-1200 px).

Everything applies instantly and is shared by every screen connected to the game, exactly like before.

## Old saved settings
Older saved legends (browser cache and `data/legends.json`) keep their look: the old single "spacing" becomes row spacing
(and 1.6x of it for column spacing), and an old "rows only" setting still fills column by column.

## Files
CHANGED `public/shared/legend.js`, `public/shared/legend.css`, `server/shared/legend-hub.js`, `README.md`, `package.json` (2.17.0)
NEW `CHANGES_UPDATE_31.md`
