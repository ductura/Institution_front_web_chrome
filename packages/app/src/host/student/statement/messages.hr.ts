// Interface copy of the human-help statement and printout. The statement text itself is not
// here: it comes from the server (WEB-1503).
export const statementMessages = {
  title: "Izjava o ljudskoj pomoći",
  helpLegend: "Je li Vam netko pomagao pri pisanju?",
  helpKinds: {
    none: "Nitko mi nije pomagao",
    proofreading: "Lektura ili korektura",
    content: "Pomoć oko sadržaja",
    other: "Drugo",
  },
  helpText: "Opišite pomoć",
  save: "Spremi izjavu",
  saved: "Izjava o pomoći je spremljena na poslužitelju.",
  printoutTitle: "Ispis razgovora iz vanjskog alata",
  printoutNote: "Priložite ispis razgovora ako ste koristili alat izvan Ducture.",
  printoutLabel: "Datoteka s ispisom",
  attach: "Priloži ispis",
  attached: "Priloženo",
  readOnly: "Rad je predan. Izjava i prilog su samo za čitanje.",
  loading: "Učitavam izjavu.",
  unavailable: "Izjavu nije bilo moguće učitati. Pokušaj ponovno.",
  retry: "Pokušaj ponovno",
  failed: "Izjavu nije bilo moguće spremiti. Pokušaj ponovno.",
  rejected: "Poslužitelj nije prihvatio izjavu.",
  conflict: "Izjava se u međuvremenu promijenila. Učitana je verzija s poslužitelja; Vaš unos je zadržan, provjerite ga i spremite ponovno.",
  errors: {
    format: "Ovaj format nije dopušten. Dopušteni su: {formats}.",
    tooLarge: "Datoteka je prevelika. Najveća dopuštena veličina je {size}.",
    empty: "Datoteka je prazna.",
  },
} as const;

export function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toLocaleString("hr-HR", { maximumFractionDigits: 1 })} MB`;
}
