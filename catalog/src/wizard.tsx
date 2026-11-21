import { RouteLoading, TextField, Wizard, type WizardStep } from "@ductura/ui";
import type { ReactNode } from "react";

import type { CatalogState } from "./coverage";

// Invented example: a two-step form. The labels repeat the app's own wording.
type Values = { title: string; due: string };
const LABELS = { steps: "Koraci izrade zadatka", next: "Nastavi", back: "Natrag", finish: "Objavi zadatak", finishing: "Objavljujem…" };
const steps: WizardStep<Values>[] = [
  {
    id: "basics", label: "Osnovno", validate: (v): Record<string, string> => (v.title.trim() ? {} : { title: "Upišite naslov zadatka." }),
    render: ({ values, errors, set }) => (
      <TextField label="Naslov" value={values.title} error={errors.title} onChange={(event) => set("title", event.target.value)} />
    ),
  },
  {
    id: "due", label: "Rok", validate: (v): Record<string, string> => (v.due ? {} : { due: "Odaberite rok." }),
    render: ({ values, errors, set }) => (
      <TextField label="Rok" type="date" value={values.due} error={errors.due} onChange={(event) => set("due", event.target.value)} />
    ),
  },
];

import type { WizardOutcome } from "@ductura/ui";
const ok = async (): Promise<WizardOutcome> => ({ ok: true });
const wizard = (initial: Values, onFinish: () => Promise<WizardOutcome> = ok) => <Wizard steps={steps} initialValues={initial} labels={LABELS} onFinish={onFinish} />;

export const wizardEntries = {
  Wizard: {
    prazno: () => wizard({ title: "", due: "" }),
    učitavanje: () => <RouteLoading label="Učitavanje čarobnjaka…" />,
    greška: () => wizard({ title: "Izmišljeni seminar", due: "" }, async () => ({ ok: false, error: "Zadatak nije objavljen. Pokušajte ponovno." })),
    puno: () => wizard({ title: "Izmišljeni seminar iz ekologije grada", due: "2027-01-30" }),
    onemogućeno: () => <p>Izrada zadatka trenutačno nije dostupna.</p>,
  } satisfies Record<CatalogState, () => ReactNode>,
};
