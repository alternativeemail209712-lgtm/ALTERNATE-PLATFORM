// ===================================================================
// PLATFORM ENTRY POINT
// One always-on server hosting seven independent games. Each game keeps
// its own files and its own Socket.IO namespace (or WebSocket path, for
// BLINDLE), so they never share state or event names — this file just
// wires up Express + Socket.IO/HTTP once and lets each game register
// itself.
//
//   /flagle/    - Flagle Live      (Socket.IO namespace /flagle)
//   /travle/    - TRAVLE Live      (Socket.IO namespace /travle)
//   /blindle/   - Blindle          (its own WebSocket path /blindle-ws)
//   /findle     - Findle Live      (Socket.IO namespace /findle)
//   /crossdle/  - CROSSDLE Live    (Socket.IO namespace /crossdle)
//   /twistle/   - TWISTLE Live     (Socket.IO namespace /twistle)
//   /oracle/    - ORACLE           (Socket.IO namespace /oracle)
//   /colorblindle/ - COLORBLINDLE  (Socket.IO namespace /colorblindle)
//   /colordle/ - COLORDLE  (Socket.IO namespace /colordle)
//   /structle/ - STRUCTLE  (Socket.IO namespace /structle)
//   /textle/   - TEXTLE    (Socket.IO namespace /textle)
//   /rangedle/ - RANGEDLE  (Socket.IO namespace /rangedle)
//   /codedle/  - CODEDLE   (Socket.IO namespace /codedle)
//   /shapedle/ - SHAPEDLE  (Socket.IO namespace /shapedle)
//
// IMPORTANT: "./server/env-bridge.js" is imported FIRST, before any
// game module. ES module imports are hoisted and evaluated in the
// order they're listed — several games read their TikTok sign-in key
// from process.env at their own module-load time, so the env-var
// mirroring in env-bridge.js has to run before those modules load, or
// a game imported earlier would still see an empty value for whichever
// env var name it doesn't use directly. (This was previously a real
// bug: the mirroring lived below the game imports in this file, so it
// always ran too late to help.)
// ===================================================================

import "dotenv/config";
import "./server/env-bridge.js";

import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { Server } from "socket.io";

import { registerFlagle } from "./server/flagle.js";
import { registerTravle } from "./server/travle.js";
import { mountBlindle } from "./server/blindle/blindle-server.js";
import { mountRangedle } from "./server/rangedle/rangedle-server.js";
import { mountCodedle } from "./server/codedle/codedle-server.js";
import { mountShapedle } from "./server/shapedle/shapedle-server.js";
import { mountOracle } from "./server/oracle/oracle-server.js";
import { mountColorblindle } from "./server/colorblindle/colorblindle-server.js";
import { mountColordle } from "./server/colordle/colordle-server.js";
import { mountStructle } from "./server/structle/structle-server.js";
import { mountTextle } from "./server/textle/textle-server.js";
import { registerFindle } from "./server/findle/findle-server.cjs";
import { registerCrossdle } from "./server/crossdle/crossdle.js";
import { registerTwistle } from "./server/twistle/twistle.js";
import { Engagement } from "./server/engagement/engagement-hub.js";
import { ColorShadesHub } from "./server/shared/color-shades-hub.js";
import { LegendHub } from "./server/shared/legend-hub.js";
import { serveHostAvatar, hostAvatarStatus } from "./server/shared/host-avatar.js";
import { HostPresence } from "./server/shared/host-presence.js";
import { mountHomeCards } from "./server/shared/home-cards-store.js";
import { mountHomeGroups } from "./server/shared/home-groups-store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Safety net shared by every game on this server: one bad event handler
// or library-internal bug should never take down the whole process (which
// would disconnect every host currently live across every game).
process.on("uncaughtException", (err) => {
  console.error("Uncaught exception (kept server alive):", err);
});
process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection (kept server alive):", err);
});

// The connected host's TikTok profile picture, downloaded and kept by the server (see
// server/shared/host-avatar.js) so every browser loads it from this site and it can never be blocked,
// expire or be an unsupported format. Registered before the static files and every game.
app.get("/host-avatar/:name", serveHostAvatar);
app.get("/host-avatar-status/:name", hostAvatarStatus);

// HOME page (update 30): which TikTok host is connected right now (top-left banner "<HOST> LIVE GAMES" +
// round profile picture) and the host's saved design of the game cards. See server/shared/host-presence.js
// and server/shared/home-cards-store.js. Both use the Socket.IO namespace /home-hub.
HostPresence.init(io, app);
mountHomeCards(app, io, express);
mountHomeGroups(app, io, express);

// Serves /public/index.html at "/", and transparently serves
// /public/flagle/*, /public/travle/*, /public/crossdle/*, and
// /public/twistle/* at their matching URLs, plus the shared /shared/*
// theme + celebration assets every game links to — one static
// middleware covers the whole platform.
app.use(express.static(path.join(__dirname, "public")));

