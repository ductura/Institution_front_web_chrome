// WEB-2125 (paritet, Fusnota i unakrsna referenca): tekstovi iz INVENTAR-a i
// prototipa; dijalozi Fusnota i Unakrsna poveznica kao u prijašnjem kodu.
export const footnoteHr = {
  title: "Fusnota",
  text: "Tekst fusnote",
  hint: "Fusnota služi za objašnjenje. Izvor navedite u tekstu rada.",
  invalidText: "Unesite do 2.000 vidljivih znakova.",
  empty: "Fusnota je prazna.",
  insert: "Umetni",
  save: "Spremi",
  edit: "Uredi",
  remove: "Ukloni",
  cancel: "Odustani",
  close: "Zatvori",
  unavailable: "Fusnotu sada nije moguće promijeniti.",
  /** Umetanje je isključeno dok rad nije u shemi koja nosi fusnote. */
  disabledSchema: "Fusnote i unakrsne reference nisu dostupne u ovoj inačici rada.",
  /** Samo čitanje (predano, nastavnik, suradnik): ne može se mijenjati. */
  disabledReadOnly: "Rad je samo za čitanje.",
} as const;

export const crossReferenceHr = {
  title: "Unakrsna poveznica",
  target: "Cilj poveznice",
  choose: "Odaberite poglavlje",
  empty: "Još nema poglavlja za povezivanje.",
  missing: "Poveznica nema dostupno poglavlje.",
  hint: "Broj se sam mijenja kad premjestite poglavlje.",
  heading: "Poglavlje",
  insert: "Umetni",
  follow: "Idi na cilj",
  remove: "Ukloni",
  close: "Zatvori",
  unavailable: "Poveznicu sada nije moguće promijeniti.",
  /** Prikazi (tablice, slike) nisu u shemi rada: stanje „nedostupno”, ne izmišljamo čvor. */
  displaysUnavailable: "Poveznica na tablicu ili sliku još nije dostupna.",
} as const;
