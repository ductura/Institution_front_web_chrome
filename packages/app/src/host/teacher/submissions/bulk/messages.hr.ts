// Interface copy of the bulk download of submissions (WEB-1902; plan P-D2; WEB-2004).
export const bulkText = {
  title: "Skupno preuzimanje predaja",
  idle: "Predaje zadatka mogu se preuzeti u jednoj datoteci. Poslužitelj daje poveznicu koja vrijedi ograničeno vrijeme.",
  formatLegend: "Oblik datoteke",
  formatPdf: "PDF",
  formatDocx: "DOCX",
  action: "Preuzmi sve predaje",
  requesting: "Zahtjev se šalje…",
  ready: "Poveznica je spremna.",
  download: "Preuzmi datoteku",
  expiresAt: "Poveznica vrijedi do",
  expired: "Poveznica je istekla. Zatraži novu.",
  requestAgain: "Zatraži novu poveznicu",
  notFound: "Zadatak nije pronađen.",
  forbidden: "Predaje može preuzeti samo nastavnik zadatka.",
  requestUnknown: "Poveznicu trenutačno nije moguće dobiti. Pokušaj ponovno.",
} as const;
