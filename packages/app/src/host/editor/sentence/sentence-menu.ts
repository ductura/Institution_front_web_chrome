/**
 * ED-129: "Rečenica gore" and "Rečenica dolje" in the toolbar menu, as in the prototype (features.js, menu
 * Uredi: sentUp and sentDown, Alt+↑ and Alt+↓). The move is ED-33's `moveSentenceInEditor`; from the menu the
 * host also says why nothing moved, with the prototype's words.
 */
import type { Editor } from "@tiptap/core";

import { moveSentenceInEditor, planSentenceMove, type MoveDirection } from "../../../../../editor-core/src/outline/index.ts";

export type SentenceMenuResult = "done" | "notParagraph" | "readOnly" | "one-sentence" | "first" | "last" | "outside";

export const sentenceMenuHr = {
  up: "Rečenica gore (Alt+↑)",
  down: "Rečenica dolje (Alt+↓)",
  notParagraph: "Postavite kursor u rečenicu odlomka.",
  readOnly: "Rad se ne može uređivati.",
  "one-sentence": "U odlomku je samo jedna rečenica.",
  first: "Rečenica je već prva u odlomku.",
  last: "Rečenica je već zadnja u odlomku.",
  outside: "Postavite kursor u rečenicu koju želite pomaknuti.",
} as const;

const ATOM = "￼";

/** Moves the sentence holding the cursor; otherwise names why it did not move. */
export function moveSentenceFromMenu(editor: Editor | null, direction: MoveDirection): SentenceMenuResult {
  if (!editor || editor.isDestroyed) return "notParagraph";
  if (!editor.isEditable) return "readOnly";
  const { $from, empty } = editor.state.selection;
  if (!empty || $from.parent.type.name !== "paragraph") return "notParagraph";
  const paragraph = $from.parent;
  const plan = planSentenceMove(paragraph.textBetween(0, paragraph.content.size, undefined, ATOM), $from.parentOffset, direction);
  if (!plan.ok) return plan.reason;
  return moveSentenceInEditor(editor, direction) ? "done" : "notParagraph";
}
