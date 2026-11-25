// WEB-V21-STEM-KOD-BLOK: tekstovi bloka koda (izbornik Umetni, dijalog, prikaz u tekstu).
export const codeBlockHr = {
  insert: "Blok koda…",
  edit: "Svojstva bloka koda…",
  editHint: "Blok koda se samo prikazuje i uređuje; ne izvršava se.",
  dialogTitle: "Blok koda",
  dialogHint: "Kod se samo prikazuje i uređuje kao tekst; ne izvršava se.",
  language: "Jezik",
  languageNone: "Bez jezika",
  languageNames: {
    c: "C", html: "HTML", java: "Java", javascript: "JavaScript", python: "Python", r: "R", sql: "SQL",
  },
  caption: "Naslov ispisa (neobavezno)",
  captionCounter: (length: number, max: number) => `${length} / ${max} znakova`,
  captionTooLong: (length: number, max: number) => `Naslov je predug: ${length} od najviše ${max} znakova.`,
  refused: "Blok koda nije moguće spremiti. Unos je zadržan, provjerite jezik i naslov.",
  confirm: "Spremi",
  cancel: "Odustani",
  listing: (caption: string) => `Ispis: ${caption}`,
  lineNumbers: "Brojevi redaka",
  disabledSchema: "Blokovi koda nisu dostupni u ovom radu.",
  disabledReadOnly: "Rad se ne može uređivati.",
} as const;
