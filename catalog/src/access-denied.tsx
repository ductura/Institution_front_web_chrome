import { AccessDenied, type AccessDeniedLabels } from "@ductura/ui";
import type { ReactNode } from "react";

import type { CatalogState } from "./coverage";

// The app's own texts (packages/app messages.hr, accessDenied), repeated here for the catalogue.
const LABELS: AccessDeniedLabels = {
  title: { denied: "Nemate ovlasti za ovaj prikaz", expired: "Prijava je istekla", signedOut: "Potrebna je prijava" },
  body: {
    denied: "Ovaj prikaz nije dostupan s Vašim računom. Ako mislite da bi trebao biti, obratite se administratoru svoje ustanove.",
    expired: "Prijava je istekla zbog dulje neaktivnosti. Prijavite se ponovno preko AAI@EduHr i nastavite gdje ste stali.",
    signedOut: "Za ovaj prikaz prijavite se preko AAI@EduHr.",
  },
  signIn: "Prijavi se preko AAI@EduHr",
  heldNote: "Neposlani unos ostao je spremljen na uređaju (ne na poslužitelju). Nakon prijave možete ga nastaviti.",
  home: "Na početnu",
};

const view = (kind: "denied" | "expired" | "signedOut", holdsInput = false) => (
  <AccessDenied kind={kind} labels={LABELS} signInHref="/api/v1/auth/login" homeHref="/" holdsInput={holdsInput} />
);

export const accessDeniedEntries = {
  AccessDenied: {
    prazno: () => view("expired"),
    učitavanje: () => view("signedOut"),
    greška: () => view("denied"),
    puno: () => view("expired", true),
    onemogućeno: () => view("denied"),
  } satisfies Record<CatalogState, () => ReactNode>,
};
