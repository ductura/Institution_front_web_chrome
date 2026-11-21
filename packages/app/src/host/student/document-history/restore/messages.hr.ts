export const restoreMessages = {
  title: "Vrati raniji tekst",
  note: "Vraćanje stvara novu verziju s tekstom koji odabereš. Sve dosadašnje verzije ostaju u povijesti dokumenta.",
  version: (revision: number): string => `Verzija ${revision}`,
  current: "Trenutačna verzija",
  restore: "Vrati ovaj tekst",
  confirm: (revision: number): string =>
    `Tekst verzije ${revision} postat će nova verzija dokumenta. Ništa se ne briše. Nastaviti?`,
  confirmYes: "Da, vrati tekst",
  confirmNo: "Odustani",
  restoring: "Vraćam tekst…",
  done: (from: number, revision: number): string => `Tekst verzije ${from} vraćen je kao nova verzija ${revision}.`,
  conflict: "Dokument se u međuvremenu promijenio. Osvježi povijest i pokušaj ponovno.",
  notFound: "Ta verzija nije pronađena.",
  signedOut: "Sesija je istekla. Prijavite se ponovno.",
  unavailable: "Vraćanje trenutačno nije moguće. Ništa nije promijenjeno.",
} as const;
