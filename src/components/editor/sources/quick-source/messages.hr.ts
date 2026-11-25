// Texts of "Brzi izvor" as in the prototype (docs/prototip/editor/nf2.js, NF2-P7).
export const quickSourceHr = {
  heading: "Brzi izvor",
  identifier: "DOI, ISBN ili poveznica",
  hint: "Upišite DOI ili ISBN pa odaberite Dohvati podatke. Poslužitelju se šalje samo taj identifikator, ne tekst rada.",
  lookup: "Dohvati podatke",
  manual: "Unesi ručno",
  searching: "Dohvaćam podatke…",
  found: "Podaci su dohvaćeni. Provjerite ih prije spremanja.",
  invalid: "Upišite DOI (npr. 10.1234/…) ili ISBN.",
  notFound: "Izvor nije pronađen, unesite ga ručno.",
  unavailable: "Dohvat podataka trenutačno nije dostupan. Izvor možete unijeti ručno.",
  offline: "Dohvat traži vezu s mrežom. Izvor možete unijeti ručno.",
  failed: "Dohvat podataka nije uspio. Pokušajte ponovno ili unesite izvor ručno.",
} as const;
