// WEB-V14-SHEET-SUBMIT: Croatian text of the sheet summary. Counts only; no word of the PRODUCT §5 vocabulary.
export const sheetSummaryText = {
  title: "Tablica",
  kind: "Vrsta rada: tablica",
  loading: "Čitam tablicu…",
  unavailable: "Sažetak tablice trenutačno nije dostupan.",
  retry: "Pokušaj ponovno",
  empty: "Tablica je još prazna.",
  sheets: { one: "{n} list", few: "{n} lista", many: "{n} listova" },
  cells: { one: "{n} ispunjena ćelija", few: "{n} ispunjene ćelije", many: "{n} ispunjenih ćelija" },
  formulas: { one: "{n} formula", few: "{n} formule", many: "{n} formula" },
  meta: "Brojevi opisuju predani sadržaj; ne ocjenjuju ga.",
} as const;
