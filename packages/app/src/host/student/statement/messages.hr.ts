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
  attachSent: "Ispis je poslan na poslužitelj. Priložit će se izjavi kad je spremite ili potvrdite.",
  readOnly: "Rad je predan. Izjava i prilog su samo za čitanje.",
  loading: "Učitavam izjavu.",
  unavailable: "Izjavu nije bilo moguće učitati. Pokušaj ponovno.",
  retry: "Pokušaj ponovno",
  failed: "Izjavu nije bilo moguće spremiti. Pokušaj ponovno.",
  rejected: "Poslužitelj nije prihvatio izjavu.",
  conflict: "Izjava se u međuvremenu promijenila. Učitana je verzija s poslužitelja; Vaš unos je zadržan, provjerite ga i spremite ponovno.",
  // ED-12 (NF2-P12, prototype nf2decl): the tools outside Ductura.
  tools: {
    title: "Vanjski alati",
    note: "Navedite alate koje ste koristili izvan Ducture. Razgovori s Asistentom bilježe se sami.",
    none: "Niste naveli nijedan vanjski alat.",
    row: "Alat {n}",
    tool: "Alat",
    purpose: "Svrha",
    phase: "Faza rada",
    add: "Dodaj alat",
    remove: "Ukloni alat {n}",
    save: "Spremi popis alata",
    saved: "Popis alata je spremljen na poslužitelju.",
    incomplete: "Za svaki alat upišite alat, svrhu i fazu rada.",
    tooLong: "Polje je predugo. Najviše {max} znakova.",
    tooMany: "Najviše {max} alata.",
  },
  // NF-3 PR-20 (E-9): the teacher's question beside the declaration and the student's answer.
  question: {
    title: "Pitanje nastavnika",
    answer: "Odgovor (nije obavezan)",
    hint: "Odgovor vidi nastavnik uz izjavu. Do {max} znakova.",
    save: "Spremi odgovor",
    remove: "Ukloni odgovor",
    saved: "Odgovor je spremljen na poslužitelju.",
    removed: "Odgovor je uklonjen.",
    tooLong: "Odgovor je predug. Najviše {max} znakova.",
    badCharacter: "Odgovor sadrži znak koji se ne može spremiti. Uklonite ga i pokušajte ponovno.",
    noAnswer: "Niste odgovorili na pitanje.",
    readOnly: "Rad je predan. Odgovor je samo za čitanje.",
  },
  errors: {
    format: "Ovaj format nije dopušten. Dopušteni su: {formats}.",
    tooLarge: "Datoteka je prevelika. Najveća dopuštena veličina je {size}.",
    empty: "Datoteka je prazna.",
  },
} as const;

export function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toLocaleString("hr-HR", { maximumFractionDigits: 1 })} MB`;
}
