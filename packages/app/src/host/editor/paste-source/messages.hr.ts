// ED-76: texts of the "Prepoznat izvor" offer after a paste (prototype features.js `X.hooks.paste`, `pasteCite`).
export const pasteSourceHr = {
  found: "Prepoznat izvor:",
  source: (label: string, page: string) => (page === "" ? label : `${label}, str. ${page}`),
  why: "Zalijepljeni tekst odgovara citatu iz bilježnice izvora.",
  add: "Dodaj navod",
  close: "Zatvori",
  added: "Navod je dodan iza zalijepljenog teksta.",
  failed: "Navod ovdje nije moguće dodati. Dodajte ga iz bilježnice izvora.",
} as const;
