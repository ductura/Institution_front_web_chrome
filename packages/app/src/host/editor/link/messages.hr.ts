// ED-127: tekstovi poveznice (prototip acad.js, acLink i acLinkDel).
export const linkHr = {
  insert: "Poveznica na označeni tekst",
  remove: "Ukloni poveznicu",
  title: "Poveznica",
  address: "Adresa",
  placeholder: "https://primjer.hr/stranica",
  hint: "Adresa počinje s https://, http:// ili mailto:. Bez toga se doda https://.",
  save: "Spremi poveznicu",
  cancel: "Odustani",
  noSelection: "Najprije označite tekst koji će biti poveznica.",
  invalid: "Ova adresa nije ispravna. Provjerite je li cijela i bez razmaka.",
  unavailable: "Poveznica radi u radovima s novim oblikom dokumenta.",
  done: "Poveznica je dodana.",
  removed: "Poveznica je uklonjena, tekst je ostao.",
  noLink: "Kursor nije u poveznici. Stavite ga u poveznicu koju želite ukloniti.",
} as const;
