// N-07 "Prije predaje" and "zamjenski postupak" (WEB-2156, PARITET N-07 br. 16): interface text exactly as in the
// prototype (Ductura_nastavnik.html, beforePanel / receiptPanel "nedovrseno") and INVENTAR-nastavnik §3.8.
export const preSubmitMessages = {
  title: "Sažetak procesa (Prije predaje)",
  intro: "Popis pokazuje je li sve priloženo. Ne ocjenjuje rad.",
  loading: "Učitavam sažetak procesa s poslužitelja…",
  error: "Sažetak procesa trenutačno nije moguće učitati. Predaja i potvrda time nisu zahvaćene.",
  retry: "Pokušaj ponovno",
  placesHeading: "Mjesta za izvor koja je student ostavio u tekstu",
  // The server's summary does not carry the open source places: said as unavailable, never as "none" (B-6).
  placesUnavailable: "Popis mjesta za izvor trenutačno nije dostupan.",
  pastedHeading: "Zalijepljeno (izvor nije opažen)",
  pastedNone: (threshold: string): string => `Nema lijepljenja duljih od ${threshold}.`,
  formHeading: "Pravila oblika",
  formNotRun: "Provjera oblika još nije pokrenuta.",
  fullSummary: "Otvori puni sažetak procesa",
  fallbackTitle: "Predaja nije dovršena: zamjenski postupak",
  fallbackBody: (requestedAt: string): string =>
    "Predaja nije dovršena: tekst sastavljen iz zapisa ne podudara se s tekstom na poslužitelju. "
    + `Vrijeme zahtjeva studenta (${requestedAt}) je zabilježeno i ostaje vrijeme predaje. `
    + "Fakultet nastavlja predaju zamjenskim postupkom; student je upućen Vama.",
  // No server state for the fallback procedure exists yet (FPZG Q-3): "nedostupno", nothing invented.
  fallbackUnavailable: "Stanje zamjenskog postupka trenutačno nije dostupno.",
};
