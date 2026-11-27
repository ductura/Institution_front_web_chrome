// WEB-1602 (M5.3): the table of contents in the editor shell. Prototype
// "Struktura" (INVENTAR-editor E§3: ↑/↓, Alt+Shift+↑/↓, "Kopiraj sadržaj rada").
export const tocHr = {
  label: "Sadržaj",
  untitled: "Bez naslova",
  moveUp: "Pomakni poglavlje gore",
  moveDown: "Pomakni poglavlje dolje",
  moveHint: "Alt+Shift+↑/↓ premješta poglavlje s kursorom.",
  copy: "Stavi sadržaj rada u međuspremnik",
  copied: "Sadržaj rada: kopirano u međuspremnik.",
  copyFailed: "Sadržaj se nije mogao staviti u međuspremnik. Označite ga i upotrijebite prečac preglednika.",
  // ED-71: "Sadržaj na listu" (prototype features.js `#toc .tocbox`).
  sheetTitle: "Sadržaj",
  sheetEmpty: "Rad još nema naslova.",
  sheetNote: "Složeno iz naslova.",
  sheetLabel: "Sadržaj na listu",
} as const;
