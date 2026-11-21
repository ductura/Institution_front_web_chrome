import { AssistantTransfer, type AssistantTransferLabels } from "@ductura/ui";
import { useState, type ReactNode } from "react";

import type { CatalogState } from "./coverage";

const LABELS: AssistantTransferLabels = {
  transfer: "Prenesi u rad",
  compare: "Usporedba prije primjene",
  compareHint: "Uklonjeni dio je precrtan, dodani podcrtan. Ništa se ne mijenja dok ne odaberete Primijeni.",
  before: "Prije",
  after: "Poslije",
  apply: "Primijeni",
  cancel: "Odustani",
  transferred: "Preneseno u rad.",
  busy: "Prenosim u rad…",
  disabled: "Prijenos u rad na ovom zadatku nije uključen.",
};

/** Invented paragraph and answer; no real student text. */
const PARAGRAPH = "Izmišljeno selo Lipovac ima tri bunara i staru školu.";
const ANSWER = "Izmišljeno selo Lipovac ima četiri bunara i obnovljenu staru školu.";

/** Applying only flips local state here; the real parent decides what is written. */
function TransferExample({ paragraph = PARAGRAPH, busy, disabled, error }: { paragraph?: string; busy?: boolean; disabled?: boolean; error?: string }) {
  const [transferred, setTransferred] = useState(false);
  return <AssistantTransfer labels={LABELS} paragraph={paragraph} answer={ANSWER} transferred={transferred}
    onApply={() => setTransferred(true)} busy={busy} disabled={disabled} error={error} />;
}

export const assistantTransferEntries = {
  AssistantTransfer: {
    prazno: () => <TransferExample paragraph="" />,
    učitavanje: () => <TransferExample busy />,
    greška: () => <TransferExample error="Prijenos nije uspio. Odlomak je ostao kakav je bio." />,
    puno: () => <TransferExample />,
    onemogućeno: () => <TransferExample disabled />,
  } satisfies Record<CatalogState, () => ReactNode>,
};
