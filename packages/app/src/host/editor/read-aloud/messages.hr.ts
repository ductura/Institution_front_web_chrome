// WEB-V20-NAGLAS-UREDNIK: interface text of reading aloud in the editor (Croatian). The text never leaves the browser.
export const readAloudHr = {
  menu: "Čitaj naglas",
  paragraph: "Čitaj odlomak",
  selection: "Čitaj odabir",
  work: "Čitaj rad",
  pause: "Pauza",
  resume: "Nastavi",
  stop: "Zaustavi čitanje",
  status: {
    reading: "Čitanje u tijeku",
    paused: "Čitanje je na pauzi",
    stopped: "Čitanje je zaustavljeno",
    finished: "Čitanje je završeno",
    failed: "Čitanje nije uspjelo. Pokušajte ponovno.",
    noText: "Nema teksta za čitanje.",
    noSelection: "Najprije označite tekst koji želite čuti.",
    unsupported: "Ovaj preglednik ne podržava čitanje naglas.",
    voiceFallback: "Hrvatski glas nije dostupan, koristi se zadani glas preglednika.",
  },
  local: "Tekst se čita u pregledniku i ne šalje se nikamo.",
} as const;
