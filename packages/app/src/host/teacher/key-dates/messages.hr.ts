export const keyDatesMessages = {
  title: "Ključni rokovi",
  note: "Rokovi ovog mentorstva, od najranijeg prema najkasnijem.",
  kindOpens: "Otvaranje zadatka",
  kindDeadline: "Rok predaje",
  kindExtended: "Produženi rok",
  kindReview: "Rok za pregled",
  at: (day: number, month: number, year: number, time: string): string => `${day}. ${month}. ${year}. u ${time}`,
  loading: "Učitavam ključne rokove…",
  empty: "Za ovo mentorstvo još nema ključnih rokova.",
  unavailable: "Ključni rokovi trenutačno nisu dostupni.",
  signedOut: "Sesija je istekla. Prijavite se ponovno.",
  retry: "Pokušaj ponovno",
} as const;
