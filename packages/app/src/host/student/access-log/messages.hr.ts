export const whoOpenedMessages = {
  title: "Tko je otvorio moj rad",
  note: "Ovdje vidite tko je i kada otvorio Vaš rad. Svaki redak je jedno otvaranje, vrijeme je zaokruženo na 5 minuta.",
  windowOf: (from: string, to: string): string => `${from}–${to}`,
  unknownReader: "Nepoznat čitatelj",
  loading: "Učitavam dnevnik pristupa…",
  empty: "Vaš rad još nitko nije otvorio.",
  unavailable: "Dnevnik pristupa trenutačno nije dostupan.",
  notFound: "Dnevnik pristupa nije dostupan ovom računu.",
  signedOut: "Sesija je istekla. Prijavite se ponovno.",
  older: "Prikaži starije dane",
  retry: "Pokušaj ponovno",
} as const;
