/** Interface text of the teacher's working criteria in the Mentor card (WEB-1112, E 3.5 mentor3). */
export const workingCriteriaHr = {
  title: "Kriteriji ocjenjivanja, procijenjeno {done} od {total}",
  note: "Radna bilješka nastavnika. Student ne vidi kriterije ni procjene, a Ductura ne računa ocjenu.",
  loading: "Učitavanje kriterija…",
  unavailable: "Kriteriji trenutačno nisu dostupni. Pokušajte ponovno.",
  notFound: "Kriteriji za ovaj rad nisu dostupni.",
  retry: "Pokušaj ponovno",
  unrated: "još nije procijenjeno",
  /** The criteria's text by id; the server sends only the id and a message key (LOK-WEB-20). */
  criteria: {
    topic: "Tema, cilj i istraživačko pitanje",
    structure: "Struktura i logika izlaganja",
    sources: "Izvori i citiranje",
    method: "Metoda i analiza",
    language: "Jezik i stil",
    formatting: "Tehnička obrada",
  },
  /** An assessment is a label, never points: 0, 1 and 2 as the server sends them. */
  assessments: { 0: "treba doraditi", 1: "dobro", 2: "vrlo dobro" },
  assessmentGroup: "Procjena: {title}",
  addNote: "+ napomena",
  editNote: "uredi napomenu",
  noteLabel: "Napomena uz kriterij: {title}",
  noteHint: "Najviše {max} znakova. Napomenu vidite samo Vi.",
  saveNote: "Spremi napomenu",
  clearNote: "Obriši napomenu",
  cancel: "Odustani",
  saving: "Sprema se…",
  saved: "Spremljeno.",
  errors: {
    signedOut: "Prijava je istekla. Prijavite se ponovno.",
    notFound: "Kriterij više nije dostupan. Osvježite prikaz.",
    invalid: "Napomena nije valjana. Skratite je i pokušajte ponovno.",
    unknown: "Nije poznato je li promjena zabilježena. Provjerite prikaz prije novog pokušaja.",
  },
} as const;
