// WEB-2147 (paritet N-02/N-03, objava zadatka): texts of the publish outcomes, as in the prototype.
export const publishHr = {
  /** Review step note (prototype "pregled"); the notice goes to students inside the app only (orchestrator decision 22. 11. 2026., no e-mail). */
  reviewNote: "Nakon objave studenti dobivaju obavijest o zadatku u aplikaciji. Rok se kasnije mijenja samo produljenjem, koje se bilježi.",
  /** The reply of the server was a clear refusal (invalid, forbidden, conflict, unauthorized): nothing was published. */
  refused: "Zadatak nije objavljen: poslužitelj je odbio objavu. Uneseni podaci ostaju u obrascu.",
  /** The outcome is unknown (lost reply): the prototype banner. */
  uncertainTitle: "Objava zadatka prekinuta je i ishod nije poznat.",
  uncertainBody: "Uneseni podaci ostaju u obrascu. Prije ponovne objave provjerite popis zadataka u kolegiju: ako je zadatak objavljen, pojavit će se ondje.",
  checkList: "Provjeri popis zadataka",
  /** Shown after the server confirmed; no claim that a notice was sent (the server has no notice channel yet). */
  published: "Zadatak je objavljen. Upisani studenti vide ga u „Mojim zadacima”.",
  toCourses: "Na kolegije",
} as const;

/** NZ-7a: the block "Ovako će student vidjeti obavijest" on the edit page. */
export const noticePreviewHr = {
  title: "Ovako će student vidjeti obavijest",
  lead: "Isti podaci kao u obavijesti koju student potvrđuje. Imena studenata i sadržaj rada ovdje se ne prikazuju.",
  due: "Rok",
  tools: "Alati",
  scope: "Opseg",
  importing: "Uvoz teksta",
  version: "Verzija obavijesti",
  noLimit: "bez ograničenja",
  toolsNone: "Asistent nije dopušten",
  toolsSome: (list: string): string => `Asistent je dopušten za: ${list}`,
  importYes: "dopušten",
  importNo: "nije dopušten",
} as const;

