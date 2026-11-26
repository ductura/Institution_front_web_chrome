export const messagesHr = {
  overview: "Pregled ustanove trenutačno nije dostupan.",
  users: "Popis korisnika i uloga trenutačno nije dostupan.",
  courses: "Popis kolegija i akademskih godina trenutačno nije dostupan.",
  rules: "Prikaz pravila fakulteta trenutačno nije dostupan.",
} as const;

/** LOK-WEB-8: the text of the three screens that the shared catalogue has no key for. */
export const institutionHostMessages = {
  loading: "Učitavanje…",
  signedOut: "Prijava je istekla. Prijavite se ponovno.",
  denied: "Ovaj prikaz namijenjen je administratorima ustanove.",
  coursesNote: "Kolegiji najnovije akademske godine ({year}).",
  studentsNote: "Upisi u kolegije najnovije akademske godine; student upisan u dva kolegija broji se dvaput.",
  noYear: "Ustanova još nema akademskih godina.",
  yearPick: "Akademska godina",

  student: {
    heading: "Uklanjanje i povratak studenta",
    lead: "Student se uklanja iz kolegija ili mu se dopušta povratak u njega. Upišite identifikator studenta.",
    field: "Identifikator studenta",
    hint: "Identifikator je u zapisu iz kojeg dolazi zahtjev; imena studenata ovdje se ne prikazuju.",
    remove: "Ukloni iz kolegija",
    allowReturn: "Dopusti povratak",
    cancel: "Odustani",
    close: "Zatvori",
    removeTitle: "Ukloniti studenta iz kolegija?",
    returnTitle: "Dopustiti studentu povratak u kolegij?",
    removeNote: "Student više neće biti upisan u ovaj kolegij.",
    returnNote: "Student se može ponovno upisati u ovaj kolegij.",
    invalidId: "Identifikator studenta nije ispravan.",
    outcome: {
      removed: "Student je uklonjen iz kolegija.",
      returnAllowed: "Povratak studenta je dopušten.",
      notRemoved: "Student nije bio upisan u ovaj kolegij; ništa nije promijenjeno.",
      notAllowed: "Ništa nije promijenjeno.",
      ended: "Prijava je istekla ili nemate pravo na ovu radnju.",
      invalid: "Zahtjev nije prihvaćen. Provjerite identifikator.",
      unknown: "Ne znamo je li se promjena dogodila. Osvježite prikaz i provjerite stanje.",
    },
    directEnrolment: "Izravni upis studenta nije dostupan. Student se upisuje kodom kolegija.",
  },
} as const;

/** F4-OPE-R04 (OPE-20): the groups of a course, made and given a teacher by the administrator. */
export const courseGroupMessages = {
  newGroupHeading: "Nova grupa kolegija",
  nameLabel: "Naziv grupe",
  nameHint: "Najviše 80 znakova.",
  create: "Izradi grupu",
  assignLabel: "Nastavnik grupe",
  assignPlaceholder: "Odaberite potvrđenog nastavnika",
  assign: "Dodijeli nastavnika",
  noTeachers: "Nema potvrđenih nastavnika koje bi se moglo dodijeliti.",
  teachersUnavailable: "Popis potvrđenih nastavnika trenutačno nije dostupan, pa se nastavnik grupe ne može dodijeliti.",
  created: "Grupa je izrađena.",
  assigned: "Nastavnik je dodijeljen grupi.",
  invalid: "Unos nije prihvaćen. Naziv grupe mora imati 1 do 80 znakova, bez razmaka na početku i na kraju.",
  ended: "Prijava je istekla ili nemate pristup. Prijavite se ponovno.",
  unknown: "Nije potvrđeno je li promjena spremljena. Provjerite stanje popisa.",
  check: "Provjeri stanje",
} as const;
