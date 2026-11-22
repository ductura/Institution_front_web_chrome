// N-06 "Rad": text elements (WEB-2153, PARITET br. 13). Wording as in the prototype
// (Ductura_nastavnik.html, `.ed-cite`, `.ed-open`, `.ed-notes`).
export const textElementsMessages = {
  openSource: "otvoreno mjesto za izvor",
  openSourceTitle: "Student je ovdje označio mjesto za izvor koje još nije popunjeno.",
  citationTitle: "Navod prema izvoru",
  notesLabel: "Fusnote",
  noteMark: (n: number) => `Fusnota ${n}`,
  noteBack: (n: number) => `Natrag na fusnotu ${n} u tekstu`,
  unavailable: "Navodi, otvorena mjesta za izvor i fusnote ovog rada trenutačno nisu dostupni; prikazan je običan tekst.",
} as const;
