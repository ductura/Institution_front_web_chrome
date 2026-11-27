// WEB-2145 (paritet N-01, prijedlog 5): facts of each assignment on "Moji kolegiji" and the banner of an
// interrupted publish. Wording of docs/prototip/Ductura_nastavnik.html (`taskFacts`, `subRows`, `subLine`,
// variant `prekinuto`); a part the server does not say is left out, never invented.
import { oneDot } from "../../../i18n/date-dot";
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
  // NZ-5 (variant B): an exception for one student is a record of its own, marked „iznimka” in the list.
  late: {
    open: "Dopusti predaju nakon roka…",
    title: "Dopusti predaju nakon roka",
    intro: (name: string): string => `${name} smije predati nakon roka do odabranog trenutka. Iznimka se zapisuje i vidi se u popisu „Produljeni rokovi” s oznakom „iznimka”.`,
    reason: "Razlog",
    reasonPlaceholder: "Odaberite razlog",
    reasons: { justified: "Opravdan razlog", technical: "Tehnička poteškoća", agreement: "Dogovor s nastavnikom" },
    due: "Novi rok (po zagrebačkom vremenu)",
    studentSees: "Student vidi do kada smije predati, a zapis se ne briše.",
    record: "Zabilježi iznimku",
    cancel: "Odustani",
    needReason: "Odaberite razlog s popisa.",
    needDue: "Odaberite novi rok.",
    dueNotLater: "Novi rok mora biti u budućnosti.",
    recorded: (when: string): string => oneDot(`Zabilježeno: predaja je dopuštena do ${when}.`),
    notRecorded: "Iznimka nije zabilježena. Provjerite rok i pokušajte ponovno.",
    unknown: "Nije sigurno je li iznimka zabilježena. Provjerite popis „Produljeni rokovi”.",
    list: "Produljeni rokovi",
  },
} as const;
