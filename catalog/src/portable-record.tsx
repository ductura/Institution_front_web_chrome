import { PortableRecordCard, type PortableRecordLabels, type PortableRecordState } from "@ductura/ui";
import type { ReactNode } from "react";

import type { CatalogState } from "./coverage";

// The app's own texts (packages/app host/student/portable-record/messages.hr), repeated here for the catalogue.
const LABELS: PortableRecordLabels = {
  title: "Prenosivi zapis",
  contentsLead: "Zapis je jedna datoteka koju možete čuvati sami. U njoj su:",
  contents: ["potvrda predaje", "dnevni korijen, kojim se zapis veže uz poslužitelj", "dokaz da zapis nije mijenjan", "PDF s QR kodom za brzu provjeru"],
  howToLead: "Zapis možete provjeriti na dva načina:",
  howTo: [
    "na svom računalu, naredbom za provjeru u terminalu, bez prijave i bez interneta",
    "QR kodom iz PDF-a: otvara javnu stranicu Provjera, na kojoj se zapis provjerava bez prijave",
  ],
  download: "Preuzmi zapis",
  downloading: "Preuzimam zapis…",
};

const view = (state: PortableRecordState) => <PortableRecordCard state={state} labels={LABELS} onDownload={() => {}} />;

export const portableRecordEntries = {
  PortableRecordCard: {
    prazno: () => view({ kind: "ready" }),
    učitavanje: () => view({ kind: "downloading" }),
    greška: () => view({ kind: "error", message: "Zapis za ovu predaju nije dostupan ovom računu." }),
    puno: () => view({ kind: "ready" }),
    onemogućeno: () => view({ kind: "downloading" }),
  } satisfies Record<CatalogState, () => ReactNode>,
};
