/**
 * Interface vocabulary that the product never uses (Ductus docs/PRODUCT.md §5,
 * "Rječnik sučelja"), ported from Ductus scripts/forbidden-terms/terms.ts at
 * d52a92c3 (S-1L.1, DAN-768, PR-b1). Not ported: entities.ts, since
 * locales/ holds no JSX or HTML; the characters check comes with PR-b2. The
 * markup readings (`findForbiddenTermsInMarkup` and its windows) came later
 * from Ductus 0cdb0f1f for the copied front (see the end of this file).
 * Where Ductus and §5 read word for word differ, the stricter side holds
 * (contract Ductus#1836 c.6890523605, confirmed in c.6890541239); such an
 * entry is marked "§5 delta N".
 *
 * Matching runs on folded text: NFKC, Croatian lower case, diacritics and
 * invisible characters removed, any other run of non-letters turned into one
 * space, so `autentica?n` catches "AUTENTIČNOST" and "autentičan". An entry
 * covers every form of its root, the word orders and synonyms of tables A and
 * B of #179 and its English equivalents (owner, 12. 10. 2026.). The allowed
 * actions of §5 ("Kopiraj navod", "kopiranje navoda", "Kopirano u
 * međuspremnik", "Copy citation", "Sakrij …", progress percentages) stay out of
 * every pattern, in exactly those words, and so does "Izjava o izvornosti rada"
 * (T10, owner decision, DAN-1034). That entry and its tests in terms.test.ts
 * are the one difference from the copy of ductura/Institution_server.
 */
export type Language = "hr" | "en";

export type ForbiddenTerm = {
  /** Entry from the dictionary table, as written in PRODUCT.md. */
  readonly entry: string;
  /** What the dictionary says to use instead. */
  readonly instead: string;
  /** Language of the forms the pattern matches. */
  readonly lang: Language;
  readonly pattern: RegExp;
  /**
   * Set when the pattern allows the word before certain words ("spremljeno na
   * uređaju"); it is matched on `foldPhrases`. `word` is the word alone, kept
   * from Ductus, where the markup reading uses it.
   */
  readonly contextual?: { readonly word: RegExp };
  /** Set when an allowed phrase must not be put together across a phrase end (`foldPhrases`). */
  readonly readsPhrases?: true;
  /**
   * Words the entry lets through (flag `g`), read by `allowedReading`: matched on `foldCase`, where every letter stays
   * as written, and masked only when `foldText` finds each of them as words of their own too.
   */
  readonly allows?: RegExp;
};

// Patterns are literals. Most keep letters and digits away from both ends of
// the term. `sumnj` and `rizik` match anywhere in a word, so derived forms and
// compounds ("posumnjati", "bezrizično") are caught; "križić" (folded "krizic")
// is the one exception, and invented surnames such as "Brizić" are known false
// positives. The contextual patterns keep only letters away from the word: a
// digit next to it ("Spremljeno 1") does not say where the work was saved.
const NOTHING = "(ništa; činjenice se prikazuju bez oznake)";
const AI_ORIGIN = "iz AI pomoćnika (model, vrijeme)";
const INTACT = "zapis je cjelovit i neizmijenjen od primitka";
const PASTED = "zalijepljeno (izvor nije opažen)";
const GAP = "praznina u zapisu";

