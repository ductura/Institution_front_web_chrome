// WEB-V16-ETAPE-STUDENT: the texts of the student's "Etape" section.
export const stagesStudentHr = {
  title: "Etape",
  due: "Rok",
  noDue: "Rok nije određen",
  submittedAt: "Predano",
  revisionComment: "Komentar mentora",
  revisionDue: "Novi rok",
  approvedAt: "Odobreno",
  submit: "Predaj etapu",
  states: {
    not_submitted: "Nije predano",
    submitted: "Predano",
    revision_requested: "Vraćeno na doradu",
    approved: "Odobreno",
  },
  saved: "Etapa je predana.",
  changed: "Etapa se u međuvremenu promijenila. Prikaz je osvježen.",
  unknown: "Nismo mogli potvrditi predaju. Osvježite prikaz i provjerite stanje etape.",
  sessionExpired: "Sesija je istekla. Prijavite se ponovno.",
} as const;