// Platform-wide Gift/Like/Share alerts + diagnostics + host Test Event
// panel — one shared module every game's TikTok connection reports into
// (see server/engagement/engagement-hub.js). Initialized before any game
// registers so Engagement.attach() is ready the instant a game connects.
Engagement.init(io);

// Platform-wide "Color shades" (update 16): remembers each game's 10-step color choices and keeps
// every screen connected to a game in sync (Socket.IO namespace /shades). See
// server/shared/color-shades-hub.js and public/shared/color-shades.js.
ColorShadesHub.init(io);

// Platform-wide customizable color legends (update 24): remembers how the host arranged each game's
// legend (position, size, font, order, texts, rows/columns) and keeps every screen of that game in
// sync (Socket.IO namespace /legends). See server/shared/legend-hub.js and public/shared/legend.js.
LegendHub.init(io);

registerFlagle(io);
registerTravle(io);
registerFindle(app, io);
await registerCrossdle(app, io);

// TWISTLE shares BLINDLE's word bank + 370,000+ word dictionary (see
// server/twistle/twistle.js) — the dictionary module only ever fetches
// once no matter which of the two games loads first, so registering
// TWISTLE here (before BLINDLE mounts, below) just means TWISTLE is the
// one that kicks the fetch off; BLINDLE then reuses the same result.
await registerTwistle(app, io);

// Blindle ships as a self-mounting module: it serves its own static
// folder and opens its own WebSocketServer (bound to the shared
// httpServer, on its own /blindle-ws path) rather than using Socket.IO.
// Awaited so the real ~370,000-word dictionary is loaded before the
// server starts accepting connections.
await mountBlindle(app, server, { mountPath: "/blindle", wsPath: "/blindle-ws" });

// ORACLE is BLINDLE's sibling (shuffled, uncolored clue columns). It reuses
// BLINDLE's word bank + dictionary (already loaded above - the dictionary only
// ever loads once) and runs on its own Socket.IO namespace /oracle, so it never
// touches BLINDLE's WebSocket path.
await mountOracle(app, io, { mountPath: "/oracle" });

// COLORBLINDLE is BLINDLE's sibling too (4-color shuffled keyboard + color counts,
// green/gray tile feedback). Same word bank + dictionary reuse, own Socket.IO
// namespace /colorblindle.
await mountColorblindle(app, io, { mountPath: "/colorblindle" });

// COLORDLE is COLORBLINDLE's sibling: same shuffled 4-color keyboard and green/gray
// feedback, but instead of color COUNTS the board shows a row of empty colored boxes
// (one per hidden letter) that chat must match against the keyboard colors.
// Own Socket.IO namespace /colordle.
await mountColordle(app, io, { mountPath: "/colordle" });

// STRUCTLE is a BLINDLE sibling too: the clue is two numbers per guess (difference in
// total straight lines, difference in total curves); the round is won when both are 0.
// No keyboard / manual coloring. Own Socket.IO namespace /structle.
await mountStructle(app, io, { mountPath: "/structle" });

// TEXTLE is an ARRANG-O-style BLINDLE sibling: each guess is cut into green / yellow / gray
// SEGMENTS (green segments at the edges get rounded ends) and the keyboard colors itself.
// Hidden words are 4-15 letters by default (host can go 4-20). Reuses BLINDLE's dictionary
// (loaded once) and has its own Socket.IO namespace /textle.
await mountTextle(app, io, { mountPath: "/textle" });

// RANGEDLE is a BLINDLE copy with a different clue: every letter of a guess is colored by how far
// it is along the alphabet from the hidden letter (red 1-5, orange 6-10, yellow 11-15, blue 16-20,
// purple 21-25, green = correct). Numbered keyboard + legend, keys turn green by themselves.
// Like ORACLE it runs on its own Socket.IO namespace /rangedle (so it can never collide with
// BLINDLE's WebSocket path) and reuses BLINDLE's word bank + dictionary (loaded once).
await mountRangedle(app, io, { mountPath: "/rangedle" });

// CODEDLE is a BLINDLE copy built on the SEQUENC-O idea: the board opens with a row of number-code
// digits (each letter's place if the hidden word's letters were sorted A-Z) and every guess letter is
// colored green / yellow / blue / pink / gray. The keyboard colors itself. Scoring: 1 point per guess
// on the board, 5 for solving the round. Own Socket.IO namespace /codedle; reuses BLINDLE's word bank
// + dictionary (loaded once).
await mountCodedle(app, io, { mountPath: "/codedle" });

// SHAPEDLE is a BLINDLE copy built on the SHAPE-O idea: the board opens with a row of cute symbols (one
// per letter of the hidden word; the same letter repeats the same symbol) and every guess letter is
// colored green / yellow / gray. The keyboard colors itself. Scoring: 1 point per guess on the board,
// 5 for solving the round. The host picks the symbol style. Own Socket.IO namespace /shapedle; reuses
// BLINDLE's word bank + dictionary (loaded once).
await mountShapedle(app, io, { mountPath: "/shapedle" });

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Game platform running on port ${PORT}`);
});

