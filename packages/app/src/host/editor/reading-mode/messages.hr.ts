// WEB-V20-NACIN-CITANJA: the Croatian text of the reading-mode controls (width, line spacing, letter spacing, paragraph gap).
// A personal view of the sheet in this browser; nothing here goes to the server.
export const readingModeHr = {
  title: "Način čitanja",
  help: "Mijenja samo prikaz lista na ovom uređaju. Tekst rada ostaje isti.",
  reset: "Vrati na zadano",
  width: {
    label: "Širina retka",
    narrow: "Uža",
    standard: "Zadana",
    wide: "Šira",
  },
  lineHeight: {
    label: "Razmak redaka",
    standard: "Zadani",
    relaxed: "Veći",
    loose: "Najveći",
  },
  letterSpacing: {
    label: "Razmak slova i riječi",
    standard: "Zadani",
    wide: "Veći",
    wider: "Najveći",
  },
  paragraphGap: {
    label: "Razmak odlomaka",
    standard: "Zadani",
    wide: "Veći",
    wider: "Najveći",
  },
} as const;
