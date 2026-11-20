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
