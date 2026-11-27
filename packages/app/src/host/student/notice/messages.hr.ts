// P-8 (E-6a): the "Ukratko" card above the full notice. Texts of the prototype's
// `.up-sum`; the full notice below keeps its own catalogue. The line about the
// tools names only the purposes the teacher allowed (aiPurposes), nothing more.
export const summaryText = {
  heading: "Ukratko",
  due: "Rok: {time}",
  length: "Opseg: {range}",
  lengthNone: "Opseg nije određen.",
  allowed: "Dopušteno: {list}.",
  allowedNone: "Dopušteno: nijedna uporaba Asistenta s popisa.",
  // ASIST-S1 (E-4): one line about the Assistant, from aiPolicy, aiPurposes and aiSummaryOnly. No provider or model name.
  assistantPilot: "Asistent u Ducturi radi u pilotu za dopuštene svrhe; razgovori se bilježe, a Vi ih možete priložiti izjavi.",
  assistantSummaryOnly: "Asistent u Ducturi radi u pilotu samo za sažimanje literature; razgovori se bilježe, a Vi ih možete priložiti izjavi.",
  assistantUnavailable: "Asistent nije dostupan. Obavijest ovog zadatka ne dopušta alate.",
  recorded: "Najvažnije o bilježenju: bilježe se promjene teksta i njihovo vrijeme, ne pritisnute tipke.",
  notConsent: "Potvrda nije privola. Prije potvrde ništa se ne šalje na poslužitelj.",
  purposes: {
    formatting: "formatiranje",
    proofreading: "lektoriranje i jezična provjera",
    literature_search: "pronalaženje literature",
    transcription: "transkribiranje",
    translation: "prevođenje",
  },
} as const;

// P-9 (a): opening the notice no longer writes "otvorena", so these lines are not shown any more.
// They stay only because the shared catalogue (src/i18n/catalogue.ts, another lane's file) and its
// English parity still list them; removing them is a follow-up there.
export const noticeReadText = {
  sending: "Bilježi se da je obavijest otvorena…",
  read: "Na poslužitelju je zabilježeno da je obavijest otvorena.",
  failed: "Poslužitelj nije potvrdio da je otvaranje obavijesti zabilježeno.",
  stale: "Objavljena je nova verzija zadatka. Učitajte je i pročitajte novu obavijest.",
};
