import type { Node } from "@tiptap/pm/model";

import { documentCitations, documentSources } from "../../../../../../src/components/editor/sources/proofs/proof-sources.ts";
import type { SubmissionRehearsalProps } from "../../../../../../src/components/editor/submission-rehearsal/SubmissionRehearsal.tsx";
import type { GateState } from "../../../../../../src/components/editor/submission-rehearsal/declaration-gate.ts";
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

/** The mentor's requests for a proof of a source (student.source-proof-requests.get), as far as the row needs them. */
export type ProofsRead =
  | { readonly kind: "loading" }
  | { readonly kind: "unavailable" }
  | { readonly kind: "ready"; readonly total: number; readonly open: number };

/** What the rehearsal's rows read besides the text (WEB-NUZ-PREDAJA-1, P-16); absent is "not read". */
export type SupplementReads = { readonly gate?: GateState; readonly proofs?: ProofsRead };

/** The mentor's proofs: none asked, how many still wait, or why the row cannot say. */
function proofsDetail(proofs: ProofsRead | undefined): string {
  if (proofs === undefined || proofs.kind === "unavailable") return t.proofsUnavailable;
  if (proofs.kind === "loading") return t.proofsLoading;
  if (proofs.total === 0) return t.proofsNone;
  return proofs.open === 0 ? t.proofsNoneOpen : t.proofsOpen(proofs.open, proofs.total);
}

/** The faculty's declaration form, as student.declaration.get names it (OD-11), never a guess. */
function formsDetail(gate: GateState | undefined): string {
  if (gate === undefined || gate.kind === "unavailable" || gate.kind === "signedOut") return t.unavailable;
  if (gate.kind === "loading") return t.formsLoading;
  if (gate.kind === "not_required") return t.formsNotRequired;
  return gate.form ? t.formsOf(gate.form.formId, gate.form.formVersion) : t.formsNone;
}

/**
 * The rows the rehearsal adds to its parts. Uncited sources are read from the
 * text; the mentor's proofs from student.source-proof-requests.get and the
 * faculty's form from student.declaration.get (P-16). The faculty's rules have
 * no route a student may read (only institution.faculty-rules.get for the
 * institution): the row says that the check is not there yet, never a count.
 */
export function rehearsalSupplements(doc: Node | null, reads: SupplementReads = {}): Supplements {
  const unavailable = { detail: t.unavailable };
  const read = doc && uncitedSources(doc);
  const uncited = read === null ? unavailable
    : read.total === 0 ? { detail: t.noSources }
    : { detail: read.uncited === 0 ? t.uncitedNone : t.uncited(read.uncited) };
  return {
    facultyRequirements: { detail: t.facultyRulesNotYet },
    uncited,
    proofs: { detail: proofsDetail(reads.proofs) },
    forms: { detail: formsDetail(reads.gate) },
  };
}

type ProofsCall = (
  id: "student.source-proof-requests.get",
  input: { readonly params: { readonly assignmentId: string }; readonly query: undefined; readonly body: undefined },
) => Promise<{ ok: boolean; status: number; body?: unknown }>;

/** The mentor's requests through the shared client; anything but the contract's answer is "unavailable". */
export async function readProofRequests(call: ProofsCall, assignmentId: string): Promise<ProofsRead> {
  try {
    const answer = await call("student.source-proof-requests.get", { params: { assignmentId }, query: undefined, body: undefined });
    if (!answer.ok || answer.status !== 200) return { kind: "unavailable" };
    const list = (answer.body as { proofRequests?: unknown } | undefined)?.proofRequests;
    if (!Array.isArray(list)) return { kind: "unavailable" };
    const open = list.filter((item: { closedAt?: unknown }) => item.closedAt === null).length;
    return { kind: "ready", total: list.length, open };
  } catch {
    return { kind: "unavailable" };
  }
}
