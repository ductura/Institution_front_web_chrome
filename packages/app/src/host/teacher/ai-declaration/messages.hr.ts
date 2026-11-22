export const aiDeclarationMessages = {
  heading: "Izjava o korištenju generativne umjetne inteligencije",
  recordedNote: "Zabilježeno u Ducturi i izjava studenta.",
  review: "Pregledaj razgovor",
  conversationsHeading: "Razgovori uz izjavu",
  /** „Razgovor 1 · 28. 10. 2026.” */
  dialogTitle: (n: number, date: string) => `Razgovor ${n} · ${date}`,
  dialogNote: "Točno kako je zabilježen; isti razgovor vidi i student.",
  close: "Zatvori",
  unavailable: "Izjava o korištenju AI-ja trenutačno nije dostupna.",
  unavailableNote: "Predaja i potvrda predaje time se ne mijenjaju.",
  student: "Student",
} as const;
