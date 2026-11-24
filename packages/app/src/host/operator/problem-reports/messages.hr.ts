/**
 * Interface text of "Prijave problema" (NF-7 OA-7, prototype screen `prijave`): the read of the reports
 * routed to the reader (support.problem-reports.get) and the change of their state
 * (support.problem-report-status.post). Who handles which category: Daniel 23. 11. 2026., t. 8.
 */
export const problemReportsMessages = {
  title: "Prijave problema",
  lead: "Prijave koje su podnijeli studenti, usmjerene onome tko ih rješava.",
  reportsTitle: "Primljene prijave",
  table: "Prijave problema",
  reference: "Oznaka",
  received: "Zaprimljeno",
  description: "Opis",
  state: "Stanje",
  actionColumn: "Radnja",
  routedTo: "Usmjereno na",
  truncated: "Prikazano je samo najnovijih {count} prijava.",
  emptyTitle: "Nema prijava",
  emptyBody: "Nijedna prijava nije stigla vama. Kad je student pošalje iz pomoći, pojavit će se ovdje.",
  denied: "Nemate ovlasti za prijave problema.",
  unavailable: "Prijave trenutačno nije moguće učitati. Pokušajte ponovno.",
  retry: "Pokušaj ponovno",
  stateNames: { received: "zaprimljeno", resolved: "riješeno" },
  markResolved: "Označi riješenom",
  markReceived: "Vrati u zaprimljeno",
  changedOk: "Stanje prijave {reference} je promijenjeno.",
  changeDenied: "Nemate ovlasti za promjenu stanja prijave {reference}.",
  changeGone: "Prijava {reference} više ne postoji. Popis je ponovno učitan.",
  changeFailed: "Stanje prijave {reference} nije promijenjeno. Pokušajte ponovno.",
  handlers: { network_engineer: "operater", course_teacher: "nastavnik", institution_admin: "administrator fakulteta" },
  routingTitle: "Tko rješava koju prijavu",
  routingCaption: "Usmjeravanje prijava po kategoriji",
  category: "Kategorija",
  handler: "Rješava",
  yours: "vaša",
  categories: {
    technical: { label: "Tehnički problem", handler: "operater" },
    course: { label: "Kolegij ili zadatak", handler: "nastavnik" },
    account: { label: "Račun i uloge", handler: "administrator fakulteta" },
  },
  states: "Prijava ima dva stanja: zaprimljeno i riješeno.",
  privacy: "Opis prijave prikazuje samo ono što je student sam upisao.",
} as const;
