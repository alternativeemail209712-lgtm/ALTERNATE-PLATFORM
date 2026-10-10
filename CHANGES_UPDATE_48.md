# Update 48 - Word language: English, Indonesian, Bahasa Melayu (Malaysia) + 4 mixes

Every word game except FLAGLE and TRAVLE can now be played in **7 word-language modes**:

| # | Mode | Secret words and accepted guesses |
|---|------|-----------------------------------|
| 1 | English | English (as before) |
| 2 | Bahasa Indonesia | Indonesian |
| 3 | Bahasa Melayu (Malaysia) | Malay (Malaysia) |
| 4 | Mixed: English + Indonesian | rounds alternate between the two |
| 5 | Mixed: English + Bahasa Melayu | rounds alternate between the two |
| 6 | Mixed: Bahasa Melayu + Indonesian | rounds alternate between the two |
| 7 | Mixed: all three | rounds spread over all three |

**Games covered (12):** BLINDLE, ORACLE, COLORBLINDLE, COLORDLE, STRUCTLE, TEXTLE, RANGEDLE, CODEDLE, SHAPEDLE, TWISTLE, CROSSDLE and FINDLE.

## How to use
Open a game -> **Settings** -> new section **Word language** (right above *Strict fit*) -> pick a mode.
FINDLE has the same dropdown on its host page (above *Timing*).

* The choice is **per game** and is **remembered** (`data/word-language.json`, FINDLE: `data/findle-language.json`) - same behaviour as Strict fit.
* It applies right away. A round that is running restarts in the new language (the old secret word would be in the wrong language).
* In **mixed** modes every language gets a fair share of the rounds. English has ~8,600 secret words and the other two are smaller, so the smaller languages' words are given extra weight in the draw so a mixed game is not 80 % English. (Words that are the same in Indonesian and Malay count for both.)
* Guesses are checked against the chosen language(s) only: in Malay mode an English word is rejected, in a mixed mode a word from any of the chosen languages is accepted.
* Word-length choices that the chosen language has no words for are hidden automatically (Indonesian: up to 13 letters, Malay: up to 12; anything with English goes up to 18-20).
* Difficulty tiers (Normal / Medium / Hard / Random) work in every language: longer and more formal words (for example *kesejahteraan*, *pertanggungjawaban*) lean to Medium / Hard.
* FINDLE: puzzles are themed word searches written in each language (Indonesian: 17 easy / 8 medium / 8 hard themes, Malay: the same). Mixed modes pick one of the chosen languages for each new puzzle.

## Word lists - please read (honest limits)
* **English** is unchanged: ~8,600 secret words, 370,000+ accepted guesses (downloaded at start-up as before).
* **Indonesian and Malay secret words** are bundled in `server/shared/lang/` (about 1,300 words each, 4-13 letters, family-friendly, no proper names). That is smaller than the English bank, so after a few hundred rounds at one length a word can come round again.
* **Accepted guesses in Indonesian / Malay** start from those same bundled words. To accept far more real words, give the server a bigger list - nothing else needs to change:
  * drop a plain text file (one word per line, lowercase) at `data/dictionary-id.txt` and/or `data/dictionary-ms.txt`, **or**
  * set `ID_DICTIONARY_URL` / `MS_DICTIONARY_URL` in Render -> Environment to a raw text-file URL.
  The server also tries a public Indonesian word list on start-up and caches it; if that download fails the bundled words still work. No Malay list is downloaded by default, so Malay guesses are limited to the bundled words until you add a file or URL. Settings -> Word language shows how many words are loaded.
* To extend the secret words, edit `server/shared/lang/lexicon-common.js` (same in both), `lexicon-id.js` or `lexicon-ms.js` (just add words separated by spaces, lowercase a-z, 4+ letters) - duplicates are removed automatically. FINDLE themes: `server/findle/findle-puzzles-id.cjs` / `-ms.cjs`.

## What changed in the code
* NEW `server/shared/word-language.js` - the 7 modes, per-game remembered choice, language word banks, guess checking, fair mixing, optional big dictionaries.
* NEW `server/shared/lang/lexicon-common.js`, `lexicon-id.js`, `lexicon-ms.js` - bundled word lists.
* NEW `public/shared/word-language.js` - the Settings dropdown, shared by all 11 letter games.
* NEW `server/findle/findle-language.cjs`, `findle-puzzles-id.cjs`, `findle-puzzles-ms.cjs`.
* Each game server: word bank, longest length, difficulty index and guess check now follow the chosen language; new message `set_word_language` (TWISTLE / CROSSDLE: `host:setWordLanguage`).
* Each game page: loads `/shared/word-language.js` and calls it from its render function (one line).
* The Settings panels show how many words the chosen language has. No change to scoring, TikTok connection or the other settings.
