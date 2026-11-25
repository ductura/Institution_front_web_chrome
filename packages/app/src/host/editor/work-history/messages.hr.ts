// ED-16 (NF2-P14): texts of "Povijest i usporedba", as in the prototype (docs/prototip/editor/nf2.js, nf2hist).
const formatDay = new Intl.DateTimeFormat("hr-HR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Zagreb" });

export const workHistoryHr = {
  open: "Povijest",
  title: "Povijest i usporedba",
  loading: "Učitavam verzije…",
  failed: "Verzije trenutačno nije moguće dohvatiti. Tekst na ovom uređaju je netaknut.",
  signedOut: "Sesija je istekla. Prijavite se ponovno.",
  retry: "Pokušaj ponovno",
  close: "Zatvori",
  empty: "Još nema verzija. Prva se pojavi nakon prvog spremanja na poslužitelju.",
  listTitle: (n: number) => `Verzije rada (${n})`,
  more: "Prikazane su samo najnovije verzije kad ih je više od stranice.",
  compareTitle: "Usporedba poslanih verzija",
  compareWith: "Usporedi s …",
  readOnly: (name: string) => `${name} · samo za čitanje`,
  back: "Natrag na popis",
  loadingText: "Učitavam tekst verzije…",
  textFailed: "Tekst ove verzije nije se učitao.",
  unreadable: "Tekst ove verzije ne može se ovdje prikazati.",
  blank: "Ova verzija nema teksta.",
  submission: (n: number) => `Predaja ${n}`,
  checkpoint: (revision: number) => `Verzija ${revision}`,
  day: (minute: string) => formatDay.format(new Date(minute)),
} as const;
