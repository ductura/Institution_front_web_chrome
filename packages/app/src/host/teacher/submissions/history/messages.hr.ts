export const historyText = {
  title: "Povijest predaja i povlačenja",
  caption: "Predaje i povlačenja rada, od najnovijeg",
  event: "Događaj",
  submitted: "Predano",
  withdrawn: "Povučeno",
  afterDeadline: "(nakon roka)",
  attempt: "Pokušaj",
  revision: "Revizija",
  time: "Vrijeme",
  empty: "Još nema predaja ni povlačenja.",
  loading: "Učitavam povijest.",
  unavailable: "Povijest trenutačno nije dostupna. Pokušajte ponovno.",
  notFound: "Zadatak nije pronađen.",
  retry: "Pokušaj ponovno",
  settingLabel: "Student smije povući predaju dok rok traje",
  settingHint: "Svako povlačenje se bilježi i vidi se u povijesti. Isključenje vrijedi za nova povlačenja.",
  settingSaved: "Postavka je zapisana na poslužitelju.",
  settingForbidden: "Postavku može promijeniti samo nastavnik zadatka.",
  settingUnknown: "Nije poznato je li postavka zapisana. Osvježite stanje prije novog pokušaja.",
  settingUnavailable: "Postavka trenutačno nije dostupna.",
  saving: "Zapisuje se…",
  // PIL-D3-NASTAVNIK: the history beside each submission row of the teacher's submissions table.
  column: "Povijest",
  show: "Prikaži povijest",
  hide: "Zatvori povijest",
  settingTitle: "Povlačenje predaje",
} as const;

/** The accessible name of a row's history button, naming the student (the visible text is the same in every row). */
export const showHistoryLabel = (student: string): string => `${historyText.show}: ${student}`;
