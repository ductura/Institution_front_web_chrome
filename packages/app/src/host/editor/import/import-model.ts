import type { ConfirmResult, ImportBlock, ImportPreview, PreviewResult } from "../../../../../../src/client/import.ts";

import { importHostHr as t } from "./messages.hr";

/** The import dialog as a small state machine: file → preview → confirmed, never text before the student confirms. */
export type ImportState =
  | { step: "choose"; error?: string }
  | { step: "reading" }
  | { step: "preview"; preview: ImportPreview; error?: string }
  | { step: "confirming"; preview: ImportPreview }
  | { step: "done"; words: number };

export const START: ImportState = { step: "choose" };

export function afterPreview(result: PreviewResult): ImportState {
  if (result.kind === "preview") return { step: "preview", preview: result.preview };
  if (result.kind === "refused") return { step: "choose", error: t.refused[result.reason] };
  return { step: "choose", error: t[result.kind] };
}

export function afterConfirm(state: ImportState, result: ConfirmResult): ImportState {
  if (state.step !== "confirming") return state;
  if (result.kind === "confirmed") return { step: "done", words: state.preview.words };
  if (result.kind === "expired" || result.kind === "changed") return { step: "choose", error: t[result.kind] };
  return { step: "preview", preview: state.preview, error: t[result.kind] };
}

type EditorText = { type: "text"; text: string; marks?: { type: "bold" | "italic" }[] };
export type EditorBlock = { type: string; attrs?: { level: number }; content?: EditorText[] };

/** The previewed blocks as editor content; the editor gives them their own ids. */
export const editorContent = (blocks: readonly ImportBlock[]): EditorBlock[] => blocks.map((block) => {
  const content = block.children.filter((child) => child.text !== "").map(({ text, marks }): EditorText =>
    marks.length === 0 ? { type: "text", text } : { type: "text", text, marks: marks.map((type) => ({ type })) });
  return block.type === "heading" ? { type: "heading", attrs: { level: block.level }, content } : { type: block.type, content };
});
