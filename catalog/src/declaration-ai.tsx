import { DeclarationAi, type DeclarationAiLabels, type DeclarationAiState, type DeclarationConversation } from "@ductura/ui";
import type { ReactNode } from "react";

import type { CatalogState } from "./coverage";

const LABELS: DeclarationAiLabels = {
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

const ASSISTANT = "Asistent · Primjer d.o.o., Model A";
const CONVERSATIONS: DeclarationConversation[] = [
  {
    conversationId: "catalog-c1",
    title: "Razgovor 1 · Lektura · 2. 11. 14:05",
    reason: "transfer",
    requiredBecause: "Tekst prenesen u rad, odlomak 2, „iz AI pomoćnika”.",
    assistantName: ASSISTANT,
    throughSeq: 2,
    messagesSha256: "1".repeat(64),
    turns: [
      { seq: 1, author: "student", text: "Možeš li lektorirati ovaj odlomak o izmišljenom primjeru?" },
      { seq: 2, author: "assistant", text: "Predlažem blaži poredak rečenica. Izmišljen primjer odgovora." },
    ],
  },
  {
    conversationId: "catalog-c2",
    title: "Razgovor 2 · Lektura · 2. 11. 15:32",
    reason: "transfer",
    requiredBecause: "Tekst prenesen u rad, odlomak 5, „iz AI pomoćnika”.",
    assistantName: ASSISTANT,
    throughSeq: 2,
    messagesSha256: "2".repeat(64),
    turns: [
      { seq: 1, author: "student", text: "Provjeri interpunkciju u ovom odlomku." },
      { seq: 2, author: "assistant", text: "Dodajte zarez prije veznika. Izmišljen primjer odgovora." },
    ],
  },
  {
    conversationId: "catalog-c3",
    title: "Razgovor 3 · Traženje literature · 3. 11. 09:48",
    reason: "student_added",
    assistantName: ASSISTANT,
    throughSeq: 2,
    messagesSha256: "3".repeat(64),
    turns: [
      { seq: 1, author: "student", text: "Koje vrste izvora bih mogao potražiti za izmišljenu temu?" },
      { seq: 2, author: "assistant", text: "Možete potražiti pregledne radove. Izmišljen primjer odgovora." },
    ],
  },
];

const READY: DeclarationAiState = {
  kind: "ready",
  uses: [
    { purpose: "Lektura", provider: "Primjer d.o.o., Model A", phase: "Pisanje" },
    { purpose: "Traženje literature", provider: "Primjer d.o.o., Model A", phase: "Planiranje" },
  ],
  conversations: CONVERSATIONS,
};
const STALE: DeclarationAiState = { ...READY, conversations: CONVERSATIONS.map((c, i) => (i === 1 ? { ...c, stale: true } : c)) };

const declaration = (state: DeclarationAiState) => (
  <DeclarationAi labels={LABELS} state={state} onConfirm={() => undefined} onRetry={() => undefined} />
);

export const declarationAiEntries = {
  DeclarationAi: {
    prazno: () => declaration({ kind: "no_use" }),
    učitavanje: () => declaration({ kind: "loading" }),
    greška: () => declaration({ kind: "error" }),
    puno: () => (
      <div style={{ display: "grid", gap: 24 }}>
        <div data-declaration="ready">{declaration(READY)}</div>
        <div data-declaration="stale">{declaration(STALE)}</div>
      </div>
    ),
    onemogućeno: () => declaration({ kind: "ai_disabled" }),
  } satisfies Record<CatalogState, () => ReactNode>,
};
