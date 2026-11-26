// WEB-NUZ-MENTOR-1 (NF-6 MK-1): the pure rules of the Mentor card's mount point in the right panel.
// The server gives no work-review state; the card's state is read from what it does give (the revision
// requests and the submitted flag), and anything those cannot tell is "nedostupno", never a guess (B-6).
import type { createApi } from "../../../../../../src/client/api";
import type { RevisionRequest } from "../../../../../../src/client/revision-requests";
import type { WorkMessage } from "../../../../../../src/client/work-messages";

import type { WorkState } from "../mentor";
import { nodeWords, type WordsNode } from "../mentor/prep-model";
import { roundOf } from "../work/review/review-model";

/**
 * Submitted → "predan"; a version waiting for the mentor → "kod mentora"; open requests → "dorada";
 * no request ever → "kod Vas" (the extract has no way to send the work for review). Every other mix
 * (only closed requests, an unread list) is `null`: the card says the state is unavailable.
 */
export function workStateOf(submitted: boolean, requests: readonly RevisionRequest[] | null): WorkState | null {
  if (submitted) return { kind: "submitted", submittedAt: null };
  if (requests === null) return null;
  if (requests.length === 0) return { kind: "draft" };
  const round = roundOf(requests);
  const current = (r: RevisionRequest) => r.versions[r.versions.length - 1] ?? null;
  if (round.kind === "teacher-turn") {
    const sent = requests.filter((r) => r.state === "responded").map((r) => current(r)?.response?.window ?? "").sort().pop();
    return sent ? { kind: "review", round: round.round, sentAt: sent } : null;
  }
  if (round.kind === "student-turn") {
    const newest = requests.filter((r) => r.state === "open" || r.state === "reopened").sort((a, b) => b.number - a.number)[0];
    const instruction = newest ? current(newest)?.instruction ?? null : null;
    return { kind: "revise", due: null, mustOpen: round.open, request: instruction === null || instruction.trim() === "" ? null : instruction };
  }
  return null;
}

/**
 * The moment the badge counts from: the person's own last message. What the other side wrote after it
 * is new; nothing is stored in the browser for it (no trace left on a shared computer after sign-out).
 */
export function seenAtOf(role: "student" | "teacher", messages: readonly WorkMessage[]): string | null {
  return messages.filter((m) => m.senderRole === role).map((m) => m.createdAt).sort().pop() ?? null;
}

/** The heading the abstract is written under, at the end of the work (prototype mentor2 "Sažetak"). */
export const ABSTRACT_HEADING = "Sažetak";

type Block = WordsNode & { readonly type: { readonly name: string }; readonly textContent: string };
type Doc = { forEach(fn: (node: Block) => void): void };

/** Words under the "Sažetak" heading up to the next heading; 0 when the work has no such heading. */
export function abstractWords(doc: Doc): number {
  let inside = false;
  let words = 0;
  doc.forEach((node) => {
    if (node.type.name === "heading") { inside = node.textContent.trim().toLocaleLowerCase("hr") === ABSTRACT_HEADING.toLocaleLowerCase("hr"); return; }
    // Block by block, so a list or a hard line break under the heading does not glue words (#631 review).
    if (inside) words += nodeWords(node);
  });
  return words;
}

/** The answer of student.mentored-assignments.get, as much of it as the rule reads. */
export type MentoredRead = { readonly ok: true; readonly body: { readonly assignments: readonly { readonly id: string }[] } } | { readonly ok: false };

/**
 * DEMO-POP-3: "Završni rad" belongs to a mentored work only. Only a list of the student's mentored works
 * that leaves this assignment out hides it (a seminar then sends no thesis reads at all); an unread list
 * or no assignment id keeps the panel, whose own reads still hide it on the server's 404.
 */
export function thesisShownOf(mentored: MentoredRead, assignmentId: string | undefined): boolean {
  if (!assignmentId || !mentored.ok) return true;
  const id = assignmentId.toLowerCase();
  return mentored.body.assignments.some((a) => a.id.toLowerCase() === id);
}

/** The ids work.seen.post takes: lower-case UUIDs (the route's pattern). */
const SEEN_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** The most items one work.seen.post takes. */
export const SEEN_CHUNK = 200;

type Api = ReturnType<typeof createApi>;

export type SeenItem = { readonly kind: "revision_request"; readonly id: string };

/**
 * MEN-R06 (MEN-21): the revisions ("dorade") the student has been shown and the server has not been told about
 * yet. `reported` holds what this page already sent, so a re-read does not send the same item again.
 */
export function unreportedSeen(requests: readonly RevisionRequest[], reported: ReadonlySet<string>): SeenItem[] {
  const out: SeenItem[] = [];
  for (const r of requests) {
    const id = r.id.toLowerCase();
    if (SEEN_ID.test(id) && !reported.has(id) && !out.some((o) => o.id === id)) out.push({ kind: "revision_request", id });
  }
  return out;
}

/**
 * Tells the server which items the student saw, 200 at a time. Returns the ids the server accepted (answered
 * 200); a failed or thrown call leaves its items unreported, so the next read tries again. Never throws.
 */
export async function reportSeen(call: Api, documentId: string, items: readonly SeenItem[]): Promise<string[]> {
  const done: string[] = [];
  for (let at = 0; at < items.length; at += SEEN_CHUNK) {
    const chunk = items.slice(at, at + SEEN_CHUNK);
    try {
      const answer = await call("work.seen.post", { params: { documentId }, query: undefined, body: { items: chunk } });
      if (answer.ok) done.push(...chunk.map((i) => i.id));
    } catch { /* unreported: the next read tries again */ }
  }
  return done;
}
