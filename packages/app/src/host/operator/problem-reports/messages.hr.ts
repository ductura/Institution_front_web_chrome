/**
 * Interface text of "Prijave problema" (NF-7 OA-7, prototype screen `prijave`). Only sending a
 * report exists on the server (support.problem-reports.post); reading the reports and their state
 * does not yet (SRV-ADMIN-7), so the page says so honestly and shows who handles which kind of
 * report (Daniel 23. 11. 2026., t. 8). It never shows invented reports.
 */
export const problemReportsMessages = {
  title: "Prijave problema",
  lead: "Prijave koje su podnijeli studenti, usmjerene onome tko ih rješava.",
  unavailableTitle: "Popis prijava još nije dostupan",
  unavailableBody: "Studenti već mogu poslati prijavu iz pomoći, ali poslužitelj još ne daje popis primljenih prijava ni njihovo stanje. Kad bude dostupan, ovdje će se vidjeti kategorija, datum i stanje svake prijave.",
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
