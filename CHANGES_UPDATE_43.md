# Update 43 - Accurate like / gift / share counting + alert settings (on top of Update 42)

## 1. Why the numbers were too high (found in the code) - and the fix
Your example: 3 viewers "hit" about 30,000 likes while TikTok showed about 10,000 in total.

| # | Cause | Fix |
|---|---|---|
| 1 | **Counted once per game.** HOME shares one TikTok feed with every game, and EVERY linked game added its own counter to that same feed: 3 games linked = every like counted 3x (30k instead of 10k). | Each TikTok message is counted **exactly once**, however many games are open (engagement-hub.js). |
| 2 | **Replays.** After a reconnect TikTok re-sends its last few minutes of messages, which were counted again. | HOME no longer asks for that replay, and every message id is remembered so a repeat is never counted twice (`Duplicates blocked` is shown). |
| 3 | **Numbers never reset.** Per-viewer and room totals carried over from the previous live (until the server restarted). | Every new TikTok LIVE room starts a fresh count at zero. Reconnecting to the same live keeps counting. Records also start a new stream session per room. |
| 4 | **Gift streaks counted twice.** A streak that paused 1.5 s was counted, then counted again in full when it continued. | Only the NEW repeats of a streak are counted. |
| 5 | **Test buttons changed real numbers.** Fake gifts / milestones were added to the live counters. | Test alerts run on a scratch copy; real numbers are never touched. |
| 6 | **Room likes used our own sum.** | The room-like milestones follow **TikTok's own room total** whenever TikTok sends it, so they agree with the TikTok app. |

Also: one like message can never add more than 1,000 likes; Records' per-viewer like rows no longer double up.

**What cannot be known (and is now labelled honestly):** TikTok does not tell the platform how many likes a single viewer sent before the platform connected, so viewer milestones say "since connect". Start HOME's connection at the beginning of the live for full-stream numbers.

## 2. New: 🔔 Alerts settings
Open Records (HOME 📜 / R key / game Settings > Open Records) > **🔔 Alerts**, or `/records.html#alerts`.
* **Which alerts pop up:** switch each kind on/off - gifts, shares, viewer like / share / gift milestones, room like / share / gift milestones, **new followers, new subscribers** (new, off by default). Records still save everything.
* **Automatic rules:** pause small alerts when the stream is busy (more than N per minute; big gifts and room milestones always pass), hide gifts under N coins, set the "big gift" threshold, limit the same viewer to one alert per N seconds, show alerts only while the platform is connected LIVE.
* **Look:** how long each alert shows, size, position (top / middle / bottom), confetti on/off, thank-you line on/off, viewer picture on/off, waiting-line length.
* **Counting accuracy panel:** likes counted here vs TikTok's room total, gifts, coins, shares, duplicates blocked, and a **Start a fresh count now** button.
Settings are saved on the server and applied to every open game screen immediately. If `HOME_EDIT_KEY` is set, saving asks for it.

Files changed: server/engagement/engagement-tracker.js, engagement-hub.js, server/shared/records-store.js, platform-hub.js, server.js, public/shared/engagement.js, records-ui.js, records.html, package.json.
New API: GET /api/engagement/counters, POST /api/engagement/reset, GET /api/records/settings (POST extended).
