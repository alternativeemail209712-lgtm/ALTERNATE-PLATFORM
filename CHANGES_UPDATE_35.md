# Update 35 - HOME: 35 layouts, host-made groups, mobile + desktop (on top of Update 34)
* **Groups are now yours.** The built-in categories are gone. Tap **🗂️ Groups** on the HOME page: add groups with any names, rename, reorder, delete, and put each game in one.
  Groups show as filter buttons and as headings in Sections / Hero / Tabs / Folders. Saved on the server (data/home-groups.json) so phone and computer share them, and also in the browser as a backup.
  If you set HOME_EDIT_KEY, saving groups asks for the same key as the card customizer (once per device).
* **Surprise me removed.**
* **Layout picker**: one button (+ arrows) opens a gallery of 35 layouts. 22 are new: Trio, Quad, Posters, Wide, Masonry, Stripes, Minimal, Stickers, Glass, Night, Terminal, Cartridge, Ticket, Polaroid, Gradient, Zigzag, Ranked, Table, Stories, Tabs, Spotlight, Folders.
* **Phone and computer**: layouts use more columns on tablets/desktops (up to 1120px wide), bigger touch targets, hover effects, scroll buttons on desktop, keyboard: [ ] change layout, / search, Esc close, arrows in Spotlight.
* **The 5 icons (Live chat / Test / Offline / Leaderboard / Gifts) always stay on ONE row**, on every screen size.
Default layout for new visitors: DEFAULT_VIEW at the top of public/home-views.js. Preview by link: /?view=bands
New files: server/shared/home-groups-store.js, public/home-views.css, public/home-views.js (rewritten). server.js: 2 lines added.
