// crossdle-answers.js
// CROSSDLE draws its SECRET word and its DECOY word from the exact same word bank as BLINDLE
// (see ../blindle/blindle-answers.js). As of Update 20 that bank holds ~8,700 familiar English
// words (4-20 letters) instead of ~4,000, so rounds repeat far less often. Sharing one bank
// keeps every game consistent - fix or extend a word once and every game picks it up.
export { ANSWER_WORDS, MIN_WORD_LENGTH, MAX_WORD_LENGTH } from '../blindle/blindle-answers.js';
