// Pure rules of the N-06 frame (WEB-2150): heading, state line, "Slijed rada", links and banners.
// A fact the server does not give (task title, due date of an unsubmitted work, time of the last change)
// is left out or said as unavailable, never invented (B-6). No network call here.
import { formatDateTimeHr } from "../../../../../../src/lib/i18n/hr";
import { workFrameMessages as text } from "./messages.hr";

export type ServerState = "predano" | "nije_predano" | "nakon_roka" | "ceka";

export type Facts = {
  readonly studentName: string | null;
  readonly assignmentId: string;
  readonly state: ServerState;
  readonly previousId: string | null;
  readonly nextId: string | null;
  /** Only for a signed receipt. */
  readonly receipt: {
    readonly submittedAt: string; readonly dueAt: string; readonly afterDeadline: boolean;
    readonly version: number; readonly record: "continuous" | "with_gaps";
  } | null;
};

export type ProcessGap = { readonly previousEndedAt: string; readonly nextStartedAt: string };

export const heading = (facts: Pick<Facts, "studentName">): string =>
  `${facts.studentName ?? text.noName}, ${text.workKind}`;

export const isSubmitted = (facts: Pick<Facts, "state">): boolean => facts.state === "predano" || facts.state === "nakon_roka";

export function stateLine(facts: Facts): string {
  const { receipt } = facts;
  if (isSubmitted(facts)) {
    if (receipt === null) return text.submittedBare(facts.state === "nakon_roka");
    return text.submitted(formatDateTimeHr(receipt.submittedAt), formatDateTimeHr(receipt.dueAt), receipt.afterDeadline,
      receipt.version, receipt.record === "with_gaps");
  }
  if (facts.state === "ceka") return text.pending;
  // "nije_predano": the route does not say whether the deadline has passed, so the line is the live one.
  return text.live;
}

/** "Slijed rada": only what the server states. Requests for a revision are another task (WEB-2151). */
export function sequence(facts: Facts): readonly string[] {
  const { receipt } = facts;
  return receipt === null || !isSubmitted(facts) ? [] : [text.seqSubmitted(formatDateTimeHr(receipt.submittedAt), receipt.version)];
}

export type Link = { readonly key: string; readonly label: string; readonly path: string };

/** "Što je student predao" and "Usporedba verzija" only for a submitted work. */
export function links(facts: Facts, workPath: string): readonly Link[] {
  const submitted = isSubmitted(facts);
  return [
    ...(submitted ? [{ key: "submission", label: text.linkSubmission, path: `${workPath}/predaja` }] : []),
    { key: "summary", label: text.linkSummary, path: `${workPath}/sazetak` },
    { key: "replay", label: text.linkReplay, path: `${workPath}/reprodukcija` },
    ...(submitted ? [{ key: "compare", label: text.linkCompare, path: `${workPath}/usporedba` }] : []),
    { key: "interview", label: text.linkInterview, path: `${workPath}/priprema-razgovora` },
    { key: "consultations", label: text.linkConsultations, path: `${workPath}/konzultacije` },
  ];
}

export function gapsBanner(gaps: readonly ProcessGap[]): string | null {
  if (gaps.length === 0) return null;
  const from = gaps.map((g) => g.previousEndedAt).sort()[0]!;
  const to = gaps.map((g) => g.nextStartedAt).sort().at(-1)!;
  return text.gaps(formatDateTimeHr(from), formatDateTimeHr(to));
}

/** The "not submitted" banner needs the deadline to have passed; the route does not say it, so only on request. */
export const showNotSubmittedBanner = (facts: Pick<Facts, "state">, deadlinePassed: boolean | null): boolean =>
  facts.state === "nije_predano" && deadlinePassed === true;

export const extensionPath = (assignmentId: string): string => `/nastavnik/zadatak/${encodeURIComponent(assignmentId)}/produljenje`;

/**
 * NAS-R05: whether the assignment's deadline has passed, from the course list (teacher.courses.get). null when the
 * assignment is not in the list or its due date is not a date: unknown, never guessed.
 */
export function deadlinePassedFor(
  assignmentId: string, courses: readonly { readonly assignments: readonly { readonly id: string; readonly dueAt: string }[] }[], now: number,
): boolean | null {
  return duePassed(courses.flatMap((c) => c.assignments).find((a) => a.id === assignmentId)?.dueAt, now);
}

/** Whether a due date has passed; null when there is none or it is not a date (F4-NAS-R12 reads it with the title). */
export function duePassed(dueAt: string | undefined, now: number): boolean | null {
  const ms = dueAt === undefined ? Number.NaN : Date.parse(dueAt);
  return Number.isFinite(ms) ? ms < now : null;
}
