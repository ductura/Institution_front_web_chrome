// NF-5 PG-11 (export and print of "Pregled rada") and PG-12 (the review on a phone): interface text as in
// Ductura_nastavnik.html, screen `pregled` (data-nf5="PG-11", "PG-12"). The assistant is named only "Asistent" (Q-10).
// No text draws a conclusion about authorship; the print carries "nije dokaz autorstva" (Ustav v1.6 C-6).
export const exportMessages = {
  heading: "Izvoz i ispis",
  warning: "Datoteka sadrži tekst rada i ime studenta; čuvajte je prema pravilima fakulteta.",

  pdf: "Izvezi PDF rada",
  pdfLoading: "Pripremam PDF rada…",
  pdfDone: "PDF rada je preuzet.",
  pdfA: "Poslužitelj je potvrdio da je datoteka u formatu PDF/A.",
  pdfPlain: "Ovo je obični PDF, nije u formatu PDF/A.",
  fingerprint: (prefix: string): string => `Otisak datoteke: ${prefix}…`,
  notFound: "Rad nije pronađen ili poslužitelj još nema njegovu verziju.",
  forbidden: "Ovaj rad ne možete izvesti.",
  mismatch: "Primljena datoteka ne odgovara otisku koji je dao poslužitelj, pa nije preuzeta. Pokušajte ponovno.",
  unavailable: "PDF rada trenutačno nije moguće izvesti. Pokušajte ponovno.",
  retry: "Pokušaj ponovno",

  print: "Ispiši pregled",
  printNote: "Ispis sadrži zaglavlje i sve poglede ovog pregleda, jedan ispod drugog. Iz dijaloga ispisa pregled možete spremiti i kao PDF.",
  summaryMissing: "Zasebna datoteka sažetka procesa još nije dostupna. Sažetak je dio ispisa pregleda.",

  practice: "Probni zadatak se ne izvozi i ne ispisuje.",

  // Only in the print: the header line and the note under it.
  printedAt: (when: string): string => `Ispisano ${when}`,
  printNotProof: "Nijedan postotak u ovom ispisu nije dokaz autorstva. Nijedna oznaka ne ulazi u ocjenu.",

  // PG-12: the region of the review on a phone.
  region: "Pregled rada",
} as const;
