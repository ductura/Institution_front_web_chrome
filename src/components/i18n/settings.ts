// Texts of the settings screen (DAN-872), in both interface languages. They
// live here, beside OUTLINE_HR, because locales/ changes only with the same
// text on the server; parity.test.ts holds the two tables to the same keys.

/** Croatian, the default interface language (D-70). */
export const SETTINGS_HR = {
  heading: "Postavke",
  lede: "Vrijede samo za Vaš račun.",
  language: {
    legend: "Jezik sučelja",
    note: "Mijenja jezik zaslona. Jezik na kojem pišete rad ostaje isti.",
  },
  personal: "Osobne postavke",
  none: "Za Vaš račun nema osobnih postavki.",
  /** Labels of catalogue keys; a key without a label is not drawn. */
  keys: {
    "notifications.email": "Obavijesti e-poštom",
    "display.reduced_motion": "Manje pokreta na zaslonu",
  },
  notice: {
    changed: "Postavka je promijenjena.",
    rejected: "Ta vrijednost nije dopuštena. Ništa nije poslano.",
    failed: "Promjena nije potvrđena. Pokušajte ponovno.",
  },
  unavailable: "Postavke se nisu učitale. Pokušajte ponovno.",
  signedOut: "Prijavite se da biste vidjeli svoje postavke.",
};

export type SettingsTexts = typeof SETTINGS_HR;

/** English, the same keys and nothing else (parity.test.ts). */
export const SETTINGS_EN: SettingsTexts = {
  heading: "Settings",
  lede: "They apply to your account only.",
  language: {
    legend: "Interface language",
    note: "Changes the language of the screen. The language you write your work in stays the same.",
  },
  personal: "Personal settings",
  none: "Your account has no personal settings.",
  keys: {
    "notifications.email": "Email notifications",
    "display.reduced_motion": "Less motion on screen",
  },
  notice: {
    changed: "The setting has been changed.",
    rejected: "That value is not allowed. Nothing was sent.",
    failed: "The change was not confirmed. Please try again.",
  },
  unavailable: "Settings did not load. Please try again.",
  signedOut: "Sign in to see your settings.",
};

/** Each interface language by its own name, the same in both tables. */
export const LANGUAGE_NAMES = { hr: "Hrvatski", en: "English" } as const;
