// The reads of "Pregled rada" (WEB-NUZ-PG). Only operations of the contract extract, through createApi:
//   teacher.work.get (+ teacher.submission-receipt.get)  the work, its student and state (readFrame of N-06)
//   teacher.courses.get                                  course name, assignment title, kind of work and deadline (PG-1)
//   teacher.assignment-grade.get                         eligible, or 409 practice_assignment (PG-10)
//   projection.process-summary.post / …-details.post     record state, sessions, pastes, transfers from the Asistent (PG-4)
//   work.origin-thresholds.get                           faculty rules (PG-4)
//   work.input-rhythm.get                                whether the rhythm is still recorded (PG-4)
// The assistant match is read by the provenance reader (work.assistant-match.get). teacher.work.get has no course
// name or task title; they come from the teacher's own course list, and when it does not list the assignment the
// header says so instead of guessing. Every function here never throws.
import { createApi, type ApiOptions } from "../../../../../../../src/client/api";
import { fetchProcessSummary } from "../../../../../../../src/client/process-summary";
import type { ProcessSummaryV1 } from "../../../../../../../src/client/process-summary";
import { readFrame, type FrameRead } from "../../n06/read";
import type { SummaryDetails, ThresholdRow } from "../../n10/model";
import { readOriginThresholds, readSummaryDetails } from "../../n10/port";
import type { Context, Grade, Header, Outcome } from "./model";

export type HeaderRead = { readonly kind: "ready"; readonly header: Header } | { readonly kind: "signedOut" | "notFound" | "unavailable" };

export type ReviewReads = {
  readonly header: (documentId: string) => Promise<HeaderRead>;
  readonly summary: (documentId: string) => Promise<Outcome<ProcessSummaryV1>>;
  readonly details: (documentId: string) => Promise<Outcome<SummaryDetails>>;
  readonly thresholds: (documentId: string) => Promise<Outcome<readonly ThresholdRow[]>>;
  readonly rhythm: (documentId: string) => Promise<Outcome<number>>;
};

const none = { query: undefined, body: undefined } as const;

/** The assignment in the teacher's course list; null when the read fails or does not list it. */
export async function readContext(assignmentId: string, options?: ApiOptions): Promise<Context | null> {
  try {
    const answer = await createApi(options)("teacher.courses.get", { params: undefined, ...none });
    if (!answer.ok) return null;
    for (const course of answer.body.courses) {
      const task = course.assignments.find((a) => a.id === assignmentId);
      if (task !== undefined) return { course: course.name, title: task.title, workType: task.workType, dueAt: task.dueAt };
    }
    return null;
  } catch {
    return null;
  }
}

/** 200: may be graded (in Merlin); 409 practice_assignment: a practice assignment; anything else: not known. */
export async function readGrade(assignmentId: string, options?: ApiOptions): Promise<Grade> {
  try {
    const answer = await createApi(options)("teacher.assignment-grade.get", { params: { assignmentId }, ...none });
    if (answer.ok) return "eligible";
    return answer.status === 409 ? "practice" : "unknown";
  } catch {
    return "unknown";
  }
}

export async function readHeader(documentId: string, options?: ApiOptions): Promise<HeaderRead> {
  const frame: FrameRead = await readFrame(documentId, options);
  if (frame.kind !== "ready") return frame;
  const [context, grade] = await Promise.all([
    readContext(frame.facts.assignmentId, options),
    readGrade(frame.facts.assignmentId, options),
  ]);
  return { kind: "ready", header: { facts: frame.facts, context, grade } };
}

/** The number of recorded rhythm bursts; 0 when none is recorded or it was deleted (30 days after submission). */
export async function readRhythm(documentId: string, current: () => boolean, options?: ApiOptions): Promise<Outcome<number>> {
  if (!current()) return { kind: "signedOut" };
  try {
    const answer = await createApi(options)("work.input-rhythm.get", { params: { documentId }, ...none });
    if (answer.ok) return { kind: "ok", value: answer.body.bursts.length };
    if (answer.status === 401) return { kind: "signedOut" };
    return { kind: answer.status === 404 || answer.status === 403 ? "notFound" : "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

const valueOf = <K extends string, T>(key: K) => (o: { kind: "ok" } & Record<K, T> | { kind: "signedOut" | "notFound" | "unavailable" }): Outcome<T> =>
  o.kind === "ok" ? { kind: "ok", value: (o as Record<K, T>)[key] } : { kind: o.kind };

export function reviewReads(current: () => boolean, options?: ApiOptions): ReviewReads {
  return {
    header: (documentId) => readHeader(documentId, options),
    summary: (documentId) => fetchProcessSummary(documentId, current, options).then(valueOf<"summary", ProcessSummaryV1>("summary")),
    details: (documentId) => readSummaryDetails(documentId, current, options).then(valueOf<"details", SummaryDetails>("details")),
    thresholds: (documentId) => readOriginThresholds(documentId, current, options).then(valueOf<"rows", readonly ThresholdRow[]>("rows")),
    rhythm: (documentId) => readRhythm(documentId, current, options),
  };
}
