import { pluralHr } from "../../../../../../src/lib/i18n/hr.ts";

/** The host's wording for the status bar and the submission rehearsal rows (prototype app.js, tools.js). */
export const statusHostHr = {
  selected: (words: number) => `označeno: ${words} ${pluralHr(words, "riječ", "riječi", "riječi")}`,
  noHoles: "ništa za provjeru",
  /** The row's detail while the server or the owner has not given the data (never a guess). */
  unavailable: "Podatak trenutačno nije dostupan.",
  uncitedNone: "Svi izvori su citirani.",
  noSources: "Još nema izvora u radu.",
  uncited: (count: number) => `Necitirano: ${count}.`,
  // WEB-NUZ-PREDAJA-1 (P-16): the rehearsal's rows from what the server holds, or why they cannot say.
  proofsLoading: "Provjeravam zatražene potvrde…",
  proofsUnavailable: "Zatražene potvrde trenutačno nije moguće učitati.",
  proofsNone: "Mentor za sada nije zatražio potvrde.",
  proofsNoneOpen: "Nema otvorenih zahtjeva za potvrdu.",
  proofsOpen: (open: number, total: number) => `Još ${open} od ${total} čeka potvrdu.`,
  facultyRulesNotYet: "Provjera pravila fakulteta još nije dostupna.",
  formsLoading: "Provjeravam izjavu na poslužitelju…",
  formsNotRequired: "Zadatak ne traži obrazac izjave.",
  formsNone: "Obrazac izjave još nije objavljen.",
  formsOf: (formId: string, version: number) => `Obrazac izjave: ${formId}, verzija ${version}.`,
} as const;
