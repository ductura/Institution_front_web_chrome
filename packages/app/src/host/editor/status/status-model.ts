import type { Node } from "@tiptap/pm/model";

import { documentCitations, documentSources } from "../../../../../../src/components/editor/sources/proofs/proof-sources.ts";
import type { SubmissionRehearsalProps } from "../../../../../../src/components/editor/submission-rehearsal/SubmissionRehearsal.tsx";
import { statusHostHr as t } from "./messages.hr.ts";

export type Supplements = NonNullable<SubmissionRehearsalProps["supplements"]>;

/** "označeno: n riječi" only while words are selected; a caret says nothing. */
export const selectedLabel = (words: number): string | null => (words > 0 ? t.selected(words) : null);

/** Sources of the work that no citation points at (`doc.attrs.sources` against the citation nodes). */
export function uncitedSources(doc: Node): { total: number; uncited: number } {
  const sources = documentSources({ attrs: doc.attrs as Record<string, unknown> });
  const cited = new Set<string>();
  doc.descendants((node) => {
    if (node.type.name === "citation") {
      documentCitations({ type: "citation", attrs: node.attrs as Record<string, unknown> }).forEach((c) => cited.add(c.sourceId));
    }
    return node.type.name !== "citation";
  });
  return { total: sources.length, uncited: sources.filter(({ id }) => !cited.has(id)).length };
}

/**
 * The rows the rehearsal adds to its parts. Uncited sources are read from the
 * text. Faculty requirements (Lekta, Q-11 open), the mentor's proofs and the
 * faculty forms have no source on this page yet: they say so, never a count.
 */
export function rehearsalSupplements(doc: Node | null): Supplements {
  const unavailable = { detail: t.unavailable };
  const read = doc && uncitedSources(doc);
  const uncited = read === null ? unavailable
    : read.total === 0 ? { detail: t.noSources }
    : { detail: read.uncited === 0 ? t.uncitedNone : t.uncited(read.uncited) };
  return { facultyRequirements: unavailable, uncited, proofs: unavailable, forms: unavailable };
}
