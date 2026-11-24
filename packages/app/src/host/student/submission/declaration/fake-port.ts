// Invented data for E-9 and PD-2 (WEB-2107): tests and the catalogue only, never real persons or work.
import type { Chat, DeclarationRead, DeclarationReader, Declared } from "./model";

export const FAKE_CHATS: readonly Chat[] = [
  {
    n: 1, date: "28. 10. 2026.", required: true,
    entries: [
      { who: "you", time: "10:01", text: "Sažmi tri glavna pristupa iz poglavlja o institucijama." },
      { who: "ai", time: "10:02", text: "Prvi pristup naglašava pravila, drugi interese, a treći povijesni slijed odluka." },
      { who: "transfer", time: "10:05", text: "2. Teorijski okvir, odlomak 1" },
    ],
  },
  {
    n: 2, date: "31. 10. 2026.", required: false,
    entries: [
      { who: "you", time: "19:22", text: "Koja su dva najčešća prigovora prvom pristupu?" },
      { who: "ai", time: "19:23", text: "Najčešće se navodi da zanemaruje interese sudionika i da teško objašnjava promjenu pravila." },
    ],
  },
];

export const FAKE_DECLARED: Declared = {
  form: "used", tools: "nijedan", purpose: "sažimanje literature", phase: "priprema",
  humanHelp: { kind: "colleague", text: "lektura kolege" },
};

const FULL: Extract<DeclarationRead, { kind: "ready" }> = {
  kind: "ready",
  recorded: [
    { kind: "transfer", at: "28. 10. 2026. u 10:05", target: "2. Teorijski okvir, odlomak 1" },
    { kind: "chat", date: "31. 10. 2026." },
  ],
  declared: FAKE_DECLARED,
  chats: FAKE_CHATS,
  question: "Kako ste provjerili sažetke literature koje ste dobili?",
};

/** The prototype's five variants: puno, nesklad, prazno, ucitavanje, greska. */
export const FAKE_READS = {
  puno: FULL,
  nesklad: { ...FULL, declared: { ...FAKE_DECLARED, form: "no_use" as const } },
  prazno: { kind: "ready", recorded: [], declared: null, chats: [], question: null } as DeclarationRead,
  ucitavanje: { kind: "loading" } as DeclarationRead,
  greska: { kind: "error" } as DeclarationRead,
} as const;

export function fakeReader(variant: keyof typeof FAKE_READS): DeclarationReader {
  return async () => FAKE_READS[variant];
}
