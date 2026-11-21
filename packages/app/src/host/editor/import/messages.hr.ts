// WEB-1801 (M8.2, S-19): student import of a DOCX or PDF. Imported text keeps the
// wave-10 mark "uvezeno" (src/components/editor/import/messages.hr.ts, D-198 t. 6).
export const importHostHr = {
  open: "Uvezi tekst iz datoteke",
  title: "Uvoz DOCX ili PDF datoteke",
  note: "Nastavnik je dopustio uvoz. Najprije vidite pregled teksta; u rad ulazi tek kad potvrdite. Uvezeni tekst ostaje označen kao uvezen, tvrdnja iz datoteke.",
  file: "Datoteka (.docx ili .pdf)",
  reading: "Čitam datoteku…",
  previewHeading: "Pregled uvezenog teksta",
  previewWords: (words: number) => `${words} riječi, još nije u radu`,
  mark: "uvezeno, tvrdnja iz datoteke",
  declaration: "Potvrđujem da je ovo moj tekst, nastao prije prelaska na Ducturu.",
  confirm: "Potvrdi uvoz",
  confirming: "Uvozim…",
  cancel: "Odustani",
  close: "Zatvori",
  done: (words: number) => `Uvezeno ${words} riječi, označeno kao uvezeno.`,
  refused: {
    type: "Datoteka mora biti DOCX ili PDF.",
    tooLarge: "Datoteka je prevelika. Najveća veličina je 10 MB.",
    empty: "U datoteci nema teksta za uvoz.",
    unreadable: "Datoteku nije moguće pročitati.",
  },
  notAllowed: "Uvoz za ovaj zadatak nije dopušten.",
  signedOut: "Sesija je istekla. Prijavite se ponovno.",
  expired: "Pregled je istekao. Odaberite datoteku ponovno.",
  unavailable: "Uvoz trenutačno nije dostupan. Pokušajte ponovno.",
} as const;
