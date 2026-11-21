import { AdminAiCostLimits, type AdminAiCostLimitsLabels, type AdminAiCostLimitsState, type CostConfigVersion } from "@ductura/ui";
import { useState, type ReactNode } from "react";

import type { CatalogState } from "./coverage";

const LABELS: AdminAiCostLimitsLabels = {
  title: "Granice troška Asistenta",
  cap: (money) => `Strop operatera: ${money} dnevno. Granice studenata ne smiju biti veće.`,
  noCap: "Operater još nije objavio strop za ustanovu. Granice se mogu objaviti kad strop bude postavljen.",
  money: (eur) => `${eur} EUR`,
  fields: {
    studentDayMicro: "Dnevna granica po studentu",
    studentAssignmentDayMicro: "Dnevna granica po studentu i zadatku",
    reserveMicro: "Iznos rezervacije po zahtjevu",
  },
  amountHint: "Iznos u eurima, npr. 0,20.",
  invalid: "Upišite iznos veći od 0, s najviše šest decimala.",
  aboveCap: (cap) => `Granica ne smije biti veća od stropa operatera (${cap}). Upišite ${cap} ili manje.`,
  assignmentAboveDay: "Granica po zadatku ne smije biti veća od dnevne granice po studentu.",
  notConfigured: "Konfiguracija troška je prazna, pa je Asistent isključen za sve zadatke. Studenti vide samo da Asistent nije dostupan.",
  review: "Pregledaj prije objave",
  previewTitle: "Pregled nove verzije",
  previewNote: "Nova verzija vrijedi od objave. Prethodne verzije ostaju u povijesti i ne mijenjaju se.",
  current: "Sada",
  notSet: "nije postavljeno",
  publish: "Objavi novu verziju",
  back: "Natrag na uređivanje",
  publishing: "Objava je u tijeku.",
  published: (n) => `Verzija ${String(n)} je objavljena.`,
  serverAboveCap: "Objava je odbijena: granica je veća od stropa operatera. Ništa nije objavljeno; prethodna verzija ostaje na snazi.",
  publishFailed: "Objava nije uspjela. Ništa nije promijenjeno; pokušajte ponovno.",
  spentTitle: "Potrošnja ustanove",
  spent: (money) => `${money} u tekućem razdoblju stropa`,
  spentNote: "Zbroj za cijelu ustanovu. Potrošnja pojedinih studenata se ne prikazuje.",
  historyTitle: "Povijest verzija",
  historyEmpty: "Još nije objavljena nijedna verzija.",
  version: (n, at) => `Verzija ${String(n)} · ${at}`,
  loading: "Granice troška se učitavaju.",
  loadFailed: "Granice troška nije bilo moguće učitati. Ništa nije promijenjeno.",
  retry: "Pokušaj ponovno",
};

/** Invented versions, dates and amounts (micro-euros). */
const VERSIONS: CostConfigVersion[] = [
  { versionNo: 1, publishedAt: "3. 9. 2026.", studentDayMicro: "1000000", studentAssignmentDayMicro: "500000", reserveMicro: "200000" },
  { versionNo: 2, publishedAt: "14. 10. 2026.", studentDayMicro: "2000000", studentAssignmentDayMicro: "1000000", reserveMicro: "200000" },
  { versionNo: 3, publishedAt: "2. 11. 2026.", studentDayMicro: "4000000", studentAssignmentDayMicro: "2000000", reserveMicro: "200000" },
];
const CAP = "50000000";
const SPENT = "18420000";

/** Publishing only appends a version locally; the real parent calls the publish RPC. */
function Example({ versions = VERSIONS, capMicro = CAP, publishError }: { versions?: CostConfigVersion[]; capMicro?: string | null; publishError?: "limit_above_cap" | "failed" }) {
  const [list, setList] = useState(versions);
  const state: AdminAiCostLimitsState = { kind: "ready", capMicro, spentMicro: SPENT, versions: list };
  return (
    <AdminAiCostLimits
      labels={LABELS}
      state={state}
      publishError={publishError}
      onPublish={(limits) => setList((old) => [...old, { versionNo: old.length + 1, publishedAt: "21. 11. 2026.", ...limits }])}
    />
  );
}

export const adminAiCostLimitsEntries = {
  AdminAiCostLimits: {
    prazno: () => <Example versions={[]} />,
    učitavanje: () => <AdminAiCostLimits labels={LABELS} state={{ kind: "loading" }} onPublish={() => undefined} />,
    greška: () => (
      <>
        <AdminAiCostLimits labels={LABELS} state={{ kind: "load_failed" }} onPublish={() => undefined} onRetry={() => undefined} />
        <Example publishError="failed" />
      </>
    ),
    puno: () => <Example />,
    onemogućeno: () => <Example capMicro={null} />,
  } satisfies Record<CatalogState, () => ReactNode>,
};
