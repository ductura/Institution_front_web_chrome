import { EventDispute, type EventDisputeLabels, type EventDisputeMark } from "@ductura/ui";
import type { ReactNode } from "react";

import type { CatalogState } from "./coverage";

// The app's own texts (packages/app host/student/event-dispute/messages.hr), repeated here for the catalogue.
const LABELS: EventDisputeLabels = {
  supplementAction: "Dopuni opis", disputeAction: "Ospori opis", supplementTitle: "Dopuni opis događaja",
  disputeTitle: "Ospori opis događaja", supplementMark: "Dopuna", disputeMark: "Osporavanje", field: "Tvoj tekst",
  hint: "Opis događaja ostaje kakav jest; tvoj tekst se prikazuje uz njega kao zasebna oznaka.",
  counter: "{used} od {max} znakova", send: "Pošalji", sending: "Slanje…", cancel: "Odustani",
  marksLabel: "Dopune i osporavanja događaja", sent: "Tekst je poslan.", empty: "Nema dopuna ni osporavanja.",
  tooLong: "Tekst je predug. Skrati ga na dopuštenu duljinu.", invalid: "Tekst nije prihvaćen. Upiši tekst do dopuštene duljine.",
  forbidden: "Ovaj tekst ne možeš poslati za ovaj rad.", signedOut: "Sesija je istekla. Prijavi se ponovno.",
  unavailable: "Tekst trenutačno nije moguće poslati. Pokušaj ponovno.",
};

const MARKS: readonly EventDisputeMark[] = [
  { id: "1", kind: "supplement", text: "Izmišljena dopuna: tekst sam pisala u knjižnici." },
  { id: "2", kind: "dispute", text: "Izmišljeno osporavanje: ovaj opis ne odgovara radu." },
];

const view = (marks: readonly EventDisputeMark[], canAct: boolean, onSubmit: () => Promise<"ok" | "unavailable"> = async () => "ok") => (
  <EventDispute labels={LABELS} marks={marks} canAct={canAct} max={1000} onSubmit={onSubmit} />
);

export const eventDisputeEntries = {
  EventDispute: {
    prazno: () => view([], true),
    učitavanje: () => view([], true, () => new Promise(() => {})),
    greška: () => view([], true, async () => "unavailable"),
    puno: () => view(MARKS, true),
    onemogućeno: () => view(MARKS, false),
  } satisfies Record<CatalogState, () => ReactNode>,
};
