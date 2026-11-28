// WEB-2129 (par-e-oznake): text of the in-text marks, the gutter and the legend,
// as in the prototype and INVENTAR-editor §2.6 text2 (Croatian).
import { pluralHr } from "@/lib/i18n/hr";

export const marksHr = {
  levelNames: { 0: "navod", 1: "obvezno", 2: "od mentora", 3: "savjet", 4: "odakle je tekst" },
  kinds: {
    hole: "Za provjeru",
    plain: "Navod upisan kao tekst",
    cmt: "Komentar",
    cite: "Navod",
    need: "Zatražena potvrda",
  },
  here: "Na ovom mjestu",
  // ED-38: the line in the "Uz tekst" alert row (prune.js `ctxAlerts`, the student's wording).
  needAlert: (n: number) => `Mentor traži potvrdu uz ${n} ${pluralHr(n, "navod", "navoda", "navoda")}`,
  // ED-45 (P2-17, dio 3): the ghost text of an empty paragraph (prototype app.js `ghostText`).
  ghost: {
    start: "Počnite pisati. Upišite @ za navod ili / za naredbe.",
    intro: "Uvod: predmet i problem rada → cilj i istraživačko pitanje → izvori i metoda → kratak pregled poglavlja",
    conclusion: "Zaključak: odgovor na pitanje iz uvoda → glavni nalazi → ograničenja rada → što ostaje otvoreno",
    chapter: (title: string) => `Pitanja za početak (nestaju kad počnete pisati):\n– Što čitatelj mora znati na kraju poglavlja „${title}”?\n– Koji izvor ovdje najviše koristite i zašto?\n– Tvrdnja → dokaz s navodom (@) → objašnjenje → veza sa sljedećim odlomkom`,
  },
  open: "otvori",
  close: "Zatvori",
  gutter: "Rub lista s oznakama",
  // ED-126 (prototype text2.js t2Pg).
  pages: {
    toggle: "Procjena stranica u rubu",
    title: "Brojevi stranica su procjena prema broju riječi. Točan broj daje Word pri izvozu.",
    mark: (page: number) => `≈ str. ${page}`,
  },
  legend: {
    open: "Što znače oznake",
    title: "Što znače oznake u tekstu",
    intro: "Klik na označeni tekst pokaže objašnjenje. Kad se na istom mjestu nađe više oznaka, Ductura ponudi popis.",
    groups: [
      { name: "Obvezno prije predaje", rows: [
        { sample: "[?]", kind: "Za provjeru", text: "Mjesto koje ste ostavili za poslije.", who: "Vi i mentor" },
        { sample: "(Autor, 2020)", kind: "Navod upisan kao tekst", text: "Nije povezan s izvorom u Vašem popisu.", who: "Vi i mentor" },
      ] },
      { name: "Od mentora", rows: [
        { sample: "komentar", kind: "Komentar", text: "Primjedba ili pitanje uz ovaj dio teksta.", who: "Vi i mentor" },
        { sample: "navod", kind: "Zatražena potvrda", text: "Mentor traži da uz navod priložite potvrdu iz izvora.", who: "Vi i mentor" },
      ] },
    ],
    who: "Tko vidi",
  },
  explain: {
    hole: "Zamijenite oznaku tekstom ili navodom. Dok stoji, rad se ne može predati.",
    plain: "Navod je upisan kao tekst i nije povezan s izvorom u Vašem popisu.",
    cmt: "Primjedba ili pitanje uz ovaj dio teksta. Odgovorite u kartici Komentari.",
    need: "Mentor traži da uz navod priložite potvrdu iz izvora.",
    cite: "Navod povezan s izvorom.",
  },
  // ED-45 (P2-17): what the popover of one mark offers (INVENTAR §2.6: holeNext, "Provjereno, ukloni").
  actions: {
    next: "Sljedeće mjesto ›",
    checked: "Provjereno, ukloni",
    link: "Poveži u Literaturi",
    // ED-104 (prototype text2.js holePop): a mark that asks for a source ([izvor], [citat], [stranica]).
    sourceTitle: "Ovdje nedostaje izvor",
    sourceIntro: "Odaberite izvor i oznaka postaje navod. Kursor ostaje na istom mjestu.",
    allSources: (n: number) => `Svi izvori (${n})`,
    newSource: "Dodaj novi izvor…",
    askSource: "Zapravo treba izvor",
  },
  // INVENTAR §2.6 text2 "Privatna bilješka" and level 3/4 marks are not drawn here:
  // no API for private notes (Q-6), advice and origin marks wait on other tasks (B-1, C-13).
  unavailable: {
    note: "Privatne bilješke nisu dostupne dok poslužitelj ne podrži bilješke uz tekst.",
  },
} as const;
