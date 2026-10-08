// textle-answers.js
// SECRET-word pool for TEXTLE. It reuses BLINDLE's curated word bank (4-20 letters) and adds
// a batch of extra everyday long words (11-20 letters) so long rounds don't repeat the same
// handful of answers. Every word is a real, recognizable English word; lazy "+s" plurals are skipped.
// Guesses are checked against the same 370,000+ word dictionary BLINDLE uses.
import { ANSWER_WORDS as BLINDLE_WORDS, MIN_WORD_LENGTH, MAX_WORD_LENGTH } from "../blindle/blindle-answers.js";

const EXTRA_LONG_WORDS = {
  11: [
    "businessman", "combination", "comfortably", "competition", "convenience", "cooperation", "counterfeit", "development", "documentary", "educational", "electrician", "engineering", "environment", "examination", "expectation", "explanation", "exploration", "familiarity", "fascinating", "fashionable", "flexibility", "forgiveness", "fundraising", "furthermore", "gentlemanly", "handwriting", "hardworking", "hospitality", "illuminated", "imagination", "imaginative", "improvement", "independent", "indigestion", "industrious", "inexpensive", "inheritance", "inspiration", "instruction", "integration", "interaction", "interesting", "involvement", "landscaping", "legislation", "magnificent", "maintenance", "marketplace", "marshmallow", "masterpiece", "measurement", "mischievous", "mountaineer", "nationality", "negotiation", "objectively", "observatory", "operational", "outstanding", "partnership", "permanently", "persistence", "personality", "perspective", "photography", "pollination", "possibility", "practically", "predictable", "preparation", "programming", "progressive", "prohibition", "publication", "quarterback", "radioactive", "recognition", "reliability", "remembrance", "renaissance", "replacement", "requirement", "restriction", "scholarship", "secretarial", "selfishness", "sensational", "shortcoming", "spectacular", "speculation", "statistical", "substantial", "subtraction", "supermarket", "supervision", "sympathetic", "temperature", "temporarily", "terminology", "territorial", "threatening", "traditional", "translation", "transparent", "trustworthy", "uncertainty", "underground", "unhappiness", "unnecessary", "utilization", "ventilation", "wonderfully"
  ],
  12: [
    "acquaintance", "aerodynamics", "announcement", "architecture", "availability", "breathtaking", "championship", "cheerfulness", "choreography", "clairvoyance", "complication", "concentrated", "consequently", "conservation", "considerably", "construction", "contemporary", "contribution", "conventional", "conversation", "dictatorship", "disagreement", "discouraging", "disobedience", "distribution", "dramatically", "economically", "encyclopedia", "enthusiastic", "exaggeration", "experimental", "extinguisher", "friendliness", "gratefulness", "helplessness", "horizontally", "housekeeping", "humanitarian", "hypothetical", "illustration", "inconvenient", "incorporated", "independence", "inflammation", "instrumental", "intellectual", "intelligence", "interference", "intermediate", "interruption", "intersection", "introduction", "jurisdiction", "kindergarten", "mathematical", "neighborhood", "nevertheless", "notification", "nutritionist", "occasionally", "occupational", "organization", "paleontology", "photographer", "prescription", "preservation", "presidential", "productivity", "professional", "refrigerator", "regeneration", "relationship", "reproduction", "satisfaction", "significance", "snowboarding", "southwestern", "spokesperson", "subscription", "surprisingly", "surveillance", "thanksgiving", "thunderstorm", "transparency", "unbelievable", "unreasonable", "volunteering", "weatherproof"
  ],
  13: [
    "advertisement", "appropriately", "approximately", "archaeologist", "authoritative", "automatically", "businesswoman", "collaboration", "communication", "companionship", "comprehensive", "concentration", "consciousness", "consideration", "controversial", "correspondent", "corresponding", "craftsmanship", "demonstration", "determination", "distinguished", "documentation", "effectiveness", "embarrassment", "encouragement", "enlightenment", "entertainment", "environmental", "establishment", "exceptionally", "extraordinary", "fundamentally", "globalization", "heartbreaking", "impossibility", "inappropriate", "individuality", "intentionally", "international", "investigation", "irreplaceable", "irresponsible", "knowledgeable", "manufacturing", "miscellaneous", "parliamentary", "participation", "perfectionist", "philosophical", "physiotherapy", "pronunciation", "psychological", "qualification", "questionnaire", "realistically", "reinforcement", "revolutionary", "schoolteacher", "sophisticated", "specification", "spontaneously", "sportsmanship", "stereotypical", "strategically", "unconditional", "understanding", "unforgettable", "unfortunately", "vulnerability", "worthlessness"
  ],
  14: [
    "accomplishment", "accountability", "administration", "administrative", "affectionately", "agriculturally", "apprenticeship", "astronomically", "cardiovascular", "characteristic", "circumnavigate", "circumstantial", "classification", "congratulation", "constitutional", "disappointment", "discrimination", "generalization", "geographically", "identification", "implementation", "infrastructure", "interpretation", "multiplication", "organizational", "oversimplified", "overwhelmingly", "pharmaceutical", "photosynthesis", "recommendation", "reconciliation", "rehabilitation", "representation", "representative", "responsibility", "sentimentality", "simultaneously", "superintendent", "supernaturally", "sustainability", "thermodynamics", "thoughtfulness", "transformation", "transportation", "uncompromising", "uncontrollable", "understandable", "unenthusiastic", "unprofessional", "unquestionable", "unrecognizable", "weightlessness", "wholeheartedly"
  ],
  15: [
    "acknowledgement", "anthropomorphic", "bioluminescence", "cinematographer", "compassionately", "confidentiality", "conscientiously", "decontamination", "differentiation", "disorganization", "electromagnetic", "environmentally", "experimentation", "extraordinarily", "hospitalization", "incompatibility", "inconsequential", "instantaneously", "instrumentation", "interchangeable", "internationally", "psychotherapist", "straightforward", "thoughtlessness", "troubleshooting", "uncontroversial", "unsportsmanlike"
  ],
  16: [
    "autobiographical", "constitutionally", "counterbalancing", "counterclockwise", "counterintuitive", "decentralization", "disqualification", "enthusiastically", "entrepreneurship", "environmentalist", "extraterrestrial", "hydroelectricity", "hypercompetitive", "hypersensitivity", "immunodeficiency", "indiscriminately", "intercontinental", "internationalize", "misappropriation", "misunderstanding", "overcompensation", "pseudoscientific", "thermoregulation", "transcontinental", "transformational", "unapologetically", "unconstitutional", "unconventionally", "unsatisfactorily"
  ],
  17: [
    "compartmentalized", "constitutionality", "contradistinction", "counterproductive", "electrocardiogram", "electromechanical", "indistinguishable", "institutionalized", "interdisciplinary", "intergovernmental", "interrelationship", "misinterpretation", "misrepresentation", "multidisciplinary", "nondiscrimination", "straightforwardly", "telecommunication", "unselfconsciously", "unsympathetically"
  ],
  18: [
    "characteristically", "counterintuitively", "disenfranchisement", "disproportionately", "electrocardiograph", "electroluminescent", "interconnectedness", "overgeneralization", "oversimplification", "unconstitutionally"
  ],
  19: [
    "counterintelligence", "incomprehensibility"
  ],
  20: [
    "compartmentalization", "counterrevolutionary", "electroencephalogram", "indistinguishability", "institutionalization", "internationalization", "uncharacteristically"
  ]
};

function mergePools() {
  const merged = {};
  for (let n = MIN_WORD_LENGTH; n <= MAX_WORD_LENGTH; n++) {
    const set = new Set((BLINDLE_WORDS[n] || []).map((w) => w.toLowerCase()));
    for (const w of EXTRA_LONG_WORDS[n] || []) {
      if (w.length === n && /^[a-z]+$/.test(w)) set.add(w);
    }
    merged[n] = [...set];
  }
  return merged;
}

export const ANSWER_WORDS = mergePools();
export { MIN_WORD_LENGTH, MAX_WORD_LENGTH };
