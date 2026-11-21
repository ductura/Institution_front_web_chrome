import { AssistantBudget, type AssistantBudgetLabels, type AssistantBudgetState } from "@ductura/ui";
import type { ReactNode } from "react";

import type { CatalogState } from "./coverage";

const LABELS: AssistantBudgetLabels = {
  assignmentToday: "Danas na ovom zadatku",
  allToday: "Danas na svim zadacima",
  smallerPart: "Manji dio granice",
  largerPart: "Veći dio granice",
  usedUp: "Granica iskorištena",
  barSmaller: "Iskorišten manji dio današnje granice",
  barLarger: "Iskorišten veći dio današnje granice",
  barFull: "Današnja granica je iskorištena",
  resets: "Brojač se vraća na nulu sutra. Odnosi se samo na Vas i ovaj zadatak.",
  near: "Većina današnje granice je iskorištena. Sljedeći zahtjev može biti odbijen, ovisno o njegovoj duljini.",
  assignmentReached: "Za ovaj zadatak danas ste iskoristili granicu. Sutra se brojač vraća na nulu. Pisanje i predaja rade bez ograničenja.",
  dayReached: "Danas ste iskoristili granicu na svim zadacima. Dnevna granica se sutra obnavlja; dostupnost Asistenta ovisi i o drugim granicama.",
  serviceReached: "Asistent je trenutačno privremeno nedostupan svima. Nije do Vas i ništa se ne naplaćuje. Pokušajte kasnije.",
  serviceNote: "Pisanje i predaja ne ovise o Asistentu.",
  disabled: "Asistent na ovom zadatku nije uključen. Pisanje i predaja rade kao i inače.",
  loading: "Brojač se učitava. Slanje se provjerava na poslužitelju.",
  send: "Pošalji Asistentu",
};

/** Invented amounts in micro-euros; real limits are set by the owner and checked on the server. */
const FULL: readonly AssistantBudgetState[] = [
  { kind: "usage", usedMicro: "40000", limitMicro: "200000" },
  { kind: "usage", usedMicro: "180000", limitMicro: "200000" },
  { kind: "usage", usedMicro: "200000", limitMicro: "200000" },
  { kind: "budget_exceeded", scope: "day" },
];

const budget = (state: AssistantBudgetState) => <AssistantBudget labels={LABELS} state={state} />;

export const assistantBudgetEntries = {
  AssistantBudget: {
    prazno: () => budget({ kind: "usage", usedMicro: "0", limitMicro: "200000" }),
    učitavanje: () => budget({ kind: "loading" }),
    greška: () => budget({ kind: "budget_exceeded", scope: "service" }),
    puno: () => <div style={{ display: "grid", gap: 16 }}>{FULL.map((state, i) => <div key={i} data-budget-state={i + 1}>{budget(state)}</div>)}</div>,
    onemogućeno: () => budget({ kind: "ai_disabled" }),
  } satisfies Record<CatalogState, () => ReactNode>,
};
