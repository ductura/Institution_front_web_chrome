export const docxDownloadMessages = {
  button: "Preuzmi DOCX",
  loading: "Preuzimam DOCX…",
  noVersion: "Rad još nema verziju na poslužitelju.",
  versionLoading: "Dohvaćam verziju s poslužitelja…",
  versionUnavailable: "Verzija na poslužitelju trenutačno nije dostupna.",
  savedVersion: (date: string) => `Verzija na poslužitelju od ${date}`,
  fingerprint: (prefix: string) => `Otisak izvoza: ${prefix}…`,
  pdfSoon: "PDF — Uskoro",
  errors: {
    notFound: "Rad ili verzija na poslužitelju nisu dostupni.",
    invalidRequest: "Zahtjev za izvoz nije valjan.",
    downloadFailed: "Preuzimanje rada nije uspjelo. Pokušajte ponovno.",
  },
} as const;
