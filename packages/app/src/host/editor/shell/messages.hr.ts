// WEB-2136 (paritet E, §1.2/§1.5/§1.12, INVENTAR-editor): the shell's view
// mode, "samo naslovi" and the panel widths. Texts as in the prototype.
export const shellHr = {
  modeLabel: "Prikaz",
  write: "Pisanje",
  teacher: "Kako vidi nastavnik",
  teacherShort: "Nastavnik",
  teacherUnavailable: "Pogled nastavnika još nije spojen na poslužitelj ustanove.",
  outlineOnly: "Samo naslovi",
  outlineOnlyTitle: "Samo naslovi i svrhe poglavlja",
  outlineBanner: "Prikaz samo naslova. Pisanje je isključeno dok je ovaj prikaz uključen.",
  outlineResume: "Nastavi pisati",
  widthsLabel: "Širina na računalu",
  rail: "Struktura",
  panel: "Desni panel",
  width: { narrow: "Uska", medium: "Srednja", wide: "Široka" },
} as const;
