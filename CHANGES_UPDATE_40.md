# Update 40 - Records archive + many more milestone stages (on top of Update 39)

## 1. Records: a permanent memory of everything the audience did
Every **gift**, **like** (one running row per viewer per stream), **share**, **follow**, **subscription** and **milestone** (viewer AND whole room) is now saved automatically, in every game, with:
* **When** - date, time to the second, how far into the stream (e.g. "12m 04s into the stream"), and the stream session.
* **Which audience** - one viewer (their @name + nickname) or the whole room, plus how many people were watching at that moment.
* **Where** - which game was open and which TikTok host account was live.
* **Details** - gift name, quantity, coins; milestone number, stage x/y and tier.

### Easy to reach even though it lives in Settings
* **HOME:** a 📜 button next to the status pill in the top bar, the **R** key, and Home settings -> **Records** tab.
* **Every game:** Settings -> **Open Records** (opens in a new tab so the live game is never interrupted).
* **Direct link:** `https://YOUR-SITE/records` - bookmark it on your phone.

### What you can do on the Records screen
* **Overview** - totals (records, audience size, gifts, coins, likes, shares, follows, milestones), when the audience is most active (by hour), top gifters / likers / sharers / milestone hunters, by kind, by game, by day.
* **Timeline** - every record, newest first. Filter by kind (Gifts / Likes / Milestones / Shares / Follows & subs), time range (today, 24 h, 7 d, 30 d, custom dates), game, host, audience (individual viewers / whole room), stream session, search a name or gift, sort newest / oldest / biggest.
* **Audience** - everyone with lifetime totals; tap a name to see all of that person's records.
* **Backup & settings** - download a spreadsheet (CSV) or a full backup (JSON), restore a backup, delete test records, delete everything, and choose which milestone alerts pop up on stream.
Records made by the fake-alert test buttons are marked TEST and hidden unless you tick "Include test records".

### Keeping records between deployments
Render's free disk is wiped on every redeploy. Either press **Backup (JSON)** after streams and **Restore** it later, or add a Render **Disk** and set `RECORDS_DIR` to its mount path (e.g. `/var/data`) - then records survive redeploys by themselves.
If `HOME_EDIT_KEY` is set, restoring / deleting / changing settings asks for it (viewing never does).

## 2. More milestone stages (all ladders in `server/engagement/milestone-stages.js`)
| Ladder | Before | Now |
|---|---|---|
| One viewer's likes | 21 stages | **52** (50, 100, 150, 200, 250, 300, 400 ... up to 5,000,000) |
| Whole room's likes | 12 | **27** (100 up to 100,000,000) |
| Whole room's shares | 12 | **20** (5 up to 100,000) |
| One viewer's shares | none | **10** (3, 5, 10, 15, 25, 50, 75, 100, 250, 500) - new |
| One viewer's gift coins | none | **16** (100 up to 1,000,000) - new |
| Whole room's gift coins | none | **14** (500 up to 10,000,000) - new |

Every alert now shows its **tier** (Bronze, Silver, Gold, Platinum, Diamond, Legend, Mythic) and **stage number** ("Gold - stage 16/52 - 1.8k likes") with a matching badge color.
* If one event jumps several stages at once (a big gift), **all** stages are saved to Records but only the **highest** pops up on screen.
* Records -> Backup & settings -> **Milestone alerts on screen**: "Every stage" (default) or "Only the original, bigger stages" if the stream feels too busy. Records always keep every stage.

## Files
New: server/engagement/milestone-stages.js, server/shared/records-store.js, public/shared/records-ui.js, public/records.html.
Changed: server/engagement/engagement-tracker.js, engagement-hub.js, server.js, public/shared/engagement.js, public/home-views.js, public/platform-home.js, package.json, .env.example.
API: GET /api/records, /api/records/summary, /meta, /viewers, /viewer/:name, /export?format=csv|json; POST /api/records/import, /clear, /settings.

## Honest limits
* TikTok decides what it sends. Likes arrive in batches, and "viewers watching" is only known while the shared HOME connection (Live mode) is on.
* Records keep the newest 25,000 rows; likes are one growing row per viewer per stream, so this lasts a long time.
* Per-viewer like / share / coin milestone counting restarts when the server restarts (same as before); the saved archive itself does not.
