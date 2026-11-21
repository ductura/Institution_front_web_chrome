const formatMinute = new Intl.DateTimeFormat("hr-HR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Zagreb" });

export const timeMachineMessages = {
  open: "Povijest verzija",
  title: "Povijest verzija",
  intro: "Odaberite dvije verzije rada i pogledajte što se između njih promijenilo.",
  from: "Starija verzija",
  to: "Novija verzija",
  choose: "Odaberite verziju",
  compare: "Usporedi",
  close: "Zatvori",
  retry: "Pokušaj ponovno",
  loading: "Učitavanje verzija…",
  loadingCompare: "Učitavanje usporedbe…",
  empty: "Za usporedbu su potrebne barem dvije verzije.",
  samePoint: "Odaberite dvije različite verzije.",
  partialVersions: "Prikazane su samo novije verzije.",
  truncated: "Prikazan je samo dio razlika.",
  noChanges: "Između odabranih verzija nema razlike.",
  unavailable: "Verzije trenutačno nije moguće dohvatiti.",
  compareFailed: "Usporedba se nije učitala.",
  signedOut: "Sesija je istekla. Prijavite se ponovno.",
  checkpoint: "Verzija",
  submission: "Predaja",
  version: (kind: "checkpoint" | "submission", revision: number, minute: string) =>
    `${kind === "submission" ? "Predaja" : "Verzija"} ${revision} · ${formatMinute.format(new Date(minute))}`,
} as const;
