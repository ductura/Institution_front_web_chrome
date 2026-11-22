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
