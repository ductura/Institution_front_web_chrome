import type { StudentDataExportLabels } from "@ductura/ui";

/**
 * Interface text of "Izvoz podataka studenta" (WEB-1302; SRV-1308). `errors` is the catalogue text
 * of the server's answers; the page never shows a raw code. The note is the reference of the
 * identity check (e.g. the registry's case number), never the number of the document itself.
 */
export const studentDataExportMessages = {
  title: "Izvoz podataka studenta",
  labels: {
    requestTitle: "Zahtjev za izvoz podataka studenta",
    requestLead: "Referada predaje zahtjev nakon što je provjerila identitet studenta. Izvoz pokreće administrator ustanove.",
    studentId: "Oznaka studenta",
    studentIdHint: "Oznaka studenta iz popisa korisnika ustanove.",
    studentIdMissing: "Upišite valjanu oznaku studenta.",
    identityDocument: "Isprava kojom je provjeren identitet",
    identityDocumentPick: "Odaberite ispravu",
    identityDocumentMissing: "Odaberite ispravu kojom je provjeren identitet.",
    documents: { identity_card: "Osobna iskaznica", passport: "Putovnica", student_card: "Studentska iskaznica" },
    identityConfirmed: "Provjerio/la sam identitet studenta uživo",
    identityNotConfirmed: "Potvrdite da je identitet studenta provjeren.",
    note: "Oznaka provjere",
    noteHint: "Do 80 znakova, npr. broj spisa referade. Ne upisujte broj isprave.",
    noteMissing: "Upišite oznaku provjere.",
    request: "Pošalji zahtjev",
    requesting: "Šaljem zahtjev…",
    listTitle: "Zahtjevi za izvoz podataka",
    listLead: "Izvoz se pokreće tek kad ga odobrite. Student dobiva poveznicu koja vrijedi jednom.",
    empty: "Nema zahtjeva za izvoz.",
    loading: "Učitavanje zahtjeva…",
    retry: "Pokušaj ponovno",
    states: { requested: "Zatražen", approved: "Odobren", ready: "Spreman", downloaded: "Preuzet", expired: "Istekao" },
    requestedAt: (at: string) => `Zatraženo: ${at}`,
    expiresAt: (at: string) => `Poveznica vrijedi do: ${at}`,
    approve: "Pokreni izvoz",
    approveTitle: "Pokretanje izvoza",
    reference: "Urudžbeni broj",
    referenceHint: "Upisuje se u zapis o izvozu.",
    referenceMissing: "Upišite urudžbeni broj.",
    approving: "Pokrećem izvoz…",
    cancel: "Odustani",
  } satisfies StudentDataExportLabels,
  requested: "Zahtjev je poslan. Izvoz će pokrenuti administrator ustanove.",
  approved: "Izvoz je pokrenut. Student će dobiti poveznicu za preuzimanje.",
  errors: {
    unauthorized: "Prijava nije valjana. Prijavite se ponovno.",
    forbidden: "Zahtjeve za izvoz podataka predaje referada, a pokreće ih administrator ustanove.",
    unavailable: "Poslužitelj trenutačno nije dostupan. Ništa nije promijenjeno; pokušajte ponovno.",
    invalid: "Poslužitelj nije prihvatio ove vrijednosti. Provjerite polja i pokušajte ponovno.",
    notFound: "Student s tom oznakom nije pronađen u ustanovi.",
    exists: "Za ovog studenta već postoji otvoren zahtjev za izvoz.",
    stale: "Zahtjev više ne čeka odobrenje. Popis je ponovno učitan.",
  },
} as const;
