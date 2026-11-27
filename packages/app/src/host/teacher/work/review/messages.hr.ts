// "Pregled rada" (WEB-NUZ-PG; NF-5 PG-1, PG-4, PG-14; the input rhythm stays out, NF5-Q4): interface text as in Ductura_nastavnik.html, screen
// `pregled` (data-nf5="PG-1", "PG-4", "PG-10"). The assistant is named only "Asistent" (Q-10): no provider, no model.
// No text draws a conclusion about authorship; every share carries "nije dokaz autorstva" (Ustav v1.6 C-6).
export const reviewMessages = {
  title: "Pregled rada",
  loading: "Učitavam pregled rada…",
  error: "Pregled rada trenutačno nije moguće učitati. Tekst rada i zapis time nisu zahvaćeni.",
  notFound: "Rad nije pronađen.",
  signedOut: "Sesija je istekla. Prijavite se ponovno.",
  retry: "Pokušaj ponovno",
  entry: "Pregled rada (jedno mjesto)",

  // PG-1: the header with the context of the work.
  noName: "Ime studenta nije dostupno",
  titleUnavailable: "Naziv zadatka nije dostupan",
  courseUnavailable: "Kolegij nije dostupan",
  practice: "probni zadatak",
  task: (title: string): string => `zadatak „${title}”`,
  due: (when: string): string => `rok ${when}`,
  dueUnavailable: "rok nije dostupan",
  workKind: "Rad",
  heading: (student: string, kind: string, title: string | null): string =>
    title === null ? `${student}, ${kind}` : `${student}, ${kind} „${title}”`,
  backToTask: "Natrag na zadatak",
  backToCourses: "Natrag na kolegije",
  prev: "Prethodni rad",
  next: "Sljedeći rad",
  steps: "Drugi radovi istog zadatka",
  stepsNote: "Prethodni i sljedeći rad otvaraju se na istoj kartici.",

  // PG-10 (direction a, Daniel 23. 11.; Merlin and Studomat, Daniel 24. 11.): the grade stays outside Ductura.
  gradeExternal: "Ocjenu upisujete u Merlin i Studomat.",
  gradeExternalNote: "Ductura ne bilježi ocjenu, a nijedna oznaka u ovom pregledu ne ulazi u ocjenu ni u izvoz.",
  gradePractice: "Probni zadatak se ne ocjenjuje i ne izvozi.",
  gradePracticeNote: "Pregled služi samo razgovoru o radu.",

  // PG-1: the view tabs.
  tabsLabel: "Pogledi na rad",
  tabText: "Tekst",
  tabSummary: "Sažetak",
  tabOrigin: "Podrijetlo",
  tabReplay: "Reprodukcija",
  tabCompare: "Usporedba",
  tabDeclaration: "Izjava",
  textNote: "Tekst rada je samo za čitanje. Komentari i prijedlozi izmjene su u pogledu „Rad”. Isti komentar vidi i student.",
  textOpen: "Otvori tekst rada s komentarima",
  replayNote: "Reprodukcija pokazuje kako je tekst nastajao, promjenu po promjenu. Služi razgovoru o radu, ne ocjeni.",
  replayOpen: "Otvori reprodukciju",
  compareNote: "Usporedba pokazuje što je dodano i uklonjeno između dviju poslanih verzija.",
  compareOpen: "Otvori usporedbu verzija",
  compareNotSubmitted: "Rad još nije predan, pa usporedbe predanih verzija nema.",

  // PG-4: the process summary, its pilot parts and "nije dostupno" apart from an error.
  summaryIntro: "Isti sažetak vide student i nastavnik. Vremena su po zagrebačkom vremenu, zaokružena na minutu.",
  summaryFull: "Cijeli sažetak procesa",
  notGiven: "Trenutačno nije dostupno.",
  notGivenReason: "Poslužitelj ovaj dio za ovaj rad ne daje; ponovni pokušaj ne mijenja ništa. Ostali dijelovi sažetka nisu zahvaćeni.",
  partError: (part: string): string => `${part} trenutačno nije moguće dohvatiti. To ne znači da podataka nema.`,
  partLoading: "Učitavam…",

  recordHeading: "Stanje zapisa",
  recordComplete: "Zapis je cjelovit.",
  recordGaps: (n: number): string => `Zapis ima praznine (${n}). Pročitajte to prije nego što zaključite bilo što o tom dijelu.`,
  recordEmpty: "Rad još nije započet, pa sažetka procesa nema.",
  sessions: "Sesije",
  pastes: (n: number, above: number): string => `Lijepljenja dulja od ${above} znakova: ${n}`,

  assistantHeading: "Asistent",
  assistantTransfers: "Prijenosi teksta iz Asistenta u rad",
  assistantConversations: "Razgovori s Asistentom priloženi izjavi",
  assistantNote: "Pokazuje se samo broj. Što poslužitelj nije dao nastavniku, ne nagađa se.",
  assistantDeclaration: "Razgovori uz izjavu",

  matchHeading: "Podudaranje s odgovorom Asistenta",
  matchNone: "Nema nalaza podudaranja.",
  matchFindings: (n: number): string => `Nalazi: ${n}`,
  matchShare: (value: string): string => `Udio teksta koji se podudara: ${value}`,
  matchNote: "Ovo je obična usporedba teksta i ništa ne govori o autorstvu.",
  notProof: "nije dokaz autorstva",

  rulesHeading: "Pravila fakulteta",
  rulesNone: "Pragovi fakulteta nisu postavljeni (nema zadanih), pa usporedbe s pragom nema.",
  rulesNote: "Izjava o skladu s pravilima fakulteta, ne ocjena studenta.",
  ruleState: { in_line: "u skladu", for_review: "za pregled", exceeded: "prekoračeno" },
} as const;
