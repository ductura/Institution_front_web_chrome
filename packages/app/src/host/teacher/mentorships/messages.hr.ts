export const myStudentsText = {
  title: "Moji studenti",
  lead: "Studenti čiji ste zahtjev za mentorstvo odobrili.",
  empty: "Još nemate odobrenih studenata.",
  unnamed: "Ime nije dostupno",
  unavailable: "Popis studenata trenutačno nije dostupan. Pokušajte ponovno.",
  retry: "Pokušaj ponovno",
  open: "Otvori rad",
} as const;

/** WEB-NF6-RUNDA (NF-6 MK-8): "Pregled runde" of each started mentored work (prototype mentor3 m3In). */
export const roundText = {
  title: (name: string) => `Pregled runde: ${name}`,
  loading: "Učitavam pregled runde…",
  newsTitle: "Što je novo",
  neverReviewed: "Rad još niste označili pregledanim, pa je cijeli tekst nov.",
  noChange: "Nema promjena od zadnjeg pregleda.",
  changed: (added: number, removed: number) => `Od zadnjeg pregleda: novih ili izmijenjenih odlomaka ${added}, uklonjenih ${removed}.`,
  newsUnavailable: "Promjene od zadnjeg pregleda trenutačno nisu dostupne.",
  requestsTitle: "Vaši zahtjevi uz tekst",
  noRequests: "Nema zahtjeva uz tekst.",
  requests: (open: number, answered: number, accepted: number) =>
    `otvoreno ${open} · student je odgovorio ${answered} · prihvaćeno ${accepted}`,
  requestsUnavailable: "Zahtjevi uz tekst trenutačno nisu dostupni.",
  seenUnknown: "Je li student vidio Vašu povratnu informaciju, Ductura još ne prikazuje.",
  retry: "Pokušaj ponovno",
  openWork: "Otvori rad za pregled",
} as const;
