/** Teacher comments panel, texts exactly as in the prototype (N-08, INVENTAR-nastavnik 3.7). */
export const teacherCommentsMessages = {
  title: "Komentari i prijedlozi",
  note: "Tekst rada je samo za čitanje. Izmjene u tekstu idu kao prijedlozi (zadano). Isti komentar vidi i student.",
  empty: "Još nema komentara.",
  threadTitle: "Komentar uz „{quote}”",
  newTitle: "Novi komentar",
  newLabel: "Novi komentar",
  newSubmit: "Dodaj komentar",
  newSubmitting: "Dodavanje…",
  cancel: "Odustani",
  hint: "Označite tekst u radu za komentar.",
  reply: "Odgovori",
  replying: "Slanje…",
  replyLabel: "Odgovor",
  replyPlaceholder: "Odgovor na komentar…",
  resolve: "Označi kao riješeno",
  reopen: "Ponovno otvori",
  added: "Komentar je dodan. Isti komentar vidi i student.",
  own: "Vi",
  teacher: "Nastavnik",
  student: "Student",
  emptyBody: "Unesite tekst komentara.",
} as const;

/** How long the confirmation stays on screen (prototype toast, 3200 ms). */
export const COMMENT_TOAST_MS = 3200;
