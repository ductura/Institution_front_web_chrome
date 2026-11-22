// WEB-2145 (paritet N-01, prijedlog 5): facts of each assignment on "Moji kolegiji" and the banner of an
// interrupted publish. Wording of docs/prototip/Ductura_nastavnik.html (`taskFacts`, `subRows`, `subLine`,
// variant `prekinuto`); a part the server does not say is left out, never invented.
const studentWord = (n: number): string => {
  const a = n % 10, b = n % 100;
  return a >= 1 && a <= 4 && !(b >= 11 && b <= 14) ? "studenta" : "studenata";
};

export const assignmentFactsMessages = {
  at: "u",
  loading: "Učitavanje činjenica o predaji…",
  unavailable: "Činjenice o predaji trenutačno nisu dostupne. Pokušajte ponovno.",
  retry: "Pokušaj ponovno",
  noStudents: "Na ovom zadatku još nema upisanih studenata.",
  noName: "Ime nije dostupno",
  opened: (opened: number, total: number): string => `Otvorilo rad: ${opened} od ${total} ${studentWord(total)}.`,
  notOpened: (names: readonly string[]): string => ` Rad još nisu otvorili: ${names.join(", ")}.`,
  sum: (parts: readonly string[]): string => `Zbroj: ${parts.join(", ")}.`,
  sumSubmitted: (n: number, late: number | null): string => `predano ${n}${late ? ` (od toga ${late} nakon roka)` : ""}`,
  sumWriting: (n: number): string => `u pisanju ${n}`,
  sumNotSubmitted: (n: number): string => `nije predano ${n}`,
  sumNotOpened: (n: number): string => `rad nije otvoren ${n}`,
  submitted: "Predano",
  submittedAt: (when: string): string => `Predano ${when}`,
  afterDeadline: "nakon roka",
  beforeDeadline: "prije roka",
  version: (n: number): string => `verzija ${n}`,
  recordGaps: "zapis ima praznine",
  recordContinuous: "zapis je cjelovit",
  detailsUnavailable: "pojedinosti predaje trenutačno nisu dostupne",
  writing: "U pisanju",
  extendedTo: (due: string): string => `rok produljen do ${due}`,
  notSubmitted: (due: string): string => `Nije predano · rok ${due} je prošao`,
  notOpenedLine: "Rad nije otvoren",
  notStarted: "Rad nije započet",
  openWork: "Otvori rad",
  deadlinePassed: "rok je prošao",
  fastPath: "Brz put kroz radove",
  interruptedTitle: (title: string | null): string =>
    title === null ? "Objava zadatka prekinuta je i ishod nije poznat." : `Objava zadatka „${title}” prekinuta je i ishod nije poznat.`,
  interruptedBody: "Prije ponovne objave provjerite popis zadataka: ako je zadatak objavljen, pojavit će se ovdje.",
  check: "Provjeri popis zadataka",
  checking: "Provjeravam…",
  checkedNotPublished: "Popis zadataka učitan s poslužitelja; zadatak nije objavljen.",
  checkedPublished: "Popis zadataka učitan s poslužitelja; zadatak je objavljen.",
  checkedUnknown: "Popis zadataka učitan s poslužitelja.",
  checkUnavailable: "Popis zadataka trenutačno nije dostupan. Pokušajte ponovno.",
} as const;
