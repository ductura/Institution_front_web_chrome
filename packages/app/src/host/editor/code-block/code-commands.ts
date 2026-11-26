// WEB-V21-STEM-KOD-BLOK: umetanje i izmjena bloka koda. Rezultat je uvijek valjan v4 čvor `codeBlock`;
// jezik izvan popisa ili predug naslov odbija se (false) i dokument ostaje netaknut.
import type { Editor } from "@tiptap/core";

import { MAX_CODE_CAPTION_CODE_POINTS, isCodeLanguage, type CodeLanguage } from "./highlight.ts";

export type CodeBlockProps = { readonly language: CodeLanguage | null; readonly caption: string | null };

const codePoints = (text: string) => Array.from(text).length;
const live = (editor: Editor | null | undefined): editor is Editor => !!editor && !editor.isDestroyed && editor.isEditable;

/** Isto sređivanje kao u shemi: prijelom retka postaje razmak, krajevi se režu. */
export function tidyCaption(caption: string | null | undefined): string | null {
  const tidy = (caption ?? "").replace(/\r\n|[\r\n]/g, " ").replace(/^\p{White_Space}+|\p{White_Space}+$/gu, "");
  return tidy === "" ? null : tidy;
}

/** Je li kombinacija dopuštena: jezik s popisa (ili bez), naslov do 300 točaka koda. */
export function validCodeBlockProps(props: CodeBlockProps): boolean {
  if (props.language !== null && !isCodeLanguage(props.language)) return false;
  const caption = tidyCaption(props.caption);
  return caption === null || codePoints(caption) <= MAX_CODE_CAPTION_CODE_POINTS;
}

export function insertCodeBlock(editor: Editor | null | undefined, props: CodeBlockProps): boolean {
  if (!live(editor) || !editor.schema.nodes.codeBlock || !validCodeBlockProps(props)) return false;
  const attrs = { language: props.language, caption: tidyCaption(props.caption) };
  return editor.chain().focus().setNode("codeBlock", attrs).run();
}

/** Položaj bloka koda oko odabira, ili null. */
export function codeBlockPos(editor: Editor | null | undefined): number | null {
  if (!editor || editor.isDestroyed) return null;
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type.name === "codeBlock") return $from.before(depth);
  }
  return null;
}

export function currentCodeBlockProps(editor: Editor | null | undefined): CodeBlockProps | null {
  const pos = codeBlockPos(editor);
  if (pos === null) return null;
  const node = editor!.state.doc.nodeAt(pos)!;
  return { language: isCodeLanguage(node.attrs.language) ? node.attrs.language : null, caption: typeof node.attrs.caption === "string" ? node.attrs.caption : null };
}

/** Mijenja jezik i naslov bloka na `pos`; tekst bloka se ne dira. */
export function updateCodeBlock(editor: Editor | null | undefined, pos: number, props: CodeBlockProps): boolean {
  if (!live(editor) || !validCodeBlockProps(props)) return false;
  const node = pos >= 0 && pos <= editor.state.doc.content.size ? editor.state.doc.nodeAt(pos) : null;
  if (!node || node.type.name !== "codeBlock") return false;
  editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, language: props.language, caption: tidyCaption(props.caption) }));
  return true;
}
