/**
 * ProseMirror side of the spelling check (E§3.6 rich, WEB-1104): wavy
 * underline on words the dictionary does not know, only while writing, never in
 * code blocks, foreign-language text or links. The Tiptap extension carries the
 * controller; commands below act on a state or view.
 */
import { Extension } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

import type { SpellingController } from "./controller";
import { scanBlock, type Hit, type Skip } from "./words";

export const SPELL_CLASS = "ductura-sp";
/** Wavy underline from the inventory: 1 px, offset 3 px, --error. Inline, so no global stylesheet is needed. */
const UNDERLINE = "text-decoration: underline wavy var(--error); text-decoration-thickness: 1px; text-underline-offset: 3px; cursor: pointer;";
const REFRESH = "ductura-spelling-refresh";
/** Marks whose text the check leaves alone: a foreign language and links. */
const SKIPPED_MARKS = new Set(["lang", "link"]);

export type SpellHit = Hit & { pos: number };
type PluginState = { set: DecorationSet; hits: readonly SpellHit[]; writing: boolean };

export const spellingKey = new PluginKey<PluginState>("ductura-spelling");

/** Text of a text block with one U+FFFC per atom, so offsets equal positions. */
function blockText(node: PMNode): { text: string; skips: Skip[] } {
  let text = "";
  const skips: Skip[] = [];
  node.forEach((child) => {
    if (child.isText) {
      if (child.marks.some((m) => SKIPPED_MARKS.has(m.type.name))) skips.push([text.length, text.length + child.nodeSize]);
      text += child.text ?? "";
    } else text += "￼".repeat(child.nodeSize);
  });
  return { text, skips };
}

export function computeHits(doc: PMNode, c: SpellingController, writing: boolean): SpellHit[] {
  const speller = c.speller;
  if (!speller || !c.isOn || !writing) return [];
  const hits: SpellHit[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === "codeBlock" || node.type.spec.code) return false;
    if (!node.isTextblock) return true;
    const { text, skips } = blockText(node);
    for (const h of scanBlock(text, skips, { speller, known: c.knownWords, names: c.names })) {
      hits.push({ ...h, pos: pos + 1 + h.from });
    }
    return false;
  });
  return hits;
}

const build = (doc: PMNode, hits: readonly SpellHit[], writing: boolean): PluginState => ({
  hits, writing,
  set: DecorationSet.create(doc, hits.map((h) => Decoration.inline(h.pos, h.pos + h.word.length, { class: SPELL_CLASS, "data-spell": "1", style: UNDERLINE }))),
});

export type SpellingOptions = { controller: SpellingController | null };

export const Spelling = Extension.create<SpellingOptions>({
  name: "spelling",
  addOptions() { return { controller: null }; },
  addProseMirrorPlugins() {
    const controller = this.options.controller;
    if (!controller) return [];
    const writing = (editable: boolean) => editable;
    return [new Plugin<PluginState>({
      key: spellingKey,
      state: {
        init: (_c, state) => build(state.doc, computeHits(state.doc, controller, writing(this.editor.isEditable)), writing(this.editor.isEditable)),
        apply: (tr, prev, _old, next) => {
          const now = writing(this.editor.isEditable);
          if (!tr.docChanged && !tr.getMeta(REFRESH) && now === prev.writing) return prev;
          return build(next.doc, computeHits(next.doc, controller, now), now);
        },
      },
      props: { decorations: (state) => spellingKey.getState(state)?.set ?? null },
      view: (view: EditorView) => {
        const off = controller.subscribe(() => {
          if (!view.isDestroyed) view.dispatch(view.state.tr.setMeta(REFRESH, true).setMeta("addToHistory", false));
        });
        void controller.ensureLoaded();
        return { destroy: off };
      },
    })];
  },
});

export const hitsOf = (state: EditorState): readonly SpellHit[] => spellingKey.getState(state)?.hits ?? [];

/** The marked word under (or touching) a position, nearest first. */
export function hitAt(state: EditorState, pos: number): SpellHit | null {
  const near = hitsOf(state).filter((h) => h.pos <= pos && pos <= h.pos + h.word.length);
  return near.sort((a, b) => Math.abs(a.pos - pos) - Math.abs(b.pos - pos))[0] ?? null;
}

/** The next marked word after the caret, wrapping to the first. */
export function nextHit(state: EditorState): { hit: SpellHit; index: number; total: number } | null {
  const hits = hitsOf(state);
  if (!hits.length) return null;
  const at = state.selection.from;
  const hit = hits.find((h) => h.pos > at) ?? hits[0]!;
  return { hit, index: hits.indexOf(hit), total: hits.length };
}

export function selectHit(state: EditorState, hit: SpellHit): Transaction {
  return state.tr.setSelection(TextSelection.create(state.doc, hit.pos, hit.pos + hit.word.length)).scrollIntoView();
}

/** Puts a suggestion in place of the word, keeping the text's marks. */
export function replaceHit(state: EditorState, hit: SpellHit, replacement: string): Transaction {
  return state.tr.insertText(replacement, hit.pos, hit.pos + hit.word.length);
}
