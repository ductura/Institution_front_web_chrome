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
} as const;
