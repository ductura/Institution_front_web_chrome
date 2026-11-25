// WEB-V16-OBRANA: the texts of the section "Nakon predaje i obrana". The place of the defense is not in the
// contract and is not shown (val16-razlika §5). Nothing here goes into a mark or an export.
export const stageHr = {
  title: "Nakon predaje i obrana",
  steps: {
    submitted_to_office: "Predano referadi",
    defense_scheduled: "Zakazana obrana",
    defended: "Obranjeno",
  },
  stageNone: "Rad još nije predan referadi.",
  stageLabel: "Stanje",
  options: {
    none: "Još nije predano referadi",
    submitted_to_office: "Predano referadi",
    defense_scheduled: "Zakazana obrana",
    defended: "Obranjeno",
  },
  done: "završeno",
  current: "trenutačni korak",
  pending: "slijedi",
  defenseAt: "Termin obrane",
  defenseAtNone: "Termin obrane još nije određen.",
  defenseAtLabel: "Datum i vrijeme obrane",
  defenseAtHint: "Obavezno za „Zakazana obrana”, a za ostala stanja se ne unosi. Vrijeme je po zagrebačkom vremenu.",
  save: "Spremi",
  saving: "Spremanje…",
  saved: "Spremljeno.",
  changedBy: { mentor: "Zadnju promjenu unio je mentor.", faculty: "Zadnju promjenu unijela je ustanova." },
  studentNote: "Stanje i termin unosi mentor; ovdje ih samo pregledavate.",
  errors: {
    dateRequired: "Za „Zakazana obrana” unesite datum i vrijeme obrane.",
    dateInvalid: "Datum ili vrijeme nisu ispravni.",
    invalid: "Poslužitelj nije prihvatio unos. Provjerite stanje i datum.",
    forbidden: "Nemate pravo promijeniti stanje ovog rada.",
    notFound: "Ovaj rad nije dostupan.",
    unknown: "Nije poznato je li promjena spremljena. Osvježite prikaz prije ponovnog pokušaja.",
  },
} as const;
