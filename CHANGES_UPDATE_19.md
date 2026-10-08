# Update 19 - TEXTLE changes (on top of Update 18)

File changed: server/textle/textle-server.js

- Guess length limits are now **4 to 25 letters** (MIN_GUESS_LENGTH = 4, MAX_GUESS_LENGTH = 25 near the top of the file).
  Applies to chat guesses, Offline guesses, hints and Test Mode alike.

Everything from Updates 17 and 18 is included. Deploy as before: push to GitHub, Render redeploys. No new dependencies or env vars.
