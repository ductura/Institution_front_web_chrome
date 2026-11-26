import type { AnalysisCatalogue } from "../api/read";

export type AnalysisId = AnalysisCatalogue["analyses"][number]["id"];

/** Titles and notes of the analyses; the catalogue gives only ids, versions and variable rules (contract §3.2). */
export const analysisTitles: Readonly<Record<AnalysisId, { title: string; note: string }>> = {
  descriptive: { title: "Opisna statistika", note: "Broj, srednja vrijednost, standardna devijacija, medijan i kvartili za brojčane stupce." },
  frequencies: { title: "Tablica učestalosti", note: "Koliko se puta pojavljuje svaka vrijednost odabranih stupaca." },
  correlation: { title: "Korelacija", note: "Pearsonov koeficijent za svaki par odabranih brojčanih stupaca." },
};

export const chooseMessages = {
  heading: "Odabir analize",
  analysis: "Analiza",
  analysisPlaceholder: "Odaberite analizu…",
  variables: "Stupci za analizu",
  variablesHint: "Nude se samo stupci vrste koju analiza prima.",
  numeric: "brojčani",
  category: "kategorija",
  noEligible: "Skup nema nijedan stupac koji ova analiza prima.",
  submit: "Izračunaj",
  /** Reasons the submit button is off. */
  reasons: {
    noAnalysis: "Odaberite analizu.",
    noRows: "Skup nema nijedan redak.",
    tooFew: "Odaberite barem {min} stupca ({count} odabrano).",
    tooMany: "Odaberite najviše {max} stupaca ({count} odabrano).",
    unknownColumn: "Odabrani stupac ne postoji u skupu.",
    wrongKind: "Stupac “{name}” nije vrste koju analiza prima.",
    duplicate: "Isti stupac ne može se odabrati dvaput.",
    limits: "Skup prelazi ograničenja koja poslužitelj prima.",
    unknownAnalysis: "Ova analiza nije u katalogu.",
  },
} as const;
