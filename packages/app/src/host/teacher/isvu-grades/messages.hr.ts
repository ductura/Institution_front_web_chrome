// WEB-V22-ISVU-MODEL: interface text for the teacher's grade export to the trial ISVU (invented data only).
// The teacher types every grade; Ductura never proposes, computes, sorts or stores one (PG-10).
export const isvuGradesMessages = {
  title: "Izvoz ocjena u ISVU (probni izvor)",
  trialNotice: "Probni izvor, izmišljeni podaci; nije povezano sa stvarnim ISVU-om.",
  lead: "Ocjenu upisujete Vi, uz svakog studenta. Ductura ne predlaže ocjene, ne računa ih i ne sprema. Prazno polje znači da se za tog studenta ništa ne šalje.",
  gradeLabel: "Ocjena",
  gradeHint: "Cijeli broj od 1 do 5 ili prazno.",
  gradeNames: { 1: "nedovoljan", 2: "dovoljan", 3: "dobar", 4: "vrlo dobar", 5: "izvrstan" } as Readonly<Record<number, string>>,
  invalidGrade: "Ocjena mora biti cijeli broj od 1 do 5.",
  rowStatus: { ready: "Spremno za slanje", not_enrolled: "Nije upisan u izvoru" } as Readonly<Record<string, string>>,
  noGrades: "Nijedna ocjena nije upisana, pa nema što poslati.",
  preview: "Pregledaj izvoz",
  confirm: "Potvrdi i pošalji",
  confirmSentence: "Potvrđujem da su ove ocjene moje i da ih šaljem u probni ISVU.",
  sent: (n: number): string => `Poslano ocjena: ${n}`,
  alreadyConfirmed: "Ovaj izvoz već je potvrđen.",
  loading: "Učitavanje…",
  readError: "Čitanje nije uspjelo. Pokušajte ponovno.",
  empty: "Kolegij još nema studenata.",
  disabled: "Izvor nije uključen za ovu ustanovu.",
  expired: "Pregled je istekao. Napravite novi pregled.",
  forbidden: "Nemate ovlasti za izvoz ocjena na ovom kolegiju.",
} as const;
