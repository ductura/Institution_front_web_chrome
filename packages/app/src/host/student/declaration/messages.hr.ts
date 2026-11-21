import type { DeclarationAiLabels } from "@ductura/ui";

// Same copy as the catalogue entry (catalog/src/declaration-ai.tsx).
export const declarationLabels: DeclarationAiLabels = {
  title: "Izjava o uporabi AI-ja",
  noUse: "U ovom radu nije zabilježena uporaba Asistenta. Ništa se ne prilaže automatski.",
  aiDisabled: "Zadatak ne dopušta ugrađenog Asistenta. Izjavu ipak potvrđujete.",
  loading: "Sastavljam izjavu iz zapisa.",
  error: "Izjavu nije bilo moguće sastaviti. Ništa nije predano.",
  errorNote: "Tehnička greška ne sprječava predaju. Izjava se dopuni kad sastavljanje bude moguće.",
  retry: "Pokušaj ponovno",
  usesCaption: "Zapisana uporaba",
  colPurpose: "Svrha",
  colProvider: "Pružatelj i model",
  colPhase: "Faza",
  requiredHeading: "Prilaže se obvezno",
  requiredNote: "Ovi razgovori se ne mogu izostaviti jer je iz njih tekst prenesen u rad. Ostaju obvezni i ako preneseni tekst kasnije obrišete.",
  othersLegend: "Ostali razgovori",
  othersNote: "Ostali razgovori su Vaši dok pišete. Nastavnik ih vidi samo ako ih priložite.",
  review: "Pregledaj točne verzije razgovora koji se prilažu",
  reviewFirst: "Potvrda je dostupna nakon što otvorite pregled točnih verzija razgovora koji se prilažu. Ako promijenite odabir, pregled se ponovno traži.",
  reviewTitle: "Razgovori uz izjavu",
  reviewNote: "Ovo su točne verzije svih razgovora koji ulaze uz izjavu, onakve kakve će ih nastavnik vidjeti.",
  reviewDone: "Gotov pregled, natrag na izjavu",
  requiredTag: "obvezan",
  chosenTag: "po Vašem odabiru",
  chosenFoot: "Nije preneseno u rad. Prilaže se Vašim odabirom.",
  student: "Vi",
  stale: "Razgovor se promijenio, pregledaj ponovno.",
  confirm: "Potvrdi izjavu",
};

export const declarationStatus = {
  confirming: "Šaljem potvrdu izjave…",
  confirmed: "Izjava je potvrđena.",
  stale: "Razgovor se promijenio nakon pregleda. Učitane su nove verzije, pregledaj ponovno.",
  failed: "Izjavu nije bilo moguće potvrditi. Pokušaj ponovno.",
};
