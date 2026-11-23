/**
 * The inline atoms of document schema v3 (docs/contracts/document-schema-v3.md
 * §3 and §5): the citation with `via` and `rq`, the footnote and the cross
 * reference. Like the v2 citation each is one position and takes no mark;
 * the citation's guard plugin (citation.ts, one for all three) keeps that and
 * keeps them out of headings. The attributes give the JSON of the contract's replay
 * form: `{sourceId, locator, via, rq}`, `{text}`, `{targetId}`, absent
 * optional ones as `null`.
 *
 * Pasted HTML is read only when its attributes are valid; anything else is
 * dropped, never repaired.
 */

import { mergeAttributes, Node } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

import { isAllowedTrimmedText } from "../document/document/forbidden";
import {
  isCrossReferenceTarget,
  isRequestId,
  MAX_CITATION_VIA_CODE_POINTS,
  MAX_FOOTNOTE_TEXT_CODE_POINTS,
} from "../document/document/schema";
import { Citation, citationAttrs } from "./citation";

export const FOOTNOTE = "footnote";
export const CROSS_REFERENCE = "crossReference";

const optional = (attribute: string, html: string) => ({
  default: null,
  parseHTML: (element: HTMLElement) => element.getAttribute(html),
  renderHTML: (attributes: Record<string, unknown>) =>
    typeof attributes[attribute] === "string" ? { [html]: attributes[attribute] } : {},
});

/** The v2 citation with the optional `via` and `rq` (§3.2). */
export const CitationV3 = Citation.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      via: optional("via", "data-via"),
      rq: optional("rq", "data-rq"),
    };
  },
  parseHTML() {
    return [
      {
        tag: "span[data-citation]",
        getAttrs: (element) => {
          const via = element.getAttribute("data-via");
          const rq = element.getAttribute("data-rq");
          const valid =
            (via === null || isAllowedTrimmedText(via, MAX_CITATION_VIA_CODE_POINTS)) && (rq === null || isRequestId(rq));
          return valid && citationAttrs(element) ? null : false;
        },
      },
    ];
  },
});

/** The label of a footnote mark for assistive technology; the number is display only. */
const footnoteLabel = (number: number) => `Fusnota ${number}`;

const footnoteKey = new PluginKey<DecorationSet>("footnoteNumbers");

/**
 * Footnote marks numbered in document order. Decorations only: the number is
 * never an attribute, so the canonical document and the revision bytes do not
 * change (it is a display of the order, nothing stored).
 */
function footnoteNumbers(doc: PmNode): DecorationSet {
  const marks: Decoration[] = [];
  let number = 0;
  doc.descendants((node, pos) => {
    if (node.type.name !== FOOTNOTE) return;
    number += 1;
    marks.push(
      Decoration.node(
        pos,
        pos + node.nodeSize,
        { role: "button", tabindex: "0", "aria-label": footnoteLabel(number), "data-footnote-number": String(number) },
        { number },
      ),
    );
  });
  return DecorationSet.create(doc, marks);
}

export const Footnote = Node.create({
  name: FOOTNOTE,
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      text: {
        isRequired: true,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-text"),
        renderHTML: (attributes: Record<string, unknown>) => ({ "data-text": attributes.text }),
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "span[data-footnote]",
        getAttrs: (element) =>
          isAllowedTrimmedText(element.getAttribute("data-text"), MAX_FOOTNOTE_TEXT_CODE_POINTS) ? null : false,
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes({ "data-footnote": "" }, HTMLAttributes)];
  },
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: footnoteKey,
        state: {
          init: (_config, state) => footnoteNumbers(state.doc),
          apply: (tr, previous, _old, state) => (tr.docChanged ? footnoteNumbers(state.doc) : previous),
        },
        props: { decorations: (state) => footnoteKey.getState(state) },
      }),
    ];
  },
  // The visible mark: the number as a superscript. It is the node view only; the
  // HTML of renderHTML (copy, paste, getHTML) stays the empty span.
  addNodeView() {
    return ({ node, HTMLAttributes, decorations }) => {
      const dom = document.createElement("span");
      for (const [name, value] of Object.entries(mergeAttributes({ "data-footnote": "" }, HTMLAttributes))) {
        if (value != null) dom.setAttribute(name, String(value));
      }
      dom.contentEditable = "false";
      const sup = document.createElement("sup");
      sup.setAttribute("aria-hidden", "true");
      dom.append(sup);
      let current = node;
      const show = (decorations: readonly Decoration[]) => {
        const number = decorations.map((d) => d.spec?.number).find((n) => typeof n === "number");
        sup.textContent = typeof number === "number" ? String(number) : "";
      };
      show(decorations);
      return {
        dom,
        update: (next, decorations) => {
          if (next.type !== current.type) return false;
          current = next;
          dom.setAttribute("data-text", String(next.attrs.text));
          show(decorations);
          return true;
        },
        // Nothing inside is the editor's: a click on the mark selects the node.
        ignoreMutation: () => true,
      };
    };
  },
});

export const CrossReference = Node.create({
  name: CROSS_REFERENCE,
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      targetId: {
        isRequired: true,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-target-id"),
        renderHTML: (attributes: Record<string, unknown>) => ({ "data-target-id": attributes.targetId }),
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "span[data-cross-reference]",
        getAttrs: (element) => (isCrossReferenceTarget(element.getAttribute("data-target-id")) ? null : false),
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes({ "data-cross-reference": "" }, HTMLAttributes)];
  },
});
