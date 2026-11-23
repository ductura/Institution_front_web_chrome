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
} as const;
