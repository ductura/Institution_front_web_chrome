import { PracticeBadge } from "@ductura/ui";
import type { ReactNode } from "react";

import type { CatalogState } from "./coverage";

// The mark has no states of its own: it is shown only when the server says `practice: true`.
const shown = () => <PracticeBadge practice />;
const hidden = () => <PracticeBadge practice={false} />;

export const practiceBadgeEntries = {
  PracticeBadge: {
    prazno: hidden,
    učitavanje: hidden,
    greška: hidden,
    puno: shown,
    onemogućeno: shown,
  } satisfies Record<CatalogState, () => ReactNode>,
};
