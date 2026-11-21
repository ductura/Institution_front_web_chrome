import {
  AssistantAsking, AssistantEntitlementUnconfirmed, AssistantLevelTwoOff, AssistantOffline, AssistantProviderError, AssistantPurposePicker,
  AssistantUnavailable, type AssistantPurpose,
} from "@ductura/ui";
import { useState, type ReactNode } from "react";

import type { CatalogState } from "./coverage";

const nothing = () => undefined;
const BUSY = "Provjeravam…";
const DISABLED = "Pomoćnik je na ovom zadatku isključen.";
const LEVEL_TWO_NOTE = "Nije uključeno na ovom zadatku.";

/** Purpose catalogue v2 (D-268 O2); level 2 is off until the task's teacher switches it on. */
const PURPOSES: readonly AssistantPurpose[] = [
  { key: "proofreading", level: 1, label: "Lektura", enabled: true },
  { key: "translation", level: 1, label: "Prijevod", enabled: true },
  { key: "literature_search", level: 1, label: "Traženje literature", enabled: true },
  { key: "formatting", level: 1, label: "Formatiranje", enabled: true },
  { key: "transcription", level: 1, label: "Transkripcija", enabled: true },
  ...["Objašnjenje pojma", "Brainstorming", "Restrukturiranje", "Generiranje primjera", "Kodiranje podataka"].map((label, index) => (
    { key: `level_two_${index + 1}`, level: 2 as const, label, enabled: false, note: LEVEL_TWO_NOTE })),
];

const PICKER_LABELS = {
  heading: "Za što trebate Pomoćnika?", levelOne: "Razina 1", levelTwo: "Razina 2",
  empty: "Za ovaj zadatak nema uključenih svrha.", busy: "Učitavam svrhe…",
  foot: "Svrhe razine 2 na ovom zadatku nisu uključene.",
};

function PickerExample({ state }: { state: CatalogState }) {
  const [selected, setSelected] = useState<string | undefined>(state === "puno" ? "proofreading" : undefined);
  return <AssistantPurposePicker labels={PICKER_LABELS} selectedKey={selected} onSelect={setSelected}
    purposes={state === "prazno" || state === "učitavanje" ? [] : PURPOSES}
    busy={state === "učitavanje"}
    error={state === "greška" ? "Svrhe se nisu učitale. Pokušajte ponovno." : undefined}
    disabledReason={state === "onemogućeno" ? DISABLED : undefined} />;
}

/** Invented earlier conversation shown under a notice (read-only). */
const EARLIER: ReactNode = <p>Izmišljeni raniji odgovor: usporedite dvije metode kompostiranja.</p>;

type StateProps = { busy?: boolean; disabled?: boolean; error?: string; children?: ReactNode };
function stateEntry(render: (props: StateProps) => ReactNode) {
  return {
    prazno: () => render({}),
    učitavanje: () => render({ busy: true }),
    greška: () => render({ error: "Provjera nije uspjela. Pokušajte ponovno." }),
    puno: () => render({ children: EARLIER }),
    onemogućeno: () => render({ disabled: true }),
  } satisfies Record<CatalogState, () => ReactNode>;
}

const common = { busy: BUSY, disabled: DISABLED };

export const assistantPurposeStateEntries = {
  AssistantPurposePicker: {
    prazno: () => <PickerExample state="prazno" />,
    učitavanje: () => <PickerExample state="učitavanje" />,
    greška: () => <PickerExample state="greška" />,
    puno: () => <PickerExample state="puno" />,
    onemogućeno: () => <PickerExample state="onemogućeno" />,
  } satisfies Record<CatalogState, () => ReactNode>,
  AssistantAsking: stateEntry((props) => <AssistantAsking {...props} onAnswer={nothing} labels={{
    ...common, title: "Brainstorming", tag: "Pomoćnik pita",
    message: "U ovom načinu Pomoćnik postavlja pitanja i ne piše tekst za rad.", answer: "Odgovori",
  }} />),
  AssistantLevelTwoOff: stateEntry((props) => <AssistantLevelTwoOff {...props} onClose={nothing} labels={{
    ...common, title: "Restrukturiranje", tag: "Razina 2",
    message: "Ovu svrhu uključuje nastavnik zadatka. Ako Vam treba, pitajte nastavnika.", close: "Zatvori",
  }} />),
  AssistantUnavailable: stateEntry((props) => <AssistantUnavailable {...props} labels={{
    ...common, title: "Pomoćnik",
    message: "Pomoćnik na ovom zadatku nije dostupan. Pisanje i predaja rade bez njega.",
  }} />),
  AssistantProviderError: stateEntry((props) => <AssistantProviderError {...props} onRetry={nothing} onClose={nothing} labels={{
    ...common, title: "Pomoćnik",
    message: "Pomoćnik trenutačno ne odgovara. Ništa nije preneseno u rad.", retry: "Pokušaj ponovno", close: "Zatvori",
  }} />),
  AssistantOffline: stateEntry((props) => <AssistantOffline {...props} labels={{
    ...common, title: "Pomoćnik", tag: "Bez mreže",
    message: "Razgovor se čita s ovog uređaja. Prenijeti tekst možete tek kad se mreža vrati i provjeri se pravo na uporabu.",
  }} />),
  AssistantEntitlementUnconfirmed: stateEntry((props) => <AssistantEntitlementUnconfirmed {...props} onClose={nothing} labels={{
    ...common, title: "Pomoćnik",
    message: "Uporaba Pomoćnika na ovom zadatku trenutačno nije dopuštena, pa se odgovor ne može primijeniti.", close: "Zatvori",
  }} />),
};
