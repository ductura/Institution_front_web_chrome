export const docxDownloadMessages = {
  button: "Preuzmi DOCX",
  loading: "Preuzimam DOCX…",
  noVersion: "Rad još nema spremljenu verziju.",
  versionLoading: "Dohvaćam spremljenu verziju…",
  versionUnavailable: "Spremljena verzija trenutačno nije dostupna.",
  savedVersion: (date: string) => `Spremljena verzija od ${date}`,
  fingerprint: (prefix: string) => `Otisak izvoza: ${prefix}…`,
  pdfSoon: "PDF — Uskoro",
  errors: {
    notFound: "Rad ili spremljena verzija nisu dostupni.",
    invalidRequest: "Zahtjev za izvoz nije valjan.",
    downloadFailed: "Preuzimanje rada nije uspjelo. Pokušajte ponovno.",
  },
} as const;
