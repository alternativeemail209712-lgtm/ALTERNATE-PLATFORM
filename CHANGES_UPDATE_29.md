# Update 29 - SHAPEDLE: customizable Symbols, audience profile pictures, Flags & Professions (on top of Update 28)

Everything is in **Settings -> Symbols** of SHAPEDLE (`/shapedle/`).

## 1 - Symbol sets (tick as many as you like)
Cute Faces, Plush Toys, Classic Shapes, Animals, Sweets & Fruit, Sky & Garden (as before) plus NEW:
| Set | What it is |
|---|---|
| **Flags of Countries** | 42 flags, DRAWN as artwork (so they show on Windows too, where flag emoji do not) |
| **Professions** | doctor, chef, farmer, pilot, astronaut, firefighter... |
| **Sports** | balls, medals, games |
| **Transport** | cars, trains, planes, boats |
| **Audience profile pictures** | round TikTok pictures of viewers you pick (see section 4) |

**How ticked sets are used:** *One set per round* (each round randomly uses one ticked set) or *Blend all ticked sets* (every round mixes them).
Which sets are in play applies from the next round (a round's symbols never change mid-round).

## 2 - Look (applies instantly on every connected screen)
Color intensity (0-200 %), brightness (60-140 %), symbol size (60-100 %), white ring around profile pictures on/off.
Profile pictures always keep their true colors. A live **Preview** strip shows your choices.

## 3 - Motion
Animate on/off, style (Float, Bounce, Wiggle, Pulse, Wave) and speed (Slow, Normal, Fast).

## 4 - Audience profile pictures as symbols
- Anyone who **joins, chats, likes, gifts, follows or shares** in your LIVE is saved to a roster together with **a saved copy of their picture**.
  They stay in the list after they leave, after TikTok's picture link expires, and after a server restart.
- You **opt in / opt out** each person with a checkbox (new people start un-ticked). Search by name, "Tick everyone with a picture", "Untick all",
  per-person remove (x) and "Forget everyone" (deletes the saved pictures).
- Pictures are shown as **exact circles** (centered square crop, then round).
- "Use ticked pictures first" puts your ticked pictures in the first symbol places of each round.
- If fewer pictures are ticked than a word has different letters, the rest of the symbols come from your other ticked sets (or Cute Faces),
  so a round always works. People whose picture could not be saved are never used.
- Only real LIVE sessions fill the roster (Test and Offline mode never add anyone).

## Files
NEW  `server/shared/symbol-options-store.js` (saves your choices to `data/symbol-options.json`)
NEW  `server/shared/viewer-roster-store.js` (roster in `data/viewer-roster.json`, pictures in `data/viewer-avatars/`)
CHANGED `server/shared/host-avatar.js` (adds `downloadViewerPicture`, TikTok picture hosts only),
        `server/shapedle/shapedle-server.js`, `server/shapedle/public/` (`shapedle-index.html`, `shapedle-game.js`, `shapedle-style.css`, `shapedle-symbols.js`), `.gitignore`.
The old single-pack choice (`data/symbol-pack.json`) is carried over automatically on first start.

## Note about saving on Render
Like every other saved setting in `data/`, the roster and pictures live on the server's disk. On Render's free plan the disk is wiped on every
redeploy, so people would need to join again. To keep them permanently, add a Render **Disk** mounted at `/opt/render/project/src/data`.
