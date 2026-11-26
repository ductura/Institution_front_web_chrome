// ED-09 (NF2-P9): "Pravila za ovaj zadatak" under the Asistent card. Texts of the prototype's
// nf2.js aiCard (POL, NOTICE.purposes and the closing lines); the policy and the purposes come
// from the assignment's published notice (`student.notice.get`), nothing is invented here.
export const assistantRulesHr = {
  title: "Pravila za ovaj zadatak",
  loading: "Učitavam pravila zadatka…",
  unavailable: "Pravila zadatka trenutačno se ne mogu učitati. Vrijede pravila iz obavijesti zadatka.",
  policy: {
    prohibited: "Alati nisu dopušteni.",
    partially_allowed: "Alati su djelomično dopušteni.",
    encouraged: "Alati su dopušteni.",
  },
  none: "Nijedna svrha nije dopuštena.",
  purposes: {
    formatting: "formatiranje",
    proofreading: "lektura i jezična provjera",
    literature_search: "traženje literature",
    transcription: "transkripcija",
    translation: "prijevod",
  },
  allowed: "dopušteno",
  notAllowed: "nije dopušteno",
  outside: "Alate koje koristite izvan Ducture navedite u izjavi pri predaji.",
  readNotice: "Pročitaj obavijest zadatka",
  declaration: "Izjava o korištenju alata",
  editDeclaration: "Uredi izjavu",
} as const;
