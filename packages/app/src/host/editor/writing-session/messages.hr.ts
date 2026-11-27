// ED-110: the words of the writing session (prototype tools.js, "Sesija pisanja").
import { wordsLabel } from "./session-model";

export const writingSessionHr = {
  start: "Započni sesiju pisanja",
  startHint: "cilj za danas",
  session: "Sesija",
  end: "Završi",
  progressWords: (added: number, goal: number | null) =>
    goal === null ? `${added >= 0 ? "+" : ""}${added} ${wordsLabel(added)}` : `${added >= 0 ? "+" : ""}${added} / ${goal} riječi`,
  progressMinutes: (minutes: number, goal: number | null) => (goal === null ? `${minutes} min` : `${minutes} / ${goal} min`),
  dialogTitle: "Sesija pisanja",
  intro: "Postavite mali cilj za ovo sjedenje. Na kraju vidite što ste napravili. Sesije vidite samo Vi.",
  wordsGoal: "Riječi",
  minutesGoal: "Vrijeme",
  minutes: (n: number) => `${n} min`,
  noGoal: "bez cilja",
  cancel: "Odustani",
  begin: "Započni",
  doneTitle: "Sesija je gotova",
  written: (words: number, minutes: number) => words >= 0
    ? `Napisano ${words} ${wordsLabel(words)} u ${minutes} min.`
    : `Skraćeno za ${-words} ${wordsLabel(words)} u ${minutes} min.`,
  goalReached: (goal: number) => ` Cilj od ${goal} riječi je dosegnut.`,
  goalLeft: (left: number) => ` Do cilja je ostalo ${left} ${wordsLabel(left)}.`,
  byChapter: "Po poglavljima",
  noChapterChange: "Tekst poglavlja nije mijenjan.",
  delta: (n: number) => `${n > 0 ? "+" : ""}${n}`,
  previous: "Prethodne sesije",
  logLine: (words: number, minutes: number) => `${words > 0 ? "+" : ""}${words} ${wordsLabel(words)}, ${minutes} min`,
  private: "Sesije vidite samo Vi.",
  close: "Zatvori",
  untitled: "Bez naslova",
};
