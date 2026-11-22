// WEB-2164 (paritet, zajednički toast nastavnika): the texts of the toast shell and the
// outcomes the prototype shows as toasts (INVENTAR-nastavnik). Each one is shown only after
// the server has confirmed (B-6), never before.
export const teacherToastHr = {
  region: "Obavijesti",
  close: "Zatvori",
  published: "Zadatak je objavljen. Studenti grupa 2 i 4 dobivaju obavijest.",
  codeIssued: "Novi kod za upis je izdan.",
  mentorshipApproved: "Zahtjev je odobren; mentorstvo je nastalo.",
  mentorshipDeclinedWithReason: "Zahtjev je odbijen. Student vidi odgovor i razlog.",
  mentorshipDeclined: "Zahtjev je odbijen. Student vidi odgovor.",
  revisionAccepted: "Dorada je prihvaćena.",
  revisionReopened: "Zahtjev za doradu je ponovno otvoren.",
  revisionRequested: "Zahtjev za doradu je poslan. Student ga vidi uz rad.",
  suggestionWithdrawn: "Prijedlog je povučen. Tekst rada nije promijenjen.",
  commentAdded: "Komentar je dodan. Isti komentar vidi i student.",
  consultationRecorded: "Konzultacija je zabilježena. Isti zapis vidi i student.",
  consultationNoteAdded: "Dopuna je dodana. Vidi je i student.",
} as const;
