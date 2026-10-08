# Update 21 - TEXTLE accepts wider guesses (on top of Update 20)

## Problem
TEXTLE rejected any guess that could not be the secret word, based on the clues already on the board
("Conflicts with the clue from guess #N"). Viewers don't know the answer, so they could not probe, for
example, whether a letter appears twice, or whether a letter sits before/after another one.

## Fix (`server/textle/textle-server.js`)
- The clue-consistency rejection is now OFF by default. Any real word (in the dictionary, or any possible
  answer) of 4-25 letters is accepted onto the board and colored against the secret word.
- To bring the old strict rule back, set the environment variable `TEXTLE_STRICT_CLUES=1` in Render.
- Not-a-real-word guesses are still ignored, as before.
- Settings text for the rejection message was updated to match.

## Deploy
Same as before: push to GitHub, Render redeploys. No new dependencies. No required environment variables.
