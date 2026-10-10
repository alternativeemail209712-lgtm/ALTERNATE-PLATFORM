# Update 45 - CODEDLE: guesses must now obey the code

**Problem:** the numbers (the "code") shown above the board were never enforced. Any real word of the right length was accepted, so guesses (often the first ones, and the automatic starter word) could break the pattern of which letters come before / after others in the alphabet.

**Fix (server/codedle/codedle-server.js):**
* A guess is accepted only if sorting its letters alphabetically gives the SAME numbers as the code on screen (repeated letters numbered left to right). Example: code 4 1 2 3 accepts TELL-type patterns only.
* Applies to every audience comment, to host/offline guesses, and to the automatic starter word (the starter is now picked only from words that follow the code; if none exists the round simply starts blank).
* Hints only suggest code-following words (when any exist).
* Audience guesses that break the code are ignored silently (no on-screen toast, so random words can't flood the screen). A host/offline guess shows: `"WORD" doesn't follow the code ...`.
* Test mode viewers now mostly send code-following words so the demo still looks lively.
* Also includes the Update 44 avatar crash fix.

Strict fit (settings) still works on top of this. No data/settings changes; deploy over Update 44.
