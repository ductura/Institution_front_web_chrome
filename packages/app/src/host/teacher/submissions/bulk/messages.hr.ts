// Interface copy of the bulk download of submissions (WEB-1902; plan P-D2; WEB-2004; PIL-D2-ZIP).
export const bulkText = {
  title: "Skupno preuzimanje predaja",
  idle: "Predaje zadatka preuzimaju se u jednoj ZIP datoteci: za svakog studenta predani rad, potvrda i Izvještaj procesa. Poslužitelj daje poveznicu koja vrijedi ograničeno vrijeme.",
  formatLegend: "Oblik predanog rada",
  formatPdf: "PDF",
  formatDocx: "DOCX",
  action: "Preuzmi sve predaje",
  requesting: "Zahtjev se šalje…",
  ready: "Poveznica je spremna.",
  download: "Preuzmi ZIP datoteku",
  expiresAt: "Poveznica vrijedi do",
  started: "Preuzimanje je pokrenuto. Ako ne počne, zatraži novu poveznicu.",
  expired: "Poveznica je istekla. Zatraži novu.",
  requestAgain: "Zatraži novu poveznicu",
  notFound: "Zadatak nije pronađen.",
  forbidden: "Zahtjev nije prihvaćen. Osvježi stranicu i pokušaj ponovno.",
  requestUnknown: "Poveznicu trenutačno nije moguće dobiti. Pokušaj ponovno.",
} as const;
