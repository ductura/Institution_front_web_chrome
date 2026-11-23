import {
  ProvenanceShare, RhythmView, SHARE_CATEGORIES,
  type ProvenanceShareLabels, type ProvenanceShareState, type RhythmBurst, type RhythmViewLabels, type RhythmViewState, type ShareRecord,
} from "@ductura/ui";
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

const RHYTHM_LABELS: RhythmViewLabels = {
  title: "Ritam unosa",
  notice: "Prikazuje samo kako je tekst unesen. Ne pokazuje tko je autor teksta.",
  off: "Bilježenje ritma isključeno je za ovaj zadatak.",
  empty: "Nema zabilježenih naleta tipkanja.",
  burst: "Nalet {n}",
  duration: "trajanje",
  chars: "znakova",
  longestPause: "najdulja stanka",
  seconds: "s",
  graph: "Razmaci između unosa u naletu {n}",
  loading: "Učitavam ritam unosa.",
  none: "Za ovu predaju nema zapisa ritma.",
  error: "Ritam unosa trenutačno nije moguće prikazati.",
};

// Invented gaps between inputs (ms) of two bursts.
const gaps = (seed: number, n: number, pauseAt: number[]) =>
  Array.from({ length: n }, (_, i) => (pauseAt.includes(i) ? 1400 + seed * 100 : 90 + ((i * 37 + seed * 11) % 160)));
const burst = (intervalsMs: number[]): RhythmBurst => ({
  durationMs: intervalsMs.reduce((a, b) => a + b, 0),
  chars: intervalsMs.length + 1,
  longestPauseMs: Math.max(...intervalsMs),
  intervalsMs,
});
const BURSTS = [burst(gaps(1, 64, [20, 41])), burst(gaps(2, 38, [12]))];

const rhythm = (state: RhythmViewState) => <RhythmView labels={RHYTHM_LABELS} state={state} />;

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
  // P-1 rhythm of input (PRIJEDLOG): invented bursts, provisional labels; demo only until the legal opinion (N-3).
  RhythmView: {
    prazno: () => (
      <div style={{ display: "grid", gap: 24 }}>
        {rhythm({ kind: "none" })}
        {rhythm({ kind: "ready", rhythm: { recorded: true, bursts: [], notice: "not_authorship_evidence" } })}
      </div>
    ),
    učitavanje: () => rhythm({ kind: "loading" }),
    greška: () => rhythm({ kind: "error" }),
    puno: () => rhythm({ kind: "ready", rhythm: { recorded: true, bursts: BURSTS, notice: "not_authorship_evidence" } }),
    onemogućeno: () => rhythm({ kind: "ready", rhythm: { recorded: false, bursts: [], notice: "not_authorship_evidence" } }),
  } satisfies Record<CatalogState, () => ReactNode>,
};
