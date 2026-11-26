// WEB-V21-STEM-KOD-BLOK: što editor prikazuje za blok koda. Prikaz = brojevi redaka, naslov ispisa i bojenje
// kroz ProseMirror dekoracije; plugin nikad ne mijenja dokument. Bez bojenja (biblioteka ne radi) blok se
// i dalje prikazuje s brojevima redaka. Tab/Shift+Tab daje `extensions-v4.ts`.
import type { Node as PmNode, Schema } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type NodeView } from "@tiptap/pm/view";

import { highlightRanges, isCodeLanguage, lineCount, type CodeLanguage, type HighlightRange } from "./highlight.ts";
import { codeBlockHr as t } from "./messages.hr.ts";
import styles from "./CodeBlock.module.css";

export type CodeBlockAvailability = { enabled: true } | { enabled: false; reason: string };

/** Blok koda postoji samo u shemi v4 (čvor `codeBlock` sa `language` i `caption`). */
export function supportsCodeBlocks(schema: Schema, schemaVersion: number | undefined): boolean {
  const node = schema.nodes.codeBlock;
  return schemaVersion === 4 && !!node && !node.isInline && !!node.spec.attrs && "language" in node.spec.attrs && "caption" in node.spec.attrs;
}

export function codeBlockAvailability(schema: Schema, schemaVersion: number | undefined, editable: boolean): CodeBlockAvailability {
  if (!supportsCodeBlocks(schema, schemaVersion)) return { enabled: false, reason: t.disabledSchema };
  if (!editable) return { enabled: false, reason: t.disabledReadOnly };
  return { enabled: true };
}

/** Akcija uz blok (npr. „Pokreni testove”): puni je drugi zadatak preko `actions`; ovdje se samo prikazuje. */
export type CodeBlockAction = { readonly id: string; readonly label: string; readonly run: () => void };
export type CodeBlockInfo = { readonly pos: number; readonly language: CodeLanguage | null; readonly code: string };
export type CodeBlockActions = (block: CodeBlockInfo) => readonly CodeBlockAction[];

export const codeViewKey = new PluginKey("ductura-code-block-view");

const rangesCache = new WeakMap<PmNode, HighlightRange[] | null>();
function rangesOf(node: PmNode): HighlightRange[] | null {
  if (rangesCache.has(node)) return rangesCache.get(node)!;
  const found = highlightRanges(node.textContent, isCodeLanguage(node.attrs.language) ? node.attrs.language : null);
  rangesCache.set(node, found);
  return found;
}

export function highlightDecorations(doc: PmNode): DecorationSet {
  const decorations: Decoration[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== "codeBlock") return;
    for (const range of rangesOf(node) ?? []) {
      decorations.push(Decoration.inline(pos + 1 + range.from, pos + 1 + range.to, { class: range.className }));
    }
    return false;
  });
  return DecorationSet.create(doc, decorations);
}

function drawCodeBlock(initial: PmNode, getPos: () => number | undefined, actions: () => CodeBlockActions | undefined): NodeView {
  let node = initial;
  const dom = document.createElement("div");
  dom.className = styles.block!;
  dom.setAttribute("data-code-block", "");
  const caption = document.createElement("div");
  caption.className = styles.caption!;
  caption.contentEditable = "false";
  const gutter = document.createElement("div");
  gutter.className = styles.gutter!;
  gutter.contentEditable = "false";
  gutter.setAttribute("aria-hidden", "true");
  const pre = document.createElement("pre");
  pre.className = styles.pre!;
  const code = document.createElement("code");
  pre.append(code);
  const bar = document.createElement("div");
  bar.className = styles.actions!;
  bar.contentEditable = "false";
  dom.append(caption, gutter, pre, bar);
  const paint = () => {
    const text = typeof node.attrs.caption === "string" ? node.attrs.caption : "";
    caption.textContent = text === "" ? "" : t.listing(text);
    caption.hidden = text === "";
    if (isCodeLanguage(node.attrs.language)) dom.setAttribute("data-language", node.attrs.language); else dom.removeAttribute("data-language");
    gutter.replaceChildren(...Array.from({ length: lineCount(node.textContent) }, (_, i) => {
      const line = document.createElement("div"); // one block per number: survives the editor's `white-space: normal` on non-editable nodes
      line.textContent = String(i + 1);
      return line;
    }));
    bar.replaceChildren();
    const pos = getPos();
    const list = pos === undefined ? [] : actions()?.({ pos, language: isCodeLanguage(node.attrs.language) ? node.attrs.language : null, code: node.textContent }) ?? [];
    for (const action of list) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = action.label;
      button.setAttribute("data-code-action", action.id);
      button.addEventListener("click", action.run);
      bar.append(button);
    }
    bar.hidden = list.length === 0;
  };
  paint();
  return {
    dom,
    contentDOM: code,
    update: (next) => {
      if (next.type !== node.type) return false;
      node = next;
      paint();
      return true;
    },
    ignoreMutation: (mutation) => !code.contains(mutation.target),
  };
}

/** Crta blokove koda (brojevi redaka, naslov, akcije) i boji ih; `actions` se čita pri svakom crtanju. */
export function codeViewPlugin(actions: () => CodeBlockActions | undefined): Plugin {
  return new Plugin({
    key: codeViewKey,
    props: {
      nodeViews: { codeBlock: (node, _view, getPos) => drawCodeBlock(node, getPos, actions) },
      decorations: (state) => highlightDecorations(state.doc),
    },
  });
}
