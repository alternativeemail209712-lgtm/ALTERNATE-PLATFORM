# Update 30 - HOME page: live-host banner + customizable game cards (on top of Update 29)

Only the HOME page (`/`) changed. No game was edited; every game keeps working exactly as before.

## 1 - Top-left banner shows the connected TikTok host
* While a TikTok host is connected to **any** game, the banner reads **`<HOST NAME> LIVE GAMES`**
  (e.g. **MIA ZAHRA LIVE GAMES**) and the host's **exact round TikTok profile picture** sits to the left of the
  name, inside the banner.
* No host connected (or Test / Offline mode) -> the original **TIKTOK LIVE GAMES** banner.
* The name is the host's TikTok display name. If TikTok does not provide it, the @username is used, and it
  switches to the display name as soon as it is found.
* The picture is downloaded by the server (same system as the starter-word picture) and shown as an exact circle
  (centered square crop). While it loads, a circle with the host's first letter is shown.
* Updates instantly when a host connects / disconnects. A short reconnect (TikTok dropping and the game retrying)
  does not make the banner flicker. If two different TikTok accounts are connected at once they take turns.
* The browser tab title also becomes "<Host> Live Games".

How it works: every game already calls `Engagement.attach(...)` when its TikTok connection succeeds. That one
function now also reports the host to `server/shared/host-presence.js`, so all 14 games (and any future one)
are covered with no per-game change.

## 2 - Customize every game card (🎛️ button, top right of HOME)
Pick a game, then change:
| What | Options |
|---|---|
| **Quick main color** | 14 color dots + any color: recolors border, icon, title, tags, 3D edge together |
| **Colors (9, each with a reset arrow)** | card background, border, 3D bottom edge, corner circle, title text, description text, icon circle, play-button text, tags |
| **Shape & style** | border style (dashed / solid / dotted / double / none), border thickness, corner roundness, 3D edge height, title font |
| **Words** | icon (emoji), title, description, button words |
| **Card** | hide it, move it up / down |
| **Buttons** | Reset this card, Copy look to all cards, Reset ALL |

A live preview of the card stays at the top of the panel. Changes save automatically.

**Where it is saved:** on the server (`data/home-cards.json`, so your phone, tablet and desktop all show the same
design) **and** in the browser. If the server disk is wiped (Render free plan redeploy) the next browser that opens HOME
puts the design back automatically.

**Optional password:** set `HOME_EDIT_KEY` (Render -> Environment) and saving a design asks for it once per device.
Without it anyone who can open your site can restyle the cards (same trust model as the other host controls).

## Files
NEW  `server/shared/host-presence.js`, `server/shared/home-cards-store.js`, `public/home.js`, `public/home.css`
CHANGED `public/index.html`, `server.js`, `server/engagement/engagement-hub.js`, `server/shared/host-avatar.js`
(adds display-name lookup), `.env.example`, `package.json` (2.16.0), `README.md`
