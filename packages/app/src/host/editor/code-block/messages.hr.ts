// WEB-V21-STEM-KOD-BLOK: tekstovi bloka koda (izbornik Umetni, dijalog, prikaz u tekstu).
export const codeBlockHr = {
  insert: "Blok koda…",
  edit: "Svojstva bloka koda…",
  dialogTitle: "Blok koda",
  dialogHint: "Kod se samo prikazuje i uređuje kao tekst; ne izvršava se.",
  language: "Jezik",
  languageNone: "Bez jezika",
  languageNames: {
    c: "C", html: "HTML", java: "Java", javascript: "JavaScript", python: "Python", r: "R", sql: "SQL",
  },
  caption: "Naslov ispisa (neobavezno)",
  captionCounter: (length: number, max: number) => `${length} od ${max} znakova`,
  captionTooLong: (length: number, max: number) => `Naslov je predug: ${length} od najviše ${max} znakova.`,
  refused: "Blok koda nije moguće spremiti. Unos je zadržan, provjerite jezik i naslov.",
  confirm: "Spremi",
  cancel: "Odustani",
  listing: (caption: string) => `Ispis: ${caption}`,
  disabledSchema: "Formule i kod traže rad u novom obliku dokumenta.",
  disabledReadOnly: "Rad se ne može uređivati.",
} as const;
