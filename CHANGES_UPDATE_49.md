# Update 49 - Much bigger Indonesian + Malay (Malaysia) word banks

Only the word data and its loader changed. Scoring, TikTok connection, settings and every game screen are untouched.

## Numbers (before -> after, per language)

| | Update 48 | Update 49 |
|---|---|---|
| Secret words, Indonesian | 1,338 | **6,484** (630 of them longer/formal "hard" words) |
| Secret words, Malay (Malaysia) | 1,338 | **6,500** (637 hard) |
| Accepted guesses, Indonesian (bundled, works offline) | 1,338 | **15,242** |
| Accepted guesses, Malay (bundled, works offline) | 1,338 | **15,259** |

English is unchanged: about 8,640 secret words and 370,000+ accepted guesses.

## Please read - honest limits
* I had no internet access while building this, so **no word was checked against KBBI or Kamus Dewan online**. The lists were written from knowledge of both languages, then expanded with the real affix rules (below). Almost everything will be right, but a few odd forms may slip through, and some rarer real words will be missing.
* The secret-word banks are **not yet the same size as English** (about 75% of it). Rounds at one word length will repeat sooner than in English.
* The accepted-guess lists are **much bigger but not a full KBBI / Kamus Dewan**. Indonesian still downloads the public KBBI-based list at start-up when the server has internet and ADDS it to the bundled words (nothing is lost if the download fails). Malay has no free list to download, so for the most complete Malay coverage drop a DBP-based word list at `data/dictionary-ms.txt` (one lowercase word per line) or set `MS_DICTIONARY_URL`. Same for Indonesian: `data/dictionary-id.txt` / `ID_DICTIONARY_URL`.

## How the criteria were adapted from English
English secret words are real, familiar, family-friendly, no proper names or abbreviations, no lazy "+s" plurals, split into everyday and harder words. The Indonesian / Malay equivalents:
* **Real words only**: base words (kata dasar) and well-formed affixed words (meN-, di-, ber-, ke-an, peN-an, per-an, ter-). No hyphenated reduplication (anak-anak), no abbreviations, no foreign unassimilated words, no proper names.
* **No lazy inflection** (the "+s" rule): no -ku / -mu / -nya / -lah / -kah / -pun forms (bukunya, rumahku, pergilah).
* **Everyday vs harder**: base words and plain meN-/di- verbs are the everyday tier; longer, formal words (kesejahteraan, pertanggungjawaban, mempertimbangkan) lean to Medium / Hard rounds, as English "extended" words do.
* **Family-friendly and respectful**: crude, insulting, sexual, drug, gambling and alcohol words are never picked as secrets (they are still accepted if a viewer guesses them). Pork and dog words are never secret words either, out of respect for Malaysian and Indonesian Muslim audiences.
* **Each language keeps its own spelling**: Indonesian-only forms (mobil, sepeda, kantor, celana, maret) are rejected in Malay mode, and Malay-only forms (kasut, seluar, pejabat, jumaat, ogos) are rejected in Indonesian mode. Words spelled the same in both (rumah, makan, kereta, kampung) work in both.

## How the bigger lists were made
`tools/build-lexicon.mjs` reads root-word files in `server/shared/lang/roots/` and applies the real morphology: meN- nasal rules (membaca, menulis, mengambil, menyapu, mengecat, mencuci), peN- (pembaca, penulis, penyanyi), di-, ter-, ber- with its exceptions (bekerja, beternak, belajar), -an, -kan, -i, ke-an, per-an / pe-an and memper-. Secret words use only the safest forms; the guess dictionary accepts every grammatical form so a viewer's real word is not refused. The results are saved in `server/shared/lang/generated/` and loaded at start-up (no network needed).

## How to add more words later
1. Add root words to a file in `server/shared/lang/roots/`. File name = `common-` (both languages), `id-` (Indonesian only) or `ms-` (Malay only), then a class letter: `v` transitive verbs, `k` roots that take -kan, `i` roots that take -i, `b` ber- verbs, `a` adjectives, `m` adjectives that take memper-, `n` plain words, `h` harder / formal complete words, `d` looser ber-/pe- roots, `x` guess-only words (real but too rare for a secret word). Add a digit if you make a second file (`common-n5.txt`). Words are lowercase a-z separated by spaces; lines starting with `#` are notes.
2. `ms-reject.txt` / `id-reject.txt` list words that must be refused in one language; `nosecret.txt` lists real words never used as secrets.
3. Run `npm run build:lexicon` and redeploy. Take care that roots are real root words, not already-affixed forms.

## Files
NEW `tools/build-lexicon.mjs`, `server/shared/lang/roots/*`, `server/shared/lang/generated/*`. CHANGED `server/shared/word-language.js` (loads the generated files; a downloaded or dropped-in list now ADDS to them), `package.json` (version, `build:lexicon`). The update 48 lexicon files stay as the base the build starts from.
