/**
 * Which frame the workspace of one assignment shows (WEB-23, S: E-7). Pure,
 * so the page and the tests read the same decision.
 *
 * The page's own reads give the work state (student.assignment-work.get).
 * The submission state and the word range come from student.submission.get
 * and student.assignment-requirements.get, which are not in the published
 * contract yet. TODO(ugovor): until @ductura/contracts 3.1.0 (SRV-19, SRV-25,
 * SRV-22) the page passes neither and only tests do, with invented answers.
 *
 * Two variants are not decided here: `ucitavanje` is the route's loading
 * screen, and `bez-mreze` is the browser's own report, read on the client by
 * the top bar.
 */

import type { Read, SubmissionRead, WordRange } from "../../client/submission";

import type { EditorWorkRead } from "./EditorPage.read";

export type WorkspaceVariant = "puno" | "prazno" | "greska" | "predano";

export type WorkspaceFrame = {
  readonly variant: WorkspaceVariant;
  /** The assignment's word range, or null while it is not known. */
  readonly range: WordRange;
};

type ShownRead = Extract<EditorWorkRead, { kind: "ready" | "unavailable" }>;
type RequirementsRead = Read<{ kind: "ready"; wordRange: WordRange }>;

/**
 * The frame for one read. A submitted work is read only: the work state says
 * so, or the submission read holds a receipt. A submission read that failed,
 * or one still waiting for its receipt, never makes the work look submitted
 * (B-6); the work state alone decides then.
 */
export function workspaceFrame(read: ShownRead, submission?: SubmissionRead, requirements?: RequirementsRead): WorkspaceFrame {
  const range = requirements?.kind === "ready" ? requirements.wordRange : null;
  if (read.kind === "unavailable") return { variant: "greska", range: null };
  if (read.workState === "submitted" || submission?.kind === "potvrdeno") return { variant: "predano", range };
  return { variant: read.workState === "not_started" ? "prazno" : "puno", range };
}
