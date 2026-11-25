// WEB-V22-ISVU-MODEL: interface text for the trial ISVU source (invented data only, nothing is connected to a real ISVU).
export const isvuImportMessages = {
  title: "Povezivanje s ISVU-om (probni izvor)",
  trialNotice: "Probni izvor, izmišljeni podaci; nije povezano sa stvarnim ISVU-om.",
  status: {
    new: "Novi student",
    already_enrolled: "Već upisan",
    unsuitable: "Neodgovarajući redak",
  },
  reason: {
    invalid_identifier: "Identifikator nije valjan.",
    missing_name: "Nedostaje ime ili prezime.",
    duplicate: "Redak se ponavlja u popisu.",
    unknown_account: "Student se još nije prijavio kroz AAI@EduHr, pa račun ne postoji.",
    ineligible_account: "Račun nije studentski račun.",
    name_mismatch: "Ime u popisu ne odgovara imenu računa.",
    removed: "Student je uklonjen s kolegija.",
    course_teacher: "Osoba je nastavnik ovog kolegija.",
  },
  unknownReason: "Redak nije prihvaćen.",
  counts: {
    new: (n: number): string => `Novi: ${n}`,
    already_enrolled: (n: number): string => `Već upisani: ${n}`,
    unsuitable: (n: number): string => `Neodgovarajući: ${n}`,
    total: (n: number): string => `Ukupno redaka: ${n}`,
  },
  disabled: "Izvor nije uključen za ovu ustanovu.",
  expired: "Pregled je istekao. Napravite novi pregled.",
  loading: "Učitavanje…",
  readError: "Čitanje nije uspjelo. Pokušajte ponovno.",
  empty: "Probni izvor nema kolegija.",
} as const;
