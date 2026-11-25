import type { ConfirmResult, ImportBlock, ImportPreview, PreviewResult } from "../../../../../../src/client/import.ts";

import { importHostHr as t } from "./messages.hr";
import { ipynbHr } from "./ipynb/messages.hr";
import { parseIpynb } from "./ipynb/parse";
import { notebookToBlocks, type IpynbBlock } from "./ipynb/to-blocks";

/** The import dialog as a small state machine: file → preview → confirmed, never text before the student confirms. */
export type ImportState =
  | { step: "choose"; error?: string }
  | { step: "reading" }
  | { step: "preview"; preview: ImportPreview; error?: string }
  | { step: "confirming"; preview: ImportPreview }
  | { step: "notebook"; fileName: string; blocks: IpynbBlock[]; discarded: number; error?: string }
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

const IMPORTED = [{ type: "imported" }] as const;
const importedText = (text: string) => (text === "" ? [] : [{ type: "text", text, marks: IMPORTED }]);

/** A notebook read in the browser: the preview of its blocks, or a refusal back to the choose step. Nothing is run. */
export function afterNotebook(fileName: string, text: string): ImportState {
  const parsed = parseIpynb(text);
  if (parsed.kind === "refused") return { step: "choose", error: ipynbHr.refused[parsed.reason] };
  const { blocks, discarded } = notebookToBlocks(parsed.notebook);
  if (blocks.length === 0) return { step: "choose", error: ipynbHr.refused.empty };
  return { step: "notebook", fileName, blocks, discarded };
}

/** The notebook's blocks as editor content (schema v4), every text run carrying the `imported` mark. */
export const notebookContent = (blocks: readonly IpynbBlock[]) => blocks.map((block) =>
  block.type === "codeBlock" ? { type: "codeBlock", attrs: { language: block.language, caption: block.caption }, content: importedText(block.text) }
    : block.type === "heading" ? { type: "heading", attrs: { level: block.level }, content: importedText(block.text) }
      : { type: "paragraph", content: importedText(block.text) });
