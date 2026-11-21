import { ProblemReportForm, type ProblemReportFormLabels, type ProblemReportFormView } from "@ductura/ui";
import type { ReactNode } from "react";

import type { CatalogState } from "./coverage";

// Invented text; the host takes the real ones from the catalogue of messages.
const LABELS: ProblemReportFormLabels = {
  intro: "Opišite što ne radi. Obrazac ne traži ime ni broj indeksa.",
  categoryLegend: "O čemu se radi?",
  description: "Opis",
  attachedTitle: "Uz opis se šalje",
  attached: ["Vrsta stranice, bez oznake rada", "Preglednik i njegova glavna verzija", "Verzija aplikacije 0.1.0"],
  noContent: "Sadržaj Vašeg rada se ne šalje.",
};
const CATEGORIES = [
  { value: "technical", label: "Ductura ne radi kako treba", who: "Odgovara održavatelj Ducture." },
  { value: "account", label: "Ne mogu se prijaviti sustavom AAI@EduHr", who: "Odgovara AAI administrator fakulteta." },
  { value: "course", label: "Pitanje o uputama ili roku", who: "Odgovara koordinator pilota." },
].map((c, i) => ({ ...c, checked: i === 0 }));
const BASE: ProblemReportFormView = {
  categories: CATEGORIES, counter: "0 od 1000 znakova", check: null, alert: null, status: null, sent: null, ended: null,
  button: { label: "Pošalji prijavu", disabled: false },
};
const form = (view: ProblemReportFormView, description = "") => (
  <ProblemReportForm view={view} labels={LABELS} description={description} onDescription={() => undefined}
    onCategory={() => undefined} onSubmit={() => undefined} />
);

export const problemReportEntries = {
  ProblemReportForm: {
    prazno: () => form(BASE),
    učitavanje: () => form({ ...BASE, status: "Šaljem prijavu.", button: { label: "Pošalji prijavu", disabled: true } }, "Izmišljeni opis: gumb ne reagira."),
    greška: () => form({
      ...BASE, check: "Upišite opis problema.",
      alert: "Prijava nije poslana. Opis je ostao u obrascu. Ductura nije potvrdila primitak prijave. Pokušajte ponovno za nekoliko minuta.",
      button: { label: "Pokušaj ponovno", disabled: false },
    }),
    puno: () => form({ ...BASE, counter: "33 od 1000 znakova" }, "Izmišljeni opis: gumb ne reagira."),
    onemogućeno: () => form({ ...BASE, sent: ["Broj prijave: PR-0A1B2C3D4E", "Broj prijave navedite ako se javite istim povodom."], button: null }),
  } satisfies Record<CatalogState, () => ReactNode>,
};
