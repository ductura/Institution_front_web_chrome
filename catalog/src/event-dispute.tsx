import { EventDispute, type EventDisputeMark, type EventDisputeResult } from "@ductura/ui";
import type { ReactNode } from "react";

import { eventDisputeText as text } from "../../packages/app/src/host/student/event-dispute/messages.hr.ts";
import { DISPUTE_MAX, eventDisputeLabels } from "../../packages/app/src/host/student/event-dispute/model.ts";
import type { CatalogState } from "./coverage";

// The app's own texts (packages/app host/student/event-dispute), so the catalogue cannot drift from them.
// Invented event and invented marks; no real student text.
const EVENT = "Izmišljeni događaj: dodan je odlomak „Uvod”, 412 znakova.";
const MARKS: readonly EventDisputeMark[] = [
  { id: "demo-dopuna-1", kind: "supplement", text: "Izmišljena dopuna: odlomak sam prethodno napisao u bilješkama na papiru." },
  { id: "demo-osporavanje-1", kind: "dispute", text: "Izmišljeno osporavanje: odlomak je nastao tijekom dvije sesije, a ne jedne." },
];

/** The send answers after a short pause, so a click shows the busy dialog and then the result. */
const answer = (result: EventDisputeResult) => () =>
  new Promise<EventDisputeResult>((resolve) => { setTimeout(() => resolve(result), 600); });

/** One event of the process summary with its marks under it, the way the host shows it (EventDisputeSlot). */
function Event({ marks = [], canAct, result = "ok", note }: {
  marks?: readonly EventDisputeMark[]; canAct: boolean; result?: EventDisputeResult; note?: ReactNode;
}) {
  return (
    <div>
      {note}
      <p>{EVENT}</p>
      <EventDispute labels={eventDisputeLabels} marks={marks} canAct={canAct} max={DISPUTE_MAX} onSubmit={answer(result)} />
    </div>
  );
}

export const eventDisputeEntries = {
  EventDispute: {
    // Student, nothing added yet: both actions, no marks.
    prazno: () => <Event canAct />,
    // The host is still reading the marks: no actions until the read answers.
    učitavanje: () => <Event canAct={false} />,
    // The read failed: said once, the student can still write; a send here answers "unavailable".
    greška: () => <Event canAct result="unavailable" note={<p role="status">{text.loadError}</p>} />,
    puno: () => <Event marks={MARKS} canAct />,
    // The teacher: marks only, no actions.
    onemogućeno: () => <Event marks={MARKS} canAct={false} />,
  } satisfies Record<CatalogState, () => ReactNode>,
};