export const FORBIDDEN_TERMS: readonly ForbiddenTerm[] = [
  { entry: "sumnjivo", instead: NOTHING, lang: "hr", pattern: /sumnj/u },
  { entry: "rizik", instead: NOTHING, lang: "hr", pattern: /(?<!k)rizi[kc]/u },
  // The English forms of this entry are the entry "anomaly" below.
  {
    entry: "anomalija, anomaly",
    instead: NOTHING,
    lang: "hr",
    pattern: /(?<![\p{L}\p{N}])anomal(?:ij|n|an(?![\p{L}\p{N}]))/u,
  },
  {
    entry: "upozorenje o studentu",
    instead: NOTHING,
    lang: "hr",
    pattern: /(?<![\p{L}\p{N}])upozoren\p{L}* o (?:\p{L}+ ){0,2}student/u,
  },
  {
    entry: "AI postotak",
    instead: AI_ORIGIN,
    lang: "hr",
    // A share by origin with or without the word (#179 A7): "udio AI-ja", "ljudski udio", "AI: 78 %", "78 % AI".
    pattern:
      /(?<![\p{L}\p{N}])(?:posto[tc]\p{L}* (?:ai(?![\p{L}\p{N}])|umjetn|ljudsk)|ai posto[tc]|(?:udio|udjel\p{L}*) (?:ai(?![\p{L}\p{N}])|umjetn|ljudsk|podrijetl|izvor)|(?:ai|ljudsk\p{L}*) (?:udio|udjel)|ai \d|\d+ (?:ai(?![\p{L}\p{N}])|ljudsk))/u,
  },
  // §5 delta 3: every form of the root, the adverb "vjerojatno" included (§5: "vjerojatnost (i vjerojatno)").
  // Ductus leaves the adverb out for its word list MODALS (src/domain/diff/diff.ts), which this repository does not have.
  {
    entry: "vjerojatnost",
    instead: AI_ORIGIN,
    lang: "hr",
    pattern: /(?<![\p{L}\p{N}])(?:naj|ne)?vjerojat/u,
  },
  {
    entry: "autentičnost",
    instead: AI_ORIGIN,
    lang: "hr",
    pattern: /(?<![\p{L}\p{N}])(?:(?:ne)?autentica?n|autenticitet)/u,
  },
  {
    entry: "napisao AI",
    instead: AI_ORIGIN,
    lang: "hr",
    pattern:
      /(?<![\p{L}\p{N}])(?:napisa\p{L}* (?:(?:ga|je) ){0,2}(?:ai(?![\p{L}\p{N}])|umjetn)|(?:ai|umjetn\p{L}* inteligencij\p{L}*) (?:(?:ga|je) ){0,2}napisa)/u,
  },
  {
    entry: "verificirano autorstvo",
    instead: INTACT,
    lang: "hr",
    pattern:
      /(?<![\p{L}\p{N}])(?:verificiran\p{L}* autorstv|autorstv\p{L}* (?:\p{L}+ ){0,2}verificiran)/u,
  },
  {
    entry: "dokaz autorstva",
    instead: INTACT,
    lang: "hr",
    pattern: /(?<![\p{L}\p{N}])dokaz\p{L}* (?:o )?autorstv/u,
  },
  // Every form of the root (#179 A1). §5 delta 1: only the three allowed actions of §5 stay, in exactly those words
  // ("Kopiraj navod", "kopiranje navoda", "Kopirano u međuspremnik", D-59); Ductus also lets every imperative
  // "kopiraj(te|mo)" and every case of the two nouns through. Any prefix ("ukopiran", "fotokopirano") is flagged.
  {
    entry: "kopirano",
    instead: PASTED,
    lang: "hr",
    pattern:
      /(?:(?<=[\p{L}\p{N}])kopir|(?<![\p{L}\p{N}])kopir(?!aj navod(?![\p{L}\p{N}]))(?!anje navoda(?![\p{L}\p{N}]))(?!ano u meduspremnik(?![\p{L}\p{N}])))/u,
    readsPhrases: true,
  },
  // Every form of the root (#179 A3), "prepiši" in a sync conflict included; not "prepiska" or "prepisci" (correspondence).
  {
    entry: "prepisano",
    instead: PASTED,
    lang: "hr",
    pattern: /(?<![\p{L}\p{N}])prepis(?!k|ci(?![\p{L}\p{N}]))/u,
  },
  {
    entry: "nestali podaci",
    instead: GAP,
    lang: "hr",
    pattern:
      /(?<![\p{L}\p{N}])(?:nesta\p{L}* poda[tc]|poda[tc]\p{L}* (?:\p{L}+ ){0,2}nesta(?:l\p{L}*|o|j\p{L}*|n(?:ak|e|u|em)?)(?![\p{L}\p{N}]))/u,
  },
  // §5 delta 4: B8 of #179 ("nedostajući / izgubljeni podaci") applies only to the record of the process in the teacher
  // view and the summary. The scan cannot tell that from a recovery message on the student's device, so here the row is
  // checked always (Ductus leaves it out, owner 23. 10. 2026.). A text that meets the condition needs a listed exception.
  {
    entry: "nedostajući podaci",
    instead: GAP,
    lang: "hr",
    pattern:
      /(?<![\p{L}\p{N}])(?:(?:nedostaj|izgublj)\p{L}* (?:\p{L}+ )?poda[tc]|poda[tc]\p{L}* (?:\p{L}+ ){0,2}(?:nedostaj|izgub)\p{L}*)/u,
  },
  // The adjective and participle only (#179 A5): the imperative "Sakrij …" stays (owner decision 6).
  {
    entry: "skriveno",
    instead: GAP,
    lang: "hr",
    pattern: /(?<![\p{L}\p{N}])(?:sakriv|prikriv|skriv)en/u,
  },
  // New rows of #179 table B. The adjectives "izvorni / originalni" and "nepravilan format" stay allowed.
  { entry: "plagijat", instead: NOTHING, lang: "hr", pattern: /(?<![\p{L}\p{N}])plagi[jr]/u },
  // T10, owner decision (DAN-1034): exactly the phrase "Izjava o izvornosti rada" stays (`allows`); every other form
  // is flagged, a phrase with a letter that only folds into it ("rađa", "ráda") included.
  {
    entry: "izvornost",
    instead: INTACT,
    lang: "hr",
    pattern: /(?<![\p{L}\p{N}])(?:izvornos[tc]|originalnos[tc])/u,
    // A mark before the words belongs to the character before them (the emoji selector U+FE0F); one after them would
    // change their last letter.
    allows: /(?<![\p{L}\p{N}])izjava o izvornosti rada(?![\p{L}\p{N}\p{M}])/gu,
  },
  {
    entry: "integritet",
    instead: "cjelovitost zapisa",
    lang: "hr",
    pattern: /(?<![\p{L}\p{N}])integritet/u,
  },
  {
    entry: "neobično",
    instead: NOTHING,
    lang: "hr",
    pattern: /(?<![\p{L}\p{N}])(?:neobic|neuobicajen)/u,
  },
  // §5 delta 4: "nepravilno" too, checked always; "nepravilan format" stays allowed.
  {
    entry: "nepravilnost",
    instead: NOTHING,
    lang: "hr",
    pattern: /(?<![\p{L}\p{N}])nepraviln(?:os[tc]|o(?![\p{L}\p{N}]))/u,
  },
  {
    entry: "tuđi tekst",
    instead: PASTED,
    lang: "hr",
    pattern:
      /(?<![\p{L}\p{N}])(?:tud\p{L}* (?:tekst(?:a|u|om|ovi|ova|ovima|e)?|rijec(?:i|ju|ima)?)(?![\p{L}\p{N}])|(?:nije|nisu) (?:vlastit|njegov|njezin|njen)\p{L}* (?:tekst(?:a|u|om|ovi|ova|ovima|e)?|rijec(?:i|ju|ima)?|odlom(?:ak|ka|ku|kom|ke|ci|aka|cima)|rad(?:a|u|om|e|ovi|ova|ovima)?)(?![\p{L}\p{N}])|(?:tekst(?:a|u|om|ovi|ova|ovima|e)?|rijec(?:i|ju|ima)?|odlom(?:ak|ka|ku|kom|ke|ci|aka|cima)|rad(?:a|u|om|e|ovi|ova|ovima)?)(?![\p{L}\p{N}]) (?:nije|nisu) (?:vlastit|njegov|njezin|njen)\p{L}*)/u,
  },
  {
    entry: "napisao čovjek",
    instead: "opaženo pisanje u uređivaču",
    lang: "hr",
    pattern:
      /(?<![\p{L}\p{N}])(?:ljudsk\p{L}* napisa|napisa\p{L}* (?:(?:ga|je) ){0,2}covjek|covjek\p{L}* (?:(?:ga|je) ){0,2}napisa)/u,
  },
  {
    entry: "spremljeno (bez pojašnjenja)",
    instead: "spremljeno na uređaju / spremljeno na poslužitelju / predano",
    lang: "hr",
    pattern: /(?<!\p{L})spremljen\p{L}*(?!\p{L})(?! na (?:uredaju|posluzitelju)(?![\p{L}\p{N}]))/u,
    contextual: { word: /(?<![\p{L}\p{N}])spremljen\p{L}*(?![\p{L}\p{N}])/u },
  },
  // The same entries in the English interface (D-90, point 3).
  {
    entry: "suspicious",
    instead: NOTHING,
    lang: "en",
    pattern: /(?<![\p{L}\p{N}])(?:suspic|suspect|doubt)/u,
  },
  {
    entry: "risk",
    instead: NOTHING,
    lang: "en",
    pattern: /(?<![\p{L}\p{N}])(?:low|high|zero|no)?risk/u,
  },
  {
    entry: "anomaly",
    instead: NOTHING,
    lang: "en",
    pattern: /(?<![\p{L}\p{N}])anomal(?:y|ies|ous|istic)/u,
  },
  {
    entry: "warning about the student",
    instead: NOTHING,
    lang: "en",
    pattern:
      /(?<![\p{L}\p{N}])(?:(?:warning|alert)s? (?:about|on|regarding|concerning) (?:the |a |this |these |that |those )?student|student\p{L}* (?:warning|alert))/u,
  },
  {
    entry: "AI percentage",
    instead: AI_ORIGIN,
    lang: "en",
    pattern:
      /(?<![\p{L}\p{N}])(?:ai percent|percent\p{L}* (?:of )?(?:ai(?![\p{L}\p{N}])|artificial|human)|(?:ai|human) (?:share|percent|proportion)|humanness|\d+ (?:ai|human)(?![\p{L}\p{N}]))/u,
  },
  {
    entry: "probability",
    instead: AI_ORIGIN,
    lang: "en",
    pattern: /(?<![\p{L}\p{N}])(?:probab(?:il|l)|likelihood)/u,
  },
  // "authentic", "authentically", "authenticity" and "inauthentic", not "authenticate" or "authentication".
  {
    entry: "authenticity",
    instead: AI_ORIGIN,
    lang: "en",
    pattern: /(?<![\p{L}\p{N}])(?:in|un)?authentic(?!at)/u,
  },
  {
    entry: "written by AI",
    instead: AI_ORIGIN,
    lang: "en",
    pattern:
      /(?<![\p{L}\p{N}])(?:(?:written|generated) by (?:ai(?![\p{L}\p{N}])|artificial)|ai (?:written|generated|wrote)(?![\p{L}\p{N}]))/u,
  },
  {
    entry: "verified authorship",
    instead: INTACT,
    lang: "en",
    pattern: /(?<![\p{L}\p{N}])verified authorship/u,
  },
  {
    entry: "proof of authorship",
    instead: INTACT,
    lang: "en",
    pattern: /(?<![\p{L}\p{N}])proofs? of authorship/u,
  },
  {
    entry: "copied",
    instead: PASTED,
    lang: "en",
    // §5 delta 2: every word that starts with a form of "copy" (copyright included), except "Copy citation" (D-59).
    // Ductus lets "Copy", "copies" and "Copied to clipboard" through. A prefixed form ("recopy", "photocopied") is flagged.
    pattern:
      /(?<=[\p{L}\p{N}])cop(?:y|ie)|(?<![\p{L}\p{N}])cop(?:y(?! citation(?![\p{L}\p{N}]))|ie)/u,
    readsPhrases: true,
  },
  // §5 delta 5: "vanished data" (row "nestali podaci"), which Ductus does not have.
  {
    entry: "vanished data",
    instead: GAP,
    lang: "en",
    pattern: /(?<![\p{L}\p{N}])(?:vanished data|data (?:\p{L}+ ){0,2}vanished)/u,
  },
  // §5 delta 4: "lost data" with "missing data", checked always (the row of "nedostajući podaci").
  {
    entry: "missing data",
    instead: GAP,
    lang: "en",
    pattern:
      /(?<![\p{L}\p{N}])(?:(?:missing|lost) (?:\p{L}+ )?data|data (?:\p{L}+ ){0,2}(?:missing|lost))(?![\p{L}\p{N}])/u,
  },
  { entry: "hidden", instead: GAP, lang: "en", pattern: /(?<![\p{L}\p{N}])(?:hidden|concealed)/u },
  { entry: "plagiarism", instead: NOTHING, lang: "en", pattern: /(?<![\p{L}\p{N}])plagiar/u },
  {
    entry: "originality",
    instead: INTACT,
    lang: "en",
    pattern: /(?<![\p{L}\p{N}])(?:originality|unoriginal)/u,
  },
  {
    entry: "integrity",
    instead: "completeness of the record",
    lang: "en",
    pattern: /(?<![\p{L}\p{N}])integrity/u,
  },
  {
    entry: "unusual",
    instead: NOTHING,
    lang: "en",
    pattern: /(?<![\p{L}\p{N}])(?:unusual|atypical)/u,
  },
  { entry: "irregularity", instead: NOTHING, lang: "en", pattern: /(?<![\p{L}\p{N}])irregularit/u },
  {
    entry: "someone else's text",
    instead: PASTED,
    lang: "en",
    pattern:
      /(?<![\p{L}\p{N}])(?:someone else s (?:text|words)|not (?:their|his|her) own (?:text|words?|writing|paragraph|passage))(?![\p{L}\p{N}])/u,
  },
  {
    entry: "written by a human",
    instead: "observed writing in the editor",
    lang: "en",
    pattern: /(?<![\p{L}\p{N}])(?:human written|written by (?:a )?human)/u,
  },
  {
    entry: "saved (without saying where)",
    instead: "saved on this device / saved on the server / submitted",
    lang: "en",
    pattern:
      /(?<!\p{L})saved(?!\p{L})(?! (?:on|to) (?:the |this |your )?(?:device|server)(?![\p{L}\p{N}]))/u,
    contextual: { word: /(?<![\p{L}\p{N}])saved(?![\p{L}\p{N}])/u },
  },
  // §5 delta 5: the additional English list of D-276 (§5, "Dodatni engleski popis"), which Ductus has not added yet
  // (M11.5-P01a). Its rows with a condition ("misconduct", "flagged" about a work or a student) are checked always (delta 4).
  {
    entry: "risk score, trust score, attention score, suspicion score",
    instead: NOTHING,
    lang: "en",
    pattern: /(?<![\p{L}\p{N}])(?:risk|trust|attention|suspicion) scor/u,
  },
  {
    entry: "cheating, dishonest, misconduct",
    instead: NOTHING,
    lang: "en",
    pattern: /(?<![\p{L}\p{N}])(?:cheat|dishonest|misconduct)/u,
  },
  {
    entry: "AI-detected, flagged as AI",
    instead: NOTHING,
    lang: "en",
    pattern:
      /(?<![\p{L}\p{N}])(?:ai detect|detected as ai(?![\p{L}\p{N}])|flagged as ai(?![\p{L}\p{N}]))/u,
  },
  {
    entry: "flagged, flagged for review",
    instead: NOTHING,
    lang: "en",
    pattern: /(?<![\p{L}\p{N}])flag(?:s|ged|ging)?(?![\p{L}\p{N}])/u,
  },
];

