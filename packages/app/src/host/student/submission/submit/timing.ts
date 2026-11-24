// WEB-NUZ-PREDAJA-2 (NF-3 PR-7, PR-17, Daniel's answer 3): where the deadline stands for steps 3 and 4,
// in words both steps say alike. Two kinds of late submission are shown: after the deadline (the
// server decides whether the assignment allows it), and late by an exception the teacher granted this
// student (an individual extension read from student.deadline-history.get, granted after the
// assignment's deadline had passed and still open). A submission the assignment does not allow after the deadline is
// known only from the server's 409 not_open (PO-36: no field says so before), so it is an outcome of
// step 4, never guessed here. Pure: the time and the reads come in.
import { atOf, dayOf } from "../steps/time";
import type { SubmitStage } from "./model";
import { submitText as t } from "./messages.hr";

export type Timing =
  | { readonly kind: "open" }
  | { readonly kind: "extended"; readonly until: string }
  /** After the deadline that counts: the submission will be marked late. */
  | { readonly kind: "late"; readonly dueAt: string }
  /** The assignment's deadline passed; the teacher allowed this student to submit until `until`. */
  | { readonly kind: "exception"; readonly dueAt: string; readonly until: string }
  | { readonly kind: "submitted" }
  | { readonly kind: "unavailable" };

const ms = (iso: string | null | undefined) => (iso == null ? Number.NaN : Date.parse(iso));

/**
 * The timing of a work. `exception`: the newest extension of this student is their own (scope "one")
 * and ends at the extended deadline; null when it could not be read, which leaves an ordinary extension.
 */
export function timingOf(stage: SubmitStage, dueAt: string | null, exception: boolean | null, now: number): Timing {
  if (stage.kind === "open" || stage.kind === "submitted" || stage.kind === "unavailable") return stage;
  if (stage.kind === "closed") return { kind: "late", dueAt: stage.dueAt };
  const due = ms(dueAt);
  if (exception === true && dueAt !== null && Number.isFinite(due) && due < now) return { kind: "exception", dueAt, until: stage.until };
  return stage;
}

/** Whether the submission will be marked late, so the dialog asks for the second confirmation (PR-7). */
export function isLate(timing: Timing): boolean {
  return timing.kind === "late" || timing.kind === "exception";
}

type Extension = { readonly scope?: unknown; readonly dueAt?: unknown; readonly createdAt?: unknown };

/**
 * Whether the extended deadline is this student's own exception: the newest extension in a
 * student.deadline-history.get body has scope "one", the same instant as `extendedDueAt`, and was
 * granted after the assignment's deadline `dueAt` had passed (an extension granted before the deadline
 * is an ordinary extension, not a late submission). Null when the body is not the contract's list.
 */
export function exceptionFrom(body: unknown, extendedDueAt: string | null, dueAt: string): boolean | null {
  const list = (body as { extensions?: unknown } | null)?.extensions;
  if (!Array.isArray(list)) return null;
  if (extendedDueAt === null) return false;
  const newest = [...(list as Extension[])]
    .filter((e) => typeof e.createdAt === "string" && Number.isFinite(ms(e.createdAt as string)))
    .sort((a, b) => ms(b.createdAt as string) - ms(a.createdAt as string))[0];
  if (newest === undefined || typeof newest.dueAt !== "string") return false;
  return newest.scope === "one" && ms(newest.dueAt) === ms(extendedDueAt) && ms(newest.createdAt as string) > ms(dueAt);
}

const fill = (text: string, values: Record<string, string>) => text.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");

/** The line both steps show about a late submission (E-8b, E-10a), or null when it is not late. */
export function lateLine(timing: Timing): string | null {
  if (timing.kind === "late") return fill(t.late.past, { due: atOf(timing.dueAt) });
  if (timing.kind === "exception") return fill(t.late.exception, { due: atOf(timing.dueAt), until: atOf(timing.until) });
  return null;
}

/** The tag beside the title: "Iznimka do {datum}" or "Rok produljen do {datum}". */
export function timingTag(timing: Timing): string | undefined {
  if (timing.kind === "exception") return fill(t.late.exceptionTag, { until: dayOf(timing.until) ?? timing.until });
  if (timing.kind === "extended") return fill(t.extendedTag, { until: dayOf(timing.until) ?? timing.until });
  return undefined;
}

/** The dialog's sentence about the deadline (PD-3): the exception names its deadline. */
export function dialogLateLine(timing: Timing): string | null {
  if (timing.kind === "late") return t.dialogLate;
  if (timing.kind === "exception") return fill(t.late.dialogException, { until: atOf(timing.until) });
  return null;
}

/**
 * 409 not_open (PO-36). The server does not tie it to the deadline, so the deadline that counts (and
 * that the assignment does not take a late submission) is named only when it has passed (`late`).
 * Before it, during an extension and during the teacher's exception (whose deadline has not passed)
 * the line is neutral: nothing here says why the server refused.
 */
export function forbiddenLines(timing: Timing): readonly string[] {
  return timing.kind === "late" ? [fill(t.late.forbidden, { due: atOf(timing.dueAt) }), t.late.forbiddenMeta] : [t.late.notOpen];
}
