const formatMinute = new Intl.DateTimeFormat("hr-HR", {
  dateStyle: "short", timeStyle: "short", timeZone: "Europe/Zagreb",
});
const plural = new Intl.PluralRules("hr-HR");
const wordCount = (n: number) => `${n} ${plural.select(n) === "one" ? "riječ" : "riječi"}`;

export const comparisonHr = {
  title: "Usporedba verzija",
  submissions: "Usporedi predaje",
  round: "Pregled runde",
  roundNumber: (n: number) => `Pregled runde ${n}`,
  whatsNew: "Što je novo",
  timeline: "Vremenska traka predaja",
  compareWith: "Usporedi s …",
  from: "Od",
  to: "Do",
  onlyChanges: "Samo promjene",
  loadingVersions: "Učitavanje verzija…",
  loadingComparison: "Učitavanje usporedbe…",
  versionsError: "Verzije se nisu učitale.",
  compareError: "Usporedba se nije učitala.",
  notFound: "Tražene verzije nisu dostupne.",
  empty: "Za usporedbu su potrebne dvije poslane verzije.",
  oneVersion: "Za sada postoji jedna verzija, pa se usporedba ne nudi.",
  samePoint: "Odabrali ste istu točku dvaput.",
  noChanges: "Nema razlike između odabranih verzija.",
  truncated: "Prikazan je samo dio razlika.",
  replay: "Otvori reprodukciju",
  retry: "Pokušaj ponovno",
  close: "Zatvori",
  openComments: "Otvori komentare",
  openReview: "Otvori Pregled",
  version: (revision: number, minute: string) =>
    `Predaja · ${formatMinute.format(new Date(minute))} · verzija ${revision}`,
  added: (n: number) => `Dodano ${wordCount(n)}`,
  removed: (n: number) => `Uklonjeno ${wordCount(n)}`,
};
