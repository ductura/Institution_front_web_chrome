/**
 * N-06, the teacher's live view of one work, read-only (WEB-34; DAN-86,
 * D-142). This is the frame around the text: the heading, the previous and
 * the next work, the bar about gaps in the record when the process summary
 * says `has_gaps` (C-18), the bar for a work not yet submitted and the link
 * to its submission (N-07) once it is. Nothing here writes to the work
 * (D-34) and there is no "Zatraži doradu" (wave 8) and no link to extend
 * the deadline (wave 11).
 *
 * The text itself is drawn only by `LiveText` (PRODUCT §5 rule 5), through
 * `LiveWorkView`, and the summary only by `SummaryCard`; the page passes them
 * in as `text` and `aside`, so this frame never draws a word of the work. Their readers (live.document.get, projection.process-summary.post)
 * are not in src/client yet (Ductus#2028, wweb34 PITANJE), so until then the
 * page passes a placeholder. Written with `createElement` like `LiveText`, so
 * the unit test renders it with `renderToStaticMarkup`.
 */

import { createElement as h, type ReactNode } from "react";

import { messagesHr } from "../../lib/i18n/messages.hr";

import { ReadOnlyMentor } from "../editor/mentor/work-state/ReadOnlyMentor";
import styles from "./LiveWorkView.module.css";

const t = messagesHr.teacherLiveWork;

/**
 * TODO(ugovor): who and what the work is, and its neighbours in the
 * teacher's list. No published route gives this by document id yet
 * (Ductus#2028, wweb34 PITANJE point 3); a name the server does not have is
 * `null`, never a stand-in.
 */
export type LiveWorkFrameData = {
  readonly studentName: string | null;
  readonly assignmentTitle: string | null;
  /** True once the server holds a submission of this work (B-6: never inferred here). */
  readonly submitted: boolean;
  readonly previousId: string | null;
  readonly nextId: string | null;
};

/** `recordState` of ProcessSummaryV1 (contract 2.9.1); null while the summary is not read. */
export type RecordState = "complete" | "has_gaps";

/** The id of the summary region the gap bar links to. */
export const SUMMARY_ANCHOR = "sazetak-procesa";

const DOCUMENT_ID_MAX = 256;
// C0, DEL and C1, like [[:cntrl:]]; the same shape as the evidence.document id CHECK.
const CONTROL = /\p{Cc}/u;

/** True for an id the live route could read; "." and ".." would resolve as path steps. */
export function isWorkId(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() !== value || value === "." || value === "..") return false;
  const length = [...value].length;
  return length >= 1 && length <= DOCUMENT_ID_MAX && !CONTROL.test(value);
}

/** N-06 for `documentId`, or null for an id no route could read. */
export function liveWorkHref(documentId: unknown): string | null {
  return isWorkId(documentId) ? `/nastavnik/rad/${encodeURIComponent(documentId)}` : null;
}

/** N-07, the submission of `documentId` (WEB-35), or null for an id no route could read. */
export function submissionHref(documentId: unknown): string | null {
  const live = liveWorkHref(documentId);
  return live === null ? null : `${live}/predaja`;
}

function neighbour(id: string | null, label: string, rel: "prev" | "next") {
  const href = liveWorkHref(id);
  return href === null ? null : h("li", null, h("a", { href, rel, className: styles.link }, label));
}

export type LiveWorkFrameProps = {
  documentId: string;
  /** Null until the frame's read exists (TODO(ugovor)); the view then shows only the text. */
  frame: LiveWorkFrameData | null;
  recordState: RecordState | null;
  /** `LiveWorkView` of this work, or the page's placeholder. */
  text: ReactNode;
  /** The summary and the limits of the record. */
  aside?: ReactNode;
  /** Standalone work view already has a Mentor section in its aside. */
  mentorInAside?: boolean;
};

export default function LiveWorkFrame({ documentId, frame, recordState, text, aside, mentorInAside }: LiveWorkFrameProps) {
  const title = frame?.studentName ?? t.untitled;
  const nav = frame === null ? [] : [
    neighbour(frame.previousId, t.previous, "prev"),
    neighbour(frame.nextId, t.next, "next"),
  ].filter((item) => item !== null);
  const receipt = frame?.submitted ? submissionHref(documentId) : null;

  const bars: ReactNode[] = [];
  if (recordState === "has_gaps") {
    bars.push(h(
      "p",
      { key: "gaps", className: styles.note, role: "status", "data-bar": "gaps" },
      t.gaps,
      " ",
      h("a", { href: `#${SUMMARY_ANCHOR}`, className: styles.link }, t.gapsLink),
    ));
  }
  if (frame !== null && !frame.submitted) {
    bars.push(h("p", { key: "open", className: styles.note, role: "status", "data-bar": "not-submitted" }, t.notSubmitted));
  }

  return h(
    "div",
    null,
    h(
      "header",
      { className: styles.status },
      h("h1", null, title),
      frame?.assignmentTitle ? h("p", { className: styles.muted }, frame.assignmentTitle) : null,
      receipt === null ? null : h("p", null, h("a", { href: receipt, className: styles.link }, t.submission)),
      nav.length === 0 ? null : h("nav", { "aria-label": t.neighbours, className: styles.neighbours }, h("ul", null, ...nav)),
    ),
    ...bars,
    h(
      "div",
      { className: styles.layout },
      h("div", { className: styles.main }, text),
      h("aside", { className: styles.aside, "aria-label": t.sidePanel, id: SUMMARY_ANCHOR },
        !mentorInAside && h(ReadOnlyMentor, { key: documentId, documentId, role: "teacher", submitted: frame?.submitted,
          receiptHref: submissionHref(documentId) ?? undefined }),
        aside),
    ),
  );
}
