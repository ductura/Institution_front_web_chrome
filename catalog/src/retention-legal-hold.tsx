import type { ReactNode } from "react";
import { LegalHolds, RetentionClasses, type LegalHold, type LegalHoldsLabels, type RetentionClassesLabels } from "@ductura/ui";

import type { CatalogState } from "./coverage";

const CLASS_LABELS: RetentionClassesLabels = {
  title: "Klase podataka", lead: "Ovdje se podaci samo prikazuju; nijedna radnja brisanja nije dostupna.", caption: "Klase podataka, rokovi i način čuvanja",
  colClass: "Klasa", colPeriod: "Rok", colMode: "Način", periodUndecided: "Rok još nije određen", period: (d) => `${String(d)} dana`,
  modes: { dry_run: "Probni prolaz", delete: "Briše se" }, empty: "Nema klasa podataka za prikaz.", loading: "Učitavanje klasa podataka…", retry: "Pokušaj ponovno",
};
const HOLD_LABELS: LegalHoldsLabels = {
  title: "Pravna zadržavanja", lead: "Pravno zadržavanje zaustavlja brisanje podataka na koje se odnosi.", listTitle: "Aktivna zadržavanja",
  empty: "Nema aktivnih pravnih zadržavanja.", loading: "Učitavanje zadržavanja…", retry: "Pokušaj ponovno",
  placedBy: (n, a) => `Postavio/la: ${n}, ${a}`, reference: (r) => `Referenca slučaja: ${r}`, placeTitle: "Postavi zadržavanje",
  subject: "Predmet", subjectHint: "Na što se zadržavanje odnosi.", caseReference: "Referenca slučaja", caseReferenceHint: "Broj ili oznaka slučaja.",
  subjectMissing: "Upišite predmet zadržavanja.", caseReferenceMissing: "Upišite referencu slučaja.", place: "Postavi zadržavanje", placing: "Postavljam…",
  release: "Skini zadržavanje", releaseOwn: "Zadržavanje koje ste sami postavili skida drugi administrator ili operater.",
  releaseTitle: (s) => `Skidanje zadržavanja: ${s}`, reason: "Razlog skidanja", reasonHint: "Razlog se upisuje u zapis.", reasonMissing: "Upišite razlog skidanja.",
  confirmRelease: "Skini zadržavanje", releasing: "Skidam…", cancel: "Odustani",
};
const HOLDS: LegalHold[] = [
  { id: "b1301000-0000-4000-8000-000000000001", subject: "Izmišljeni kolegij za test", caseReference: "IZM-2026-001", placedAt: "20. 11. 2026.", placedByName: "Ana Izmišljena", own: true },
  { id: "b1301000-0000-4000-8000-000000000002", subject: "Drugi izmišljeni predmet", caseReference: "IZM-2026-002", placedAt: "21. 11. 2026.", placedByName: "Ivan Izmišljeni", own: false },
];
const none = () => undefined;
const FORBIDDEN = "Čuvanje podataka i pravna zadržavanja vidi i mijenja samo administrator ustanove.";

export const retentionLegalHoldEntries = {
  RetentionClasses: {
    prazno: () => <RetentionClasses labels={CLASS_LABELS} state={{ kind: "ready", classes: [] }} />,
    učitavanje: () => <RetentionClasses labels={CLASS_LABELS} state={{ kind: "loading" }} />,
    greška: () => <RetentionClasses labels={CLASS_LABELS} state={{ kind: "error", message: FORBIDDEN }} onRetry={none} />,
    puno: () => (
      <RetentionClasses labels={CLASS_LABELS} state={{ kind: "ready", classes: [
        { classId: "DATA-CLASS-01", name: "Izmišljeni radni tekst", retentionDays: 365, mode: "delete" },
        { classId: "DATA-CLASS-02", name: "Izmišljeni zapis pristupa", retentionDays: null, mode: "dry_run" },
      ] }} />
    ),
    onemogućeno: () => <RetentionClasses labels={CLASS_LABELS} state={{ kind: "ready", classes: [{ classId: "DATA-CLASS-02", name: "Izmišljeni zapis pristupa", retentionDays: null, mode: "dry_run" }] }} />,
  } satisfies Record<CatalogState, () => ReactNode>,
  LegalHolds: {
    prazno: () => <LegalHolds labels={HOLD_LABELS} state={{ kind: "ready", holds: [] }} onPlace={none} onRelease={none} />,
    učitavanje: () => <LegalHolds labels={HOLD_LABELS} state={{ kind: "loading" }} onPlace={none} onRelease={none} />,
    greška: () => <LegalHolds labels={HOLD_LABELS} state={{ kind: "error", message: FORBIDDEN }} onPlace={none} onRelease={none} onRetry={none} actionError={FORBIDDEN} />,
    puno: () => <LegalHolds labels={HOLD_LABELS} state={{ kind: "ready", holds: HOLDS }} onPlace={none} onRelease={none} />,
    onemogućeno: () => <LegalHolds labels={HOLD_LABELS} state={{ kind: "ready", holds: [HOLDS[0]!] }} onPlace={none} onRelease={none} busy />,
  } satisfies Record<CatalogState, () => ReactNode>,
};
