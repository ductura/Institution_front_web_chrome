// N-11 "Usporedba verzija" (WEB-2160, PARITET N-11): interface text as in the prototype and INVENTAR-nastavnik 3.11.
// The two read-failure texts and the comparison loading text are not in the prototype; they follow its wording.
export const n11Messages = {
  title: "Usporedba verzija",
  entry: "Usporedba verzija",
  backToWork: "Natrag na rad",
  loadingVersions: "Učitavam poslane verzije…",
  loadingComparison: "Učitavam usporedbu…",
  versionsError: "Verzije trenutačno nije moguće učitati. Pokušajte ponovno.",
  compareError: "Usporedbu trenutačno nije moguće učitati. Pokušajte ponovno.",
  notFound: "Tražene verzije nisu dostupne.",
  retry: "Pokušaj ponovno",
  empty: "Postoji samo jedna poslana verzija ovog rada, pa usporedbe još nema. Međustanja se vide uživo i u reprodukciji.",
  emptyAction: "Otvori reprodukciju",
  selectLabel: "Usporedi s …",
  selectHint: "Popis sadrži samo poslane verzije. Zadano se zadnja poslana verzija uspoređuje s prethodnom.",
  noChanges: "Nema razlike između odabranih verzija.",
  wordsNote: "Broj riječi je opis, bez boje i bez praga.",
  addedLabel: "Dodano",
  removedLabel: "Uklonjeno",
  current: (when: string, revision: number): string => `Predana verzija · ${when} · verzija ${revision}`,
  option: (when: string, revision: number): string => `Poslano na pregled · ${when} · verzija ${revision}`,
  words: (n: number): string => `${n} ${n % 10 === 1 && n % 100 !== 11 ? "riječ" : "riječi"}`,
} as const;
