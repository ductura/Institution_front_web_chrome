// Interface copy of the read-only view of a submitted v4 document (WEB-V21-STEM-NASTAVNIK-PRIKAZ).
export const v4ViewMessages = {
  formulaInvalid: "Formulu nije moguće prikazati; prikazan je izvorni zapis.",
  formulaLabel: "Formula",
  codeLabel: "Blok koda",
  codeNoLanguage: "bez jezika",
  codeRunNote: "Kod se ovdje ne izvršava.",
  boxKinds: {
    definition: "Definicija", theorem: "Teorem", lemma: "Lema", corollary: "Korolar",
    example: "Primjer", remark: "Napomena", proof: "Dokaz",
  },
  tableLabel: "Tablica",
  imageLabel: "Slika",
  imagePlaceholder: "Slika se u ovom pregledu ne učitava.",
  source: "Izvor",
  citation: "[navod]",
  footnote: "[bilješka]",
  crossReference: "[upućivanje]",
  pageBreak: "Prijelom stranice",
} as const;
