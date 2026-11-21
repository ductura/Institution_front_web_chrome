/**
 * The profile settings page (WEB-1804, M11.5, D-70), Croatian. The English
 * table is `profileEn` in `./messages.en.ts`; the parity test checks both.
 */
export const profileHr = {
  title: "Postavke profila",
  intro: "Postavke vrijede samo za Vaš račun. Promjena jezika ne traži ponovnu prijavu.",
  open: "Postavke profila",
  language: {
    heading: "Jezik sučelja",
    label: "Jezik",
    hint: "Jezik zaslona koji čitate. Jezik na kojem pišete rad zadaje se u zadatku i ne mijenja se ovdje.",
    options: { hr: "Hrvatski", en: "English" },
    save: "Spremi jezik",
    saving: "Spremam jezik…",
    saved: "Jezik sučelja je spremljen na poslužitelju.",
    failed: "Jezik nije spremljen na poslužitelju. Pokušajte ponovno.",
    signedOut: "Prijava je istekla. Prijavite se ponovno preko AAI@EduHr pa spremite jezik.",
    loadFailed: "Jezik zapisan na poslužitelju trenutačno nije moguće pročitati. Prikazan je zadani jezik.",
  },
  format: {
    heading: "Datumi i brojevi",
    hint: "Datumi i brojevi pišu se prema jeziku sučelja, a vrijeme je uvijek zagrebačko.",
    date: "Datum i vrijeme",
    number: "Broj",
  },
  name: {
    heading: "Prikaz imena",
    label: "Ime u sučelju",
    hint: "Ime dolazi iz prijave preko AAI@EduHr. Mijenja se u sustavu Vaše ustanove, ne ovdje.",
    none: "Ime nije poslano pri prijavi.",
  },
  notifications: {
    heading: "Obavijesti u aplikaciji",
    hint: "Obavijesti se prikazuju samo u Ducturi. E-poštom se ne šalje ništa.",
    kinds: {
      comment: "Novi komentar na radu",
      assignmentVersion: "Nova verzija zadatka",
      submission: "Zabilježena predaja",
    },
    save: "Spremi obavijesti",
    saving: "Spremam obavijesti…",
    saved: "Postavke obavijesti su spremljene na poslužitelju.",
    failed: "Postavke obavijesti nisu spremljene na poslužitelju. Pokušajte ponovno.",
    loading: "Učitavam postavke obavijesti…",
    unavailable: "Postavke obavijesti još nisu dostupne na poslužitelju ustanove.",
  },
};

/** Labels of pages whose screens have no English table yet (routes.ts takes them from the screens' own Croatian tables). */
export const pageLabelsHr = {
  consultations: "Konzultacije",
};

/** M1.8: the no-access and session-ended screen. English: `accessDeniedEn` in ./messages.en.ts. */
export const accessDeniedHr = {
  pageTitle: "Nema ovlasti",
  title: { denied: "Nemate ovlasti za ovaj prikaz", expired: "Prijava je istekla", signedOut: "Potrebna je prijava" },
  body: {
    denied: "Ovaj prikaz nije dostupan s Vašim računom. Ako mislite da bi trebao biti, obratite se administratoru svoje ustanove.",
    expired: "Prijava je istekla zbog dulje neaktivnosti. Prijavite se ponovno preko AAI@EduHr i nastavite gdje ste stali.",
    signedOut: "Za ovaj prikaz prijavite se preko AAI@EduHr.",
  },
  signIn: "Prijavi se preko AAI@EduHr",
  heldNote: "Neposlani unos ostao je spremljen na uređaju (ne na poslužitelju). Nakon prijave možete ga nastaviti.",
  home: "Na početnu",
} as const;

export type ProfileMessages = typeof profileHr;
