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
  // E-1 (paritet 2101): the states of /prijava that the catalogues do not carry.
  signInRedirecting: "Preusmjeravamo Vas na AAI@EduHr",
  signInNoRoleTitle: "Prijava je uspjela",
  signInNoRoleBody: "Ovaj račun još nema dodijeljenu ulogu, pa se Vaš prostor ne može otvoriti.",
  signOutFailed: "Odjava nije uspjela. Pokušajte ponovno.",
  signIn: "Prijava",
  // HOST-T3: the label of N-13 (WEB-1113) until locales/ has its catalogue.
  deadlineExtensions: "Produljenje roka",
  mentorshipRequest: "Zahtjev za mentorstvo",
  practiceJournal: "Dnevnik prakse",
  qualMaterials: "Gradivo za kodiranje",
  qualExport: "Izvoz kodiranja",
  qualCoding: "Kodiranje",
  questionnaireExport: "Izvoz odgovora upitnika",
  mentorPracticeJournal: "Dnevnik prakse studenata",
  workTeam: "Moj tim",
  workTeams: "Timovi na zadatku",
  teacherPeerReview: "Recenzija među studentima",
  teacherCodeTests: "Testovi uz zadatak",
  peerReview: "Recenzija radova",
  peerReviewReceived: "Primljene recenzije",
  peerReviewWork: "Recenzija rada",
} as const;
