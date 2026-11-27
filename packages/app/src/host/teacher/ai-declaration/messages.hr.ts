export const aiDeclarationMessages = {
  heading: "Izjava o korištenju generativne umjetne inteligencije",
  recordedNote: "Zabilježeno u Ducturi i izjava studenta.",
  review: "Pregledaj razgovor",
  conversationsHeading: "Razgovori uz izjavu",
  /** „Razgovor 1, 28. 10. 2026.” */
  dialogTitle: (n: number, date: string) => `Razgovor ${n}, ${date}`,
  dialogNote: "Točno kako je zabilježen; isti razgovor vidi i student.",
  close: "Zatvori",
  unavailable: "Izjava o korištenju AI-ja trenutačno nije dostupna.",
  unavailableNote: "Predaja i potvrda predaje time se ne mijenjaju.",
  student: "Student",
  // NF-5 PG-6: the teacher's question and the student's answer beside the declaration.
  questionHeading: "Pitanje nastavnika i odgovor studenta",
  studentAnswer: "Odgovor studenta",
  noAnswer: "Student nije odgovorio na pitanje. Odgovor nije obavezan.",
  answerPending: "Student još nije predao izjavu; odgovor će se vidjeti uz izjavu.",
  /** Q-10: the assistant is never named by provider or model, only „Asistent”. */
  assistant: "Asistent",
} as const;
