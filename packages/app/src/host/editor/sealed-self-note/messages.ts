// Interface text of the sealed "Poruka sebi" (WEB-NF6-SIFRA). Plain Croatian, no technical
// terms; the forbidden-terms scan reads this file (`**/messages.ts`).

export const sealedSelfNoteHr = {
  title: "Poruka sebi",
  intro: "Kratka bilješka za vas: što sljedeće napraviti i gdje ste stali. Zaštićena je na vašem uređaju prije slanja, pa je osim vas nitko ne može pročitati.",
  loading: "Učitavanje poruke…",
  unavailable: "Poruka trenutačno nije dostupna.",
  retry: "Pokušaj ponovno",
  signedOut: "Za poruku sebi ponovno se prijavite.",
  notFound: "Ovaj rad više nije dostupan.",

  // First use: the phrase and the recovery code are made here.
  setupOffer: "Prije prve poruke aplikacija će napraviti frazu i kod za oporavak. Trebat će vam na drugom računalu i nakon odjave.",
  setupStart: "Napravi frazu i kod",
  setupTitle: "Spremite frazu i kod za oporavak",
  setupLead: "Zapišite ih ili spremite izvan Ducture, odvojeno jedno od drugog. Fraza otvara poruke na drugom računalu; kod za oporavak koristite ako izgubite frazu.",
  phraseLabel: "Fraza",
  recoveryLabel: "Kod za oporavak",
  warning: "Nitko ih ne može vratiti: ni fakultet, ni nastavnik, ni Ductura. Ako izgubite i frazu i kod za oporavak, vaše poruke sebi više se ne mogu pročitati.",
  savedConfirm: "Frazu i kod za oporavak spremio sam ili spremila izvan Ducture.",
  setupDone: "Gotovo",
  setupBusy: "Spremanje…",
  setupTaken: "Na drugom uređaju već su napravljeni fraza i kod. Unesite tu frazu.",
  setupFailed: "Fraza i kod još nisu postavljeni. Pokušajte ponovno.",

  // Another computer, or after signing out.
  unlockLead: "Na ovom uređaju poruke još nisu otvorene. Unesite frazu ili kod za oporavak.",
  unlockLabel: "Fraza ili kod za oporavak",
  unlockHint: "Šest skupina po četiri znaka. Velika i mala slova nisu važna.",
  unlock: "Otvori poruke",
  unlockBusy: "Otvaranje…",
  unlockWrong: "Fraza ili kod za oporavak nisu točni.",
  unlockMalformed: "Unesite šest skupina po četiri znaka.",
  unlockDeviceFailed: "Poruke su otvorene samo dok je stranica otvorena: ovaj preglednik ne dopušta spremanje.",

  // After the recovery code: a new pair is suggested.
  recoveryUsed: "Otvorili ste poruke kodom za oporavak. Ako ste izgubili frazu, napravite novu frazu i novi kod.",
  renewStart: "Napravi novu frazu i kod",
  renewLabel: "Sadašnja fraza ili kod za oporavak",
  renewConfirm: "Napravi novu frazu i kod",
  renewCancel: "Odustani",
  renewTaken: "Fraza je u međuvremenu promijenjena na drugom uređaju. Unesite novu frazu.",
  renewDone: "Nova fraza i kod postavljeni su. Stari više ne vrijede.",

  // The note itself.
  noteLabel: "Vaša poruka",
  noteHint: (left: number) => `Preostalo znakova: ${left}`,
  save: "Spremi poruku",
  saveBusy: "Spremanje…",
  saved: "Poruka je spremljena na poslužitelju.",
  saveFailed: "Poruka nije spremljena na poslužitelju. Pokušajte ponovno.",
  tooLong: "Poruka je preduga.",
  empty: "Upišite poruku.",
  notAllowed: "Poruka sadrži znak koji se ne može spremiti. Uklonite ga i pokušajte ponovno.",
  placeKept: "Uz poruku je zapamćeno mjesto u radu.",
  goToPlace: "Idi na to mjesto",
  remove: "Obriši poruku",
  removed: "Poruka je obrisana.",
  oldNote: "Ova poruka zaštićena je prijašnjom frazom i više se ne može pročitati.",
  unreadable: "Poruka se ne može pročitati.",
  changedElsewhere: "Fraza je promijenjena na drugom uređaju. Ponovno unesite frazu.",

  // Both lost: start over.
  lostBoth: "Izgubio sam ili izgubila i frazu i kod",
  resetTitle: "Početi ispočetka?",
  resetBody: "Napravit ćemo novu frazu i novi kod. Sve dosadašnje poruke sebi, u svim radovima, tada se trajno više ne mogu pročitati. To se ne može poništiti.",
  resetConfirm: "Da, počni ispočetka",
  resetCancel: "Ostani",
  resetBusy: "Brisanje…",
  resetChanged: "Na drugom uređaju u međuvremenu je nešto promijenjeno. Ništa nije obrisano; pogledajte ponovno.",
  resetFailed: "Ništa nije obrisano. Pokušajte ponovno.",
} as const;

export type SealedSelfNoteText = typeof sealedSelfNoteHr;
