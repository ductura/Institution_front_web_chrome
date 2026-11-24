// WEB-2104 (E-5, E-6): the texts of the prototype (INVENTAR-student.md E-5/E-6)
// that the shared catalogue does not carry; everything else is read from it.
export const enrolText = {
  sendingStatus: "Upisivanje u kolegij…",
  alreadyEnrolled: "Već ste upisani u ovaj kolegij.",
  openAssignment: "Otvori zadatak",
  noAssignment: "Upisani ste u kolegij, ali u njemu zasad nema otvorenog zadatka. Kad ga nastavnik objavi, vratite se na ovu stranicu.",
  another: "Upiši drugi kolegij",
};

export const noticeText = {
  ruleBy: "Pravilo je postavio nastavnik kolegija (Mentor). Razlikuje se od pravila fakulteta.",
  facultyRule: "Pravilo fakulteta (FPZG čl. 8)",
  facultyAllowed: "Dopušteno pravilom fakulteta",
  facultyBanned: "Nije dopušteno pravilom fakulteta",
  eyebrow: "Prije pisanja",
  heroBefore: "Prije prve",
  heroAccent: "rečenice",
};

// E-5 `MSG` of the prototype: the text for the states the prototype names
// (neispravan, istekao, mreza, and previse of P-10); other refusals keep the shared
// text. A code that does not exist and an expired one keep one text on purpose:
// telling them apart would say that a code exists (P-10, E-5a).
export const enrolErrors = {
  malformed: "Kod ima od 8 do 32 slova i brojke. Provjerite ga i upišite ponovno.",
  invalidCode: "Kod ne postoji ili je istekao. Provjerite ga s nastavnikom.",
  expiredCode: "Kod ne postoji ili je istekao. Provjerite ga s nastavnikom.",
  offline: "Nema veze s poslužiteljem. Provjerite mrežu i pokušajte ponovno.",
  tooManyAttempts: "Previše pokušaja. Pričekajte malo i pokušajte ponovno ili se javite nastavniku.",
} as const;

// E-6 hero of the prototype (`hero()`): the eyebrow is the shared s.step ("Prije pisanja").