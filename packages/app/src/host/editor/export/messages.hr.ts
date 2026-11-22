export const pdfExportText = {
  start: "Preuzmi PDF",
  loading: "Pripremam PDF…",
  retry: "Pokušaj ponovno",
  done: "PDF je preuzet.",
  notFound: "Rad nije pronađen ili još nema verziju spremljenu na poslužitelju.",
  forbidden: "Nemate pristup ovom radu.",
  unavailable: "PDF trenutačno nije dostupan. Pokušajte ponovno.",
  mismatch: "Primljena datoteka ne odgovara otisku koji je dao poslužitelj, pa nije preuzeta.",
  plain: "Ovo je obični PDF, nije u formatu PDF/A.",
  pdfA: "PDF/A",
  pdfAExplain: "Poslužitelj je potvrdio da je ova datoteka u formatu PDF/A.",
  fingerprint: (prefix: string) => `Otisak PDF-a: ${prefix}…`,
} as const;
