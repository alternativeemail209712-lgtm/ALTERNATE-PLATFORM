// ============================================================================
// A general-purpose English word list (like the one dictionary.js fetches)
// is scraped from spell-check dictionaries and includes plenty of words
// that are technically "real" but not appropriate to have pop up
// unannounced on a public livestream - profanity, slurs, and similar.
//
// This is a plain exact-match blocklist (never substring matching, which
// would wrongly catch innocent words that merely CONTAIN a blocked
// fragment - e.g. blocking a 3-letter fragment would take out dozens of
// completely unrelated everyday words). Matching is case-insensitive and
// exact-word only.
// ============================================================================

const RAW_BLOCKLIST = `
anal anus arse ass asses asshole assholes
bastard bastards bitch bitches bitchy bloody boner boob boobs
climax clit clitoris cock cocks cocksucker coon coons crap crappy cunt cunts
damn damned dick dicks dickhead dildo dyke dykes
ejaculate erotic escort faggot faggots fag fags fannies fanny
felch felching fellatio fuck fucked fucker fuckers fucking fucks
gangbang gook gooks handjob hentai homo horny hussy
incest jackoff jerkoff jizz junkie junkies kike kikes
labia lesbo lesbos libido masturbate masturbation molest molester
negro negroes nigga niggas nigger niggers nude nudity
orgasm orgy paki pakis pecker penis penises piss pissed pissing pisser
porn porno pornography poon prick pricks prostitute prude pube pubes pubic pussy pussies
queer queers rape raped raper rapist rapists retard retarded retards
scrotum semen sex sexual sexy shag shagged shit shits shitty shitted shithead
slag slags slave slaves slavery slut sluts slutty smut smutty
spic spics spunk stfu suck sucker sucks
testicle testicles thot thots titties titty tits tramp trannies tranny turd turds twat twats
vagina vaginal vulva wank wanker wankers whore whores whorish
` .trim().split(/\s+/);

export const BLOCKLIST = new Set(RAW_BLOCKLIST.map((w) => w.toLowerCase()));

/** True if `word` should be excluded from the game's word banks. */
export function isBlocked(word) {
  return BLOCKLIST.has(String(word).toLowerCase());
}
