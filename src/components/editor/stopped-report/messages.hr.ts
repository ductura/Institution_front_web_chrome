// ED-07 (NF2-P18): "Javi problem" next to "Slanje na poslužitelj je zaustavljeno" (prototype nf2prob).
export const stoppedReportHr = {
  open: "Javi problem",
  title: "Javi problem",
  lead: "U prijavu ide samo oznaka stanja i inačica stranice. Tekst rada se ne šalje.",
  stateLabel: "Oznaka stanja",
  stateValue: "Slanje zaustavljeno",
  kindLabel: "Vrsta",
  kindValue: "Tehnički problem",
  note: "Što ste radili (neobavezno)",
  notePlaceholder: "Npr. veza se prekinula tijekom pisanja.",
  cancel: "Odustani",
  send: "Pošalji prijavu",
  sending: "Šaljem prijavu…",
  sent: "Prijava je poslana. U nju je ušla samo oznaka stanja, ne tekst rada.",
  noteRefused: "Opis ne može ovako u prijavu. Skratite ga ili uklonite posebne znakove.",
  // What goes as the description when the student writes nothing (the route wants one).
  defaultNote: "Slanje na poslužitelj je zaustavljeno.",
} as const;
