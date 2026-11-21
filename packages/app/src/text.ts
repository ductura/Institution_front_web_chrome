// The few texts of the host itself; every other text comes from locales/hr.ts
// through the screens. text.test.ts runs them through the forbidden terms scan
// (Ductus PRODUCT §5), as the scan does for locales/.
export const hostText = {
  loading: "Učitavanje…",
  signingIn: "Preusmjeravanje na prijavu preko AAI@EduHr…",
  sessionUnavailableTitle: "Prijavu nije bilo moguće provjeriti",
  sessionUnavailable: "Poslužitelj ustanove trenutačno ne odgovara. Pokušajte ponovno za nekoliko minuta.",
  pending: "Ovaj prikaz još nije spojen na poslužitelj ustanove.",
  noRole: "Ovaj račun još nema ulogu u ustanovi. Ulogu dodjeljuje administrator ustanove.",
  signOutFailed: "Odjava nije uspjela. Pokušajte ponovno.",
  signIn: "Prijava",
  // HOST-T3: the label of N-13 (WEB-1113) until locales/ has its catalogue.
  deadlineExtensions: "Produljenje roka",
  // WEB-1502 (M7.2): the label of the submissions page.
  assignmentSubmissions: "Predaje zadatka",
  mentorshipRequest: "Zahtjev za mentorstvo",
} as const;
