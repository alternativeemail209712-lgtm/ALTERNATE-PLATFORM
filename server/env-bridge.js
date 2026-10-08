// ===================================================================
// Env var bridge — must be imported BEFORE any game module.
//
// Flagle/TRAVLE historically read TIKTOK_SIGN_API_KEY, while Blindle/
// Findle/CROSSDLE (ported from separate projects) read
// EULERSTREAM_API_KEY. Both names refer to the exact same EulerStream
// key, so mirror whichever one is set onto the other — the host only
// ever needs to set ONE environment variable on Render and every game
// picks it up.
//
// IMPORTANT: this only works correctly if it is imported before any
// game module. ES module `import` statements are hoisted — every
// imported module is evaluated *before* the importing file's own
// top-level code runs, in the order the import statements appear. Each
// game module reads process.env.* at its own top level (module load
// time), so this bridge must be the very first import in server.js —
// ahead of every `registerXxx`/`mountXxx` import — or a game imported
// earlier would still see an empty value for whichever env var name it
// doesn't use directly.
// ===================================================================

if (process.env.EULERSTREAM_API_KEY && !process.env.TIKTOK_SIGN_API_KEY) {
  process.env.TIKTOK_SIGN_API_KEY = process.env.EULERSTREAM_API_KEY;
}
if (process.env.TIKTOK_SIGN_API_KEY && !process.env.EULERSTREAM_API_KEY) {
  process.env.EULERSTREAM_API_KEY = process.env.TIKTOK_SIGN_API_KEY;
}
