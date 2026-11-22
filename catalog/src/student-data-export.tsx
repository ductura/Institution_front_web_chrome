import {
  StudentDataDownload, StudentDataExportList, StudentDataExportRequest,
  type ExportRow, type StudentDataDownloadLabels, type StudentDataExportLabels,
} from "@ductura/ui";
import type { ReactNode } from "react";

import type { CatalogState } from "./coverage";

// WEB-1302: the app's own texts (packages/app host/institution/student-data-export/messages.hr), repeated here for the catalogue.
const LABELS: StudentDataExportLabels = {
  requestTitle: "Zahtjev za izvoz podataka studenta",
  requestLead: "Referada predaje zahtjev nakon što je provjerila identitet studenta. Izvoz pokreće administrator ustanove.",
  studentId: "Oznaka studenta",
  studentIdHint: "Oznaka studenta iz popisa korisnika ustanove.",
  studentIdMissing: "Upišite valjanu oznaku studenta.",
  identityDocument: "Isprava kojom je provjeren identitet",
  identityDocumentPick: "Odaberite ispravu",
  identityDocumentMissing: "Odaberite ispravu kojom je provjeren identitet.",
  documents: { identity_card: "Osobna iskaznica", passport: "Putovnica", student_card: "Studentska iskaznica" },
  identityConfirmed: "Provjerio/la sam identitet studenta uživo",
  identityNotConfirmed: "Potvrdite da je identitet studenta provjeren.",
  note: "Oznaka provjere",
  noteHint: "Do 80 znakova, npr. broj spisa referade. Ne upisujte broj isprave.",
  noteMissing: "Upišite oznaku provjere.",
  request: "Pošalji zahtjev",
  requesting: "Šaljem zahtjev…",
  listTitle: "Zahtjevi za izvoz podataka",
  listLead: "Izvoz se pokreće tek kad ga odobrite. Student dobiva poveznicu koja vrijedi jednom.",
  empty: "Nema zahtjeva za izvoz.",
  loading: "Učitavanje zahtjeva…",
  retry: "Pokušaj ponovno",
  states: { requested: "Zatražen", approved: "Odobren", ready: "Spreman", downloaded: "Preuzet", expired: "Istekao" },
  requestedAt: (at) => `Zatraženo: ${at}`,
  expiresAt: (at) => `Poveznica vrijedi do: ${at}`,
  approve: "Pokreni izvoz",
  approveTitle: "Pokretanje izvoza",
  reference: "Urudžbeni broj",
  referenceHint: "Upisuje se u zapis o izvozu.",
  referenceMissing: "Upišite urudžbeni broj.",
  approving: "Pokrećem izvoz…",
  cancel: "Odustani",
};

const DOWNLOAD: StudentDataDownloadLabels = {
  title: "Izvoz mojih podataka",
  lead: "Poveznica vrijedi samo jednom. Datoteku spremite na sigurno mjesto.",
  download: "Preuzmi izvoz",
  downloading: "Preuzimam izvoz…",
  done: "Izvoz je preuzet. Poveznica više ne vrijedi.",
  gone: "Poveznica je već iskorištena ili je istekla. Za novi izvoz javite se referadi.",
};

const ROWS: readonly ExportRow[] = [
  { exportId: "e1302000-0000-4000-8000-000000000001", state: "requested", requestedAt: "21. 11. 2026. 10:00", expiresAt: null },
  { exportId: "e1302000-0000-4000-8000-000000000002", state: "ready", requestedAt: "20. 11. 2026. 9:30", expiresAt: "27. 11. 2026. 9:45" },
  { exportId: "e1302000-0000-4000-8000-000000000003", state: "expired", requestedAt: "2. 11. 2026. 12:00", expiresAt: "9. 11. 2026. 12:10" },
];
const nothing = () => {};

export const studentDataExportEntries = {
  StudentDataExportRequest: {
    prazno: () => <StudentDataExportRequest labels={LABELS} onRequest={nothing} />,
    učitavanje: () => <StudentDataExportRequest labels={LABELS} onRequest={nothing} busy />,
    greška: () => <StudentDataExportRequest labels={LABELS} onRequest={nothing} actionError="Za ovog studenta već postoji otvoren zahtjev." />,
    puno: () => <StudentDataExportRequest labels={LABELS} onRequest={nothing} />,
    onemogućeno: () => <StudentDataExportRequest labels={LABELS} onRequest={nothing} busy />,
  } satisfies Record<CatalogState, () => ReactNode>,
  StudentDataExportList: {
    prazno: () => <StudentDataExportList labels={LABELS} state={{ kind: "ready", exports: [] }} onApprove={nothing} />,
    učitavanje: () => <StudentDataExportList labels={LABELS} state={{ kind: "loading" }} onApprove={nothing} />,
    greška: () => <StudentDataExportList labels={LABELS} state={{ kind: "error", message: "Popis trenutačno nije dostupan." }} onApprove={nothing} onRetry={nothing} />,
    puno: () => <StudentDataExportList labels={LABELS} state={{ kind: "ready", exports: ROWS }} onApprove={nothing} />,
    onemogućeno: () => <StudentDataExportList labels={LABELS} state={{ kind: "ready", exports: ROWS }} onApprove={nothing} busy />,
  } satisfies Record<CatalogState, () => ReactNode>,
  StudentDataDownload: {
    prazno: () => <StudentDataDownload labels={DOWNLOAD} state={{ kind: "idle" }} onDownload={nothing} />,
    učitavanje: () => <StudentDataDownload labels={DOWNLOAD} state={{ kind: "busy" }} onDownload={nothing} />,
    greška: () => <StudentDataDownload labels={DOWNLOAD} state={{ kind: "error", message: "Preuzimanje trenutačno nije moguće. Pokušajte ponovno." }} onDownload={nothing} />,
    puno: () => <StudentDataDownload labels={DOWNLOAD} state={{ kind: "done" }} onDownload={nothing} />,
    onemogućeno: () => <StudentDataDownload labels={DOWNLOAD} state={{ kind: "gone" }} onDownload={nothing} />,
  } satisfies Record<CatalogState, () => ReactNode>,
};
