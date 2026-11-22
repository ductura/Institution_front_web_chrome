export const portfolioText = {
  title: "Izvoz za portfelj",
  lead: "Ovdje možete izvesti svoje predane radove za portfelj: PDF i provjerljivi paket. Izvoz je dostupan i nakon završetka kolegija, dok traje čuvanje.",
  loading: "Učitavam predane radove…",
  empty: "Još nemate predanih radova. Izvoz je moguć tek nakon predaje.",
  unavailable: "Popis predanih radova trenutačno nije dostupan.",
  signedOut: "Sesija je istekla. Prijavite se ponovno.",
  retry: "Pokušaj ponovno",
  submittedOn: (date: string) => `Predano ${date}`,
  courseEnded: "Kolegij je završio. Izvoz je dostupan dok traje čuvanje.",
  pdfHeading: "PDF predane verzije",
  packageHeading: "Provjerljivi paket",
  packageLead: "Jedna datoteka koju možete čuvati sami i provjeriti bez prijave.",
} as const;
