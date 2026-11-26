// WEB-V16-POVJERENSTVO: the texts of the section "Povjerenstvo" and of CommitteeEditor. In this version the
// committee is only a list beside the work: it gets no access to the text (val16-razlika §2.5, U-1).
export const committeeHr = {
  title: "Povjerenstvo",
  none: "Povjerenstvo još nije imenovano.",
  noAccessNote: "Povjerenstvo u ovoj verziji ne dobiva pristup tekstu rada. Ovdje se vidi samo popis članova.",
  roles: { chair: "Predsjednik", member: "Član" },
  unnamed: "Osoba bez prikazanog imena",
  changedBy: { faculty: "Popis je imenovala ustanova." },
  listLabel: "Članovi povjerenstva",
  editor: {
    title: "Imenovanje povjerenstva",
    hint: "Najviše 5 članova, najviše jedan predsjednik. Članovi su potvrđeni nastavnici ustanove.",
    selected: "Odabrani članovi",
    roleLabel: "Uloga",
    remove: "Ukloni",
    addLabel: "Dodaj člana",
    addPlaceholder: "Odaberite nastavnika",
    noCandidates: "Nema potvrđenih nastavnika koje je moguće dodati.",
    save: "Spremi povjerenstvo",
    saving: "Spremanje…",
    empty: "Popis je prazan.",
  },
  saved: "Povjerenstvo je spremljeno.",
  unchanged: "Popis se nije promijenio, ništa nije spremljeno.",
  problems: {
    tooMany: "Povjerenstvo može imati najviše 5 članova.",
    manyChairs: "Povjerenstvo može imati najviše jednog predsjednika.",
    duplicate: "Ista osoba ne može biti navedena dvaput.",
  },
  errors: {
    invalid: "Poslužitelj nije prihvatio popis. Članovi moraju biti potvrđeni nastavnici ove ustanove.",
    forbidden: "Povjerenstvo može imenovati samo administrator ustanove.",
    notFound: "Ovaj rad nije dostupan.",
    unknown: "Nije poznato je li popis spremljen. Osvježite prikaz prije ponovnog pokušaja.",
    candidates: "Popis nastavnika trenutačno nije dostupan.",
  },
} as const;
