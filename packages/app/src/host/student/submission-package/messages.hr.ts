export const submissionPackageText = {
  title: "Paket za referadu",
  lead: "Paket sadrži predani rad i potvrdu predaje, za ustanovu koja ga traži.",
  start: "Preuzmi paket za referadu",
  requesting: "Zahtjev se šalje…",
  ready: "Poveznica je spremna.",
  download: "Preuzmi paket",
  expiresAt: "Poveznica vrijedi do",
  expired: "Poveznica je istekla. Zatražite novu.",
  requestAgain: "Zatraži novu poveznicu",
  notFound: "Predaja nije pronađena.",
  unknown: "Poveznicu trenutačno nije moguće dobiti. Pokušajte ponovno.",
} as const;

/** The same card for the verifiable package (kind "package"), as the portfolio export offers it (WEB-1807). */
export const portablePackageText = {
  ...submissionPackageText,
  title: "Prenosivi zapis",
  lead: "Paket se preuzima kao jedna ZIP datoteka.",
  start: "Preuzmi provjerljivi paket",
} as const;
