// WEB-V20-POSTAVKE-DIJALOG: the Croatian text of the "Prikaz i čitanje" dialog (font, reading mode, read-aloud speed).
// Personal view settings kept in this browser only; nothing here goes to the server.
export const readingSettingsHr = {
  menu: "Prikaz i čitanje",
  title: "Prikaz i čitanje",
  intro: "Osobne postavke samo za ovaj preglednik. Tekst rada ostaje isti, a ništa se ne šalje na poslužitelj.",
  font: {
    label: "Font teksta rada",
    standard: "Zadani",
    dyslexia: "Za disleksiju",
    help: "Font za disleksiju mijenja samo tekst rada, ne i sučelje.",
  },
  rate: {
    label: "Brzina čitanja naglas",
    slow: "Sporije",
    standard: "Zadana",
    fast: "Brže",
    faster: "Najbrže",
  },
  reset: "Zadano",
  resetDone: "Prikaz i čitanje vraćeni su na zadano.",
  done: "Gotovo",
} as const;
