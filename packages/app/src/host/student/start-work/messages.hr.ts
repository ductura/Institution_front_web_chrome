// WEB-1402: the text of "Započni rad" on the assignment card.
export const startWorkText = {
  start: "Započni rad",
  starting: "Otvara se…",
  /** The button's accessible name, so two cards never offer two buttons of the same name. */
  startFor: "Započni rad: {title}",
  opened: "Rad je otvoren.",
  language: "Jezik rada: {language}",
  rules: "Pravila fakulteta: verzija {version}",
  languages: { hr: "hrvatski", en: "engleski" },
  unknown: "Nije poznato je li rad započet. Pokušajte ponovno; otvorit će se isti rad.",
} as const;