/** Format characters (soft hyphen, zero width, bidi controls, BOM) and Hangul fillers. */
export const INVISIBLE = /[\p{Cf}\u115F\u1160\u3164\uFFA0]/gu;

/** Folds text for matching; NFKC also turns full width and mathematical letters into the letter. */
export function foldText(text: string): string {
  return foldLetters(text)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** The letters and digits of `text` as the patterns expect them; everything between them is left as written. */
export function foldLetters(text: string): string {
  return text
    .normalize("NFKC")
    .replace(INVISIBLE, "")
    .toLocaleLowerCase("hr")
    .replaceAll("đ", "d")
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/**
 * Stands in folded text wherever a phrase ends. It is not a space, so the
 * spaces written in a pattern do not match it, and it is not a letter or a
 * digit, so a word still ends at it. It is U+FFFF, a code point that is no
 * character; the characters check of the locales scan (PR-b2) reports a text
 * that writes it.
 */
export const PHRASE_BREAK = "\uFFFF";

/**
 * White space that keeps two words in one phrase on one line: spaces of every
 * width and the tab. U+2028 (line separator) is on this side only because the
 * tests of the earlier QA round hold it as a space.
 */
const SPACES_ONLY = /^[\p{Zs}\t\p{Zl}]+$/u;

/**
 * Folds text like `foldText`, but keeps where a phrase ends: white space of one
 * line stays a space, any other run of non-letters becomes `PHRASE_BREAK`. So
 * "Spremljeno na uređaju." is acceptable and "Spremljeno. Na uređaju" is not.
 */
export function foldPhrases(text: string): string {
  return foldLetters(text)
    .replace(/[^\p{L}\p{N}]+/gu, (run) => (SPACES_ONLY.test(run) ? " " : PHRASE_BREAK))
    .replace(/^[ \uFFFF]+|[ \uFFFF]+$/g, "");
}

/**
 * `text` as `allows` reads it: ASCII capitals in lower case, the soft hyphen and the three characters of zero width
 * dropped (`characters.ts` leaves them to the dictionary too), and a run of spaces, no-break spaces and tabs made one
 * space. Nothing is normalized, so a letter that NFKC, a diacritic fold or a case mapping outside ASCII would turn
 * into a letter of an allowed phrase ("ᵈ", "ｄ", "đ", "İ") stays what it is and the phrase does not match.
 */
export function foldCase(text: string): string {
  return text
    .replace(/[\u00AD\u200B\u200C\u200D]/g, "")
    .replace(/[A-Z]/g, (letter) => letter.toLowerCase())
    .replace(/[ \u00A0\t]+/g, " ");
}

/**
 * The text `pattern` reads for an entry with `allows`. Every occurrence of the allowed words as written is masked,
 * but only when `foldText` finds as many of them set apart from other letters: a character next to them that folds
 * into a letter or a digit ("radaⓐ", "rada¹", a word joiner before a letter) joins them to a longer word, and then
 * nothing is masked.
 */
function allowedReading(text: string, allows: RegExp): string {
  const written = foldCase(text);
  const folded = foldText(text);
  const count = (reading: string): number => reading.match(allows)?.length ?? 0;
  return count(written) === count(folded) ? foldText(written.replace(allows, ".")) : folded;
}

/** Dictionary entries that occur in `text`, in dictionary order; with `lang`, only the entries of that language. */
export function findForbiddenTerms(text: string, lang?: Language): ForbiddenTerm[] {
  const folded = foldText(text);
  const phrases = foldPhrases(text);
  return FORBIDDEN_TERMS.filter(
    (entry) =>
      (lang === undefined || entry.lang === lang) &&
      entry.pattern.test(
        entry.allows
          ? allowedReading(text, entry.allows)
          : entry.contextual || entry.readsPhrases
            ? phrases
            : folded,
      ),
  );
}

/**
 * The text `entry.pattern` reads in `raw`, as `findForbiddenTerms` reads it: the allowed reading for an entry with
 * `allows`, the phrase reading for a contextual entry or one that reads phrases, the folded text for the rest.
 */
function readingFor(entry: ForbiddenTerm, raw: string): string {
  if (entry.allows) return allowedReading(raw, entry.allows);
  return entry.contextual || entry.readsPhrases ? foldPhrases(raw) : foldText(raw);
}

/*
 * Markup readings, ported from Ductus scripts/forbidden-terms/terms.ts at 0cdb0f1f (`findForbiddenTermsInMarkup`,
 * its windows, `windowsCutShort`, `closedUpPastQuotes`). The one change: every reading goes through `readingFor`,
 * so an entry with `allows` (which Ductus does not have) is read the way `findForbiddenTerms` reads it here.
 */

/**
 * Dictionary entries in text that markup puts together from several pieces, such as `Nestali <strong>podaci</strong>`.
 * The same text is given twice: `joined` has the pieces as the browser joins them, with `PHRASE_BREAK` where a phrase
 * ends, and `spaced` has a space at every element boundary. An entry found in either reading is reported.
 *
 * A contextual entry is decided by the joined reading, which is what a person sees. The spaced reading can only clear
 * it: when the word stands whole in the spaced reading and is acceptable there, the match came from two texts running
 * together. When the spaced reading does not hold the whole word at all, an element split the word itself.
 *
 * A third reading closes the text up over every `PHRASE_BREAK`, so what stands on the two sides of an unknown part or
 * an element boundary is read as one word; the parts next to each other are read closed up by themselves as well
 * (`inWindows`). `closedUp: false` leaves this reading out.
 */
export function findForbiddenTermsInMarkup(joined: string, spaced: string, closedUp = true): ForbiddenTerm[] {
  const closedRaw = joined.replaceAll(PHRASE_BREAK, "");
  // Closed up past the quotation marks at a boundary too: see `closedUpPastQuotes`.
  const tightRaw = closedUpPastQuotes(joined);
  const windows = closedUp ? inWindows(joined) : NO_TERMS;
  return FORBIDDEN_TERMS.filter((entry) => {
    const reads = (raw: string): boolean => entry.pattern.test(readingFor(entry, raw));
    if (!entry.contextual) return reads(joined) || reads(spaced) || (closedUp && (reads(closedRaw) || reads(tightRaw) || windows.has(entry)));
    const shownPhrases = foldPhrases(joined);
    const apartPhrases = foldPhrases(spaced);
    if (entry.pattern.test(shownPhrases) && (entry.pattern.test(apartPhrases) || !entry.contextual.word.test(apartPhrases))) return true;
    if (!closedUp) return false;
    // The word itself put together across something unknown: there is no whole word to judge without closing it.
    if (!entry.contextual.word.test(shownPhrases)) return reads(closedRaw) || reads(tightRaw) || windows.has(entry);
    // The word stands whole somewhere, and that place was judged above. It says nothing about another place where the word is cut.
    const cut = withoutWholeWords(joined, entry.contextual.word);
    return reads(cut.replaceAll(PHRASE_BREAK, "")) || reads(closedUpPastQuotes(cut)) || inWindows(cut).has(entry);
  });
}

/** Letters and digits written in a row, with what `foldLetters` drops between them. */
const WRITTEN_WORD = /[\p{L}\p{N}\p{M}\p{Cf}ᅟᅠㅤﾠ]+/gu;
/** Stands where a whole word was taken out: it ends the phrase and no boundary is closed up over it. */
const TAKEN_OUT = ".";

/** `joined` without the places where `word` is written whole; one acceptable place does not clear another. */
function withoutWholeWords(joined: string, word: RegExp): string {
  return joined.replace(WRITTEN_WORD, (written) => {
    const folded = foldLetters(written);
    return word.exec(folded)?.[0] === folded ? TAKEN_OUT : written;
  });
}

/**
 * The most letters, digits and spaces that the parts strictly inside a window may hold: the longest text a pattern
 * is written for has 34 characters, the rest is room for longer endings. A bound, not a proof.
 */
const WINDOW = 48;
/** The most parts in a window; a text that this bound cuts a window in is reported by `windowsCutShort`. */
export const MAX_WINDOW_PARTS = 64;
/** Parts kept on each side of a window, apart from it: the other words of a phrase, at most four. */
const CONTEXT = 4;
const NO_TERMS: ReadonlySet<ForbiddenTerm> = new Set();
/** What was found in a piece of text; the same pieces come back for every element around them. */
const foundInPiece = new Map<string, readonly ForbiddenTerm[]>();

/** Entries in `joined` read in windows: every run of parts an entry can reach across, closed up by itself. */
function inWindows(joined: string): ReadonlySet<ForbiddenTerm> {
  const parts = joined.split(PHRASE_BREAK).filter((part) => part !== "");
  if (parts.length < 3) return NO_TERMS;
  const lengths = parts.map((part) => foldText(part).length);
  const quoted = [...joined].some((char) => QUOTATION_MARKS.has(char.codePointAt(0)!));
  const found = new Set<ForbiddenTerm>();
  for (let start = 0; start < parts.length - 1; start += 1) {
    const before = parts.slice(Math.max(0, start - CONTEXT), start);
    for (let end = start + 2, widest = widestWindow(lengths, start).end; end <= widest; end += 1) {
      const inside = parts.slice(start, end);
      const after = parts.slice(end, end + CONTEXT);
      for (const closed of new Set([inside.join(""), quoted ? closedUpPastQuotes(inside.join(PHRASE_BREAK)) : inside.join("")])) {
        const piece = [...before, closed, ...after].join(PHRASE_BREAK);
        let terms = foundInPiece.get(piece);
        if (!terms) {
          terms = FORBIDDEN_TERMS.filter((entry) => entry.pattern.test(readingFor(entry, piece)));
          if (foundInPiece.size >= 200_000) foundInPiece.clear();
          foundInPiece.set(piece, terms);
        }
        for (const term of terms) {
          // A contextual word that is whole without the last part is judged there: that part, closed up after the place, would hide the place.
          const narrower = foldPhrases(closedUpPastQuotes(inside.slice(0, -1).join(PHRASE_BREAK)));
          if (!term.contextual?.word.test(narrower)) found.add(term);
        }
      }
    }
  }
  return found;
}

/** The end of the widest window that starts at `start`, and whether `MAX_WINDOW_PARTS` stopped it. */
function widestWindow(lengths: readonly number[], start: number): { end: number; cut: boolean } {
  let end = start + 1;
  for (let within = 0; end < lengths.length && within <= WINDOW; end += 1, within += lengths[end - 1]!) {
    if (end + 1 - start > MAX_WINDOW_PARTS) return { end, cut: true };
  }
  return { end, cut: false };
}

/** Whether `joined` has a run of parts that `inWindows` did not read as far as an entry can reach. */
export function windowsCutShort(joined: string): boolean {
  const lengths = joined.split(PHRASE_BREAK).filter((part) => part !== "").map((part) => foldText(part).length);
  return lengths.length >= 3 && lengths.some((_, start) => widestWindow(lengths, start).cut);
}

/** The quotation marks of Croatian and English outside ASCII. */
const QUOTATION_MARKS: ReadonlySet<number> = new Set([0xab, 0xbb, 0x2018, 0x2019, 0x201a, 0x201c, 0x201d, 0x201e]);
/** What stands between two words around a `PHRASE_BREAK`, the break included. */
const AROUND_A_BREAK = /[^\p{L}\p{N}]*￿[^\p{L}\p{N}]*/gu;

/** `joined` closed up, and without the quotation marks that stand between two words where a `PHRASE_BREAK` stands. */
export function closedUpPastQuotes(joined: string): string {
  return joined.replace(AROUND_A_BREAK, (run) => [...run].filter((char) => char !== PHRASE_BREAK && !QUOTATION_MARKS.has(char.codePointAt(0)!)).join(""));
}
