import { ProvenanceShare, SHARE_CATEGORIES, type ProvenanceShareLabels, type ProvenanceShareState, type ShareRecord } from "@ductura/ui";
import type { ReactNode } from "react";

import type { CatalogState } from "./coverage";

// Provisional labels until the SRV-1220 contract proposal is approved.
const LABELS: ProvenanceShareLabels = {
  title: "Način unosa teksta",
  notice: "Prikazuje samo kako je tekst unesen. Ne pokazuje tko je autor teksta.",
  categories: {
    written: "napisano u Ducturi",
    ai_transferred: "preneseno iz AI pomoćnika",
    pasted: "zalijepljeno",
    imported: "uvezeno",
    unattributed: "bez zabilježenog načina unosa",
  },
  lessThanOne: "manje od 1 %",
  empty: "U predanoj verziji nema teksta.",
  textHeading: "Tekst predane verzije",
  matchLegend: "Označeno: podudara se s odgovorom AI pomoćnika.",
  noMarks: "U tekstu nema označenih dijelova.",
  loading: "Učitavam zapis o načinu unosa.",
  pending: "Zapis se još izračunava. Predaja je zaprimljena kao i inače.",
  none: "Za ovu predaju nema zapisa o načinu unosa.",
  disabled: "Zapis o načinu unosa nije uključen za ovaj zadatak.",
  error: "Zapis o načinu unosa trenutačno nije moguće prikazati.",
  retry: "Pokušaj ponovno",
};

const record = (points: number[], percents: number[]): ShareRecord => ({
  unit: "code_point",
  totalCodePoints: points.reduce((a, b) => a + b, 0),
  categories: SHARE_CATEGORIES.map((category, i) => ({ category, codePoints: points[i] ?? 0, percent: percents[i] ?? 0 })),
  notice: "not_authorship_evidence",
});

// Invented text. Numbers follow contract vector 9.1 (T = 365).
const READY: ProvenanceShareState = {
  kind: "ready",
  share: record([195, 64, 63, 34, 9], [53, 18, 17, 9, 3]),
  blocks: [
    { id: "b1", text: "Kućno kompostiranje smanjuje količinu otpada. Kompost nastaje razgradnjom organske tvari." },
    { id: "b2", text: "Proces obično traje nekoliko mjeseci." },
  ],
  aiMatch: {
    normalization: "ductura-match-norm-v1",
    minMatchCodePoints: 60,
    spans: [{ blockId: "b1", from: 46, to: 89 }],
    notice: "not_authorship_evidence",
  },
};

const view = (state: ProvenanceShareState) => <ProvenanceShare labels={LABELS} state={state} onRetry={() => undefined} />;

export const provenanceShareEntries = {
  ProvenanceShare: {
    prazno: () => (
      <div style={{ display: "grid", gap: 24 }}>
        {view({ kind: "none" })}
        {view({ kind: "ready", share: record([0, 0, 0, 0, 0], [0, 0, 0, 0, 0]), blocks: [] })}
      </div>
    ),
    učitavanje: () => view({ kind: "loading" }),
    greška: () => (
      <div style={{ display: "grid", gap: 24 }}>
        {view({ kind: "error" })}
        {view({ kind: "pending" })}
      </div>
    ),
    puno: () => view(READY),
    onemogućeno: () => view({ kind: "disabled" }),
  } satisfies Record<CatalogState, () => ReactNode>,
};
