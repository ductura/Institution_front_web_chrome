// ED-82: the texts of the hints in the text, word for word from the prototype (features.js KT and
// hintPop, app.js RULES.claim, RULES.sent and RULES.def).
export const hintsHr = {
  label: "Savjet",
  close: "Zatvori",
  replaceWith: "Zamijeni s",
  kt: {
    colloq: ["Razgovorni izraz", "Akademski tekst traži neutralniji izraz."],
    absolute: ["Preapsolutna tvrdnja", "Tvrdnja je jača od onoga što izvori mogu potvrditi."],
    first: ["Prvo lice", "Upute FPZG-a traže treće lice ili pasiv."],
  },
  claim: {
    title: "Tvrdnja traži izvor",
    why: "Svaka tvrdnja koja nije opće poznata ima navod izvora iz kojeg je preuzeta.",
    example: "Primjer: Čitanje naglas povezano je s većim rječnikom (Autor A, 2019: 14).",
    cite: "Umetni navod",
    hole: "Označi [izvor]",
  },
  long: {
    title: "Duga rečenica",
    why: "Rečenica dulja od 40 riječi dijeli se na dvije kako bi tvrdnja ostala jasna.",
    example: "Primjer: dvije tvrdnje povezane s „a” postaju dvije rečenice.",
  },
  passive: {
    title: "Pasiv u nizu",
    text: (n: number) => `${n} rečenice zaredom u pasivu. Barem jednu preoblikujte tako da se vidi tko što čini.`,
  },
  term: {
    early: "Pojam prije definicije",
    nodef: "Pojam bez definicije",
    why: "Ključni pojam definira se kad se prvi put spomene, s izvorom definicije.",
    open: "Otvori pojmovnik",
  },
  abbr: {
    title: "Kratica bez punog naziva",
    text: (ab: string, full: string) => `Kad se kratica ${ab} prvi put pojavi, ispred nje ide puni naziv${full ? `: ${full} (${ab})` : ""}.`,
    write: "Upiši puni naziv",
  },
  trans: {
    title: "Prijelaz",
    text: "Zadnja rečenica prethodnog odlomka i prva rečenica ovog nemaju zajedničkog pojma ni veznika. Čitatelj možda neće vidjeti vezu.",
    prev: "Prethodni odlomak završava",
    phrases: "Fraze za prijelaz",
    ok: "U redu je",
    /** Prototype PHRASES, the "Prijelaz" group. */
    list: ["Osim toga, …", "Nadalje, …", "Iz toga proizlazi da …", "Nakon što je opisano …, u nastavku se razmatra …"],
  },
  short: {
    title: "Dvije kratke rečenice",
    text: (first: string) => `Obje počinju s „${first}”. Mogu se spojiti u jednu.`,
    joined: "Ovako bi glasilo",
    join: "Spoji",
  },
} as const;
