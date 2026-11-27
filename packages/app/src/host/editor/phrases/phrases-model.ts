import type { Editor } from "@tiptap/core";

/**
 * ED-111: the academic phrases of the prototype (app.js `PHRASES`, with features.js putting "Prijelaz" fifth).
 * A phrase goes in at the caret; its first "…" is left selected so the student types over it at once.
 */
export const PHRASES: readonly (readonly [string, readonly string[]])[] = [
  ["Uvod i cilj", ["Cilj je ovog rada …", "Rad polazi od pitanja …", "U radu se analizira …", "Rad je podijeljen na … dijela."]],
  ["Pregled literature", ["Prema …, …", "… ističe da …", "U literaturi se razlikuju dva pristupa: …", "Za razliku od …, … tvrdi da …"]],
  ["Argument", ["Iz toga proizlazi da …", "To upućuje na zaključak da …", "Ključan razlog za to jest …"]],
  ["Ograda", ["Međutim, …", "S druge strane, …", "Ta se tvrdnja može osporiti jer …", "Unatoč tome, …"]],
  ["Prijelaz", ["Osim toga, …", "Nadalje, …", "Iz toga proizlazi da …", "Nakon što je opisano …, u nastavku se razmatra …"]],
  ["Primjer", ["Primjerice, …", "To se vidi na primjeru …", "Kao ilustracija može poslužiti …"]],
  ["Zaključak", ["Zaključno, …", "Analiza je pokazala da …", "Ograničenje je ovog rada …", "Otvorenim ostaje pitanje …"]],
];

const GAP = "…";

/** Puts `phrase` at the caret (over a selection), with a space before it when it would touch a word; false when nothing was written. */
export function insertPhrase(editor: Editor | null, phrase: string): boolean {
  if (!editor || editor.isDestroyed || !editor.isEditable || !phrase) return false;
  const before = editor.state.selection.$from.nodeBefore;
  const space = before?.isText && before.text && !/\s$/u.test(before.text) ? " " : "";
  const start = editor.state.selection.from + space.length;
  if (!editor.chain().focus().insertContent(space + phrase).run()) return false;
  const gap = phrase.indexOf(GAP);
  if (gap >= 0) editor.commands.setTextSelection({ from: start + gap, to: start + gap + GAP.length });
  return true;
}
