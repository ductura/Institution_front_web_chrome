/**
 * ED-94: the prototype's "Fraze" (app.js PHRASES, with features.js putting "Prijelaz" in fifth place), word for
 * word. A phrase goes in at the caret and its first "…" stays selected, so the student writes over it at once.
 */
import type { Editor } from "@tiptap/core";

import { hintsHr } from "../hints/messages.hr";

export type PhraseGroup = { readonly name: string; readonly phrases: readonly string[] };

export const PHRASE_GROUPS: readonly PhraseGroup[] = [
  { name: "Uvod i cilj", phrases: ["Cilj je ovog rada …", "Rad polazi od pitanja …", "U radu se analizira …", "Rad je podijeljen na … dijela."] },
  { name: "Pregled literature", phrases: ["Prema …, …", "… ističe da …", "U literaturi se razlikuju dva pristupa: …", "Za razliku od …, … tvrdi da …"] },
  { name: "Argument", phrases: ["Iz toga proizlazi da …", "To upućuje na zaključak da …", "Ključan razlog za to jest …"] },
  { name: "Ograda", phrases: ["Međutim, …", "S druge strane, …", "Ta se tvrdnja može osporiti jer …", "Unatoč tome, …"] },
  // The same list the "Prijelaz" hint offers under "Fraze za prijelaz".
  { name: hintsHr.trans.title, phrases: hintsHr.trans.list },
  { name: "Primjer", phrases: ["Primjerice, …", "To se vidi na primjeru …", "Kao ilustracija može poslužiti …"] },
  { name: "Zaključak", phrases: ["Zaključno, …", "Analiza je pokazala da …", "Ograničenje je ovog rada …", "Otvorenim ostaje pitanje …"] },
];

export const phrasesHr = {
  title: "Fraze",
  intro: "Fraza se umeće na mjesto kursora, a oznaka … ostaje označena da je odmah zamijenite.",
  groups: "Skupine fraza",
  close: "Zatvori",
} as const;

/** Puts `phrase` in place of the selection (a space before it when the text runs on) and selects its first "…". */
export function insertPhrase(editor: Editor, phrase: string): boolean {
  if (editor.isDestroyed || !editor.isEditable) return false;
  const { from, to } = editor.state.selection;
  const before = from > 1 ? editor.state.doc.textBetween(from - 1, from, "\n", "\n") : "";
  const text = before && !/\s/u.test(before) ? ` ${phrase}` : phrase;
  if (!editor.chain().focus().insertContentAt({ from, to }, text).run()) return false;
  const at = text.indexOf("…");
  if (at >= 0) editor.commands.setTextSelection({ from: from + at, to: from + at + 1 });
  return true;
}
