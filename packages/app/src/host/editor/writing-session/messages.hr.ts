// ED-77 (prototip tools.js „DANAŠNJA SESIJA”): tekstovi su iz prototipa; „·” je zamijenjen zarezom.
const plural = (n: number, one: string, few: string, many: string) => {
  const a = Math.abs(n) % 10, b = Math.abs(n) % 100;
  return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
};
/** 12 345, as the prototype's `fmt` writes a count. */
export const thousands = (n: number) => String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const signedCount = (n: number) => `${n >= 0 ? "+" : "−"}${thousands(n)}`;

export const writingSessionHr = {
  footer: "Sesija pisanja",
  start: "Započni sesiju pisanja",
  startHint: "cilj za danas",
  label: "Sesija",
  running: (words: number, goalWords: number, minutes: number, goalMinutes: number) =>
    `${signedCount(words)}${goalWords ? ` / ${goalWords}` : ""} riječi, ${minutes}${goalMinutes ? ` / ${goalMinutes}` : ""} min`,
  end: "Završi",
  dialogTitle: "Sesija pisanja",
  dialogIntro: "Postavite mali cilj za ovo sjedenje. Na kraju vidite što ste napravili. Sesije vidite samo Vi.",
  words: "Riječi",
  time: "Vrijeme",
  wordGoal: (n: number) => (n ? String(n) : "bez cilja"),
  minuteGoal: (n: number) => (n ? `${n} min` : "bez cilja"),
  cancel: "Odustani",
  confirm: "Započni",
  doneTitle: "Sesija je gotova",
  doneLead: (words: number, minutes: number) =>
    `${words >= 0 ? "Napisano" : "Skraćeno za"} ${thousands(words)} ${plural(words, "riječ", "riječi", "riječi")} u ${minutes} min.`,
  goalReached: (goal: number) => `Cilj od ${goal} riječi je dosegnut.`,
  goalLeft: (left: number) => `Do cilja je ostalo ${left} riječi.`,
  byChapter: "Po poglavljima",
  chapterDelta: (delta: number) => `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${thousands(delta)}`,
  noChapterChange: "Tekst poglavlja nije mijenjan.",
  previous: "Prethodne sesije",
  previousRow: (words: number, minutes: number) => `${signedCount(words)} riječi, ${minutes} min`,
  private: "Sesije vidite samo Vi.",
  close: "Zatvori",
} as const;
