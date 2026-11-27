// The real PortfolioPort (PIL-K-PORTFELJ): the list of submitted versions from reads the app already makes.
// student.assignments.get and student.assignment-work.get name the student's works and which are submitted;
// the submission state of each submitted work (the read of the receipt page) gives the signed receipt.
// No route of its own: the reads come in through `call` and `submission`, so tests hand in fakes.
import { createApi, browserTransport } from "../../../../../../src/client/api";
import type { SubmissionRead } from "../../../../../../src/client/submission";
import { readSubmittedWork } from "../../../../../../src/components/editor/mentor/work-state/submitted-work-read";
import { readCourses, type CoursesCall } from "../courses/read";
import type { PortfolioPort, PortfolioRaw, PortfolioRead } from "./model";

export type PortfolioDeps = {
  /** The two list reads, as the course pages make them. */
  readonly call: CoursesCall;
  /** The submission state of one work, as the receipt page reads it. */
  readonly submission: (assignmentId: string) => Promise<SubmissionRead>;
};

type One = { readonly kind: "entry"; readonly raw: PortfolioRaw } | { readonly kind: "skip" } | { readonly kind: "signedOut" } | { readonly kind: "unavailable" };

async function entryOf(deps: PortfolioDeps, assignmentId: string, title: string): Promise<One> {
  let read: SubmissionRead;
  try {
    read = await deps.submission(assignmentId);
  } catch {
    return { kind: "unavailable" };
  }
  if (read.kind === "session-expired") return { kind: "signedOut" };
  if (read.kind === "nepoznato") return { kind: "unavailable" };
  if (read.kind === "greska" || read.kind === "none") return { kind: "skip" };
  if (read.kind === "ceka") {
    // Requested, receipt not yet signed: handed over as pending, so the rules leave it out (B-6).
    return { kind: "entry", raw: { submissionId: "", assignmentId, documentId: "", versionId: "", title, submittedAt: read.requestedAt, courseEnded: false, status: "pending" } };
  }
  const p = read.receipt.payload;
  return {
    kind: "entry",
    raw: {
      // The submitted version is the one the signed receipt names: its submission stands for the version.
      submissionId: p.submissionId, assignmentId: p.assignmentId, documentId: p.documentId, versionId: p.submissionId,
      title, submittedAt: p.requestedAt, courseEnded: false, status: "submitted",
    },
  };
}

/** A port over the given reads. Signed out anywhere is signed out; a read that fails is unavailable, never a shorter list. */
export function portfolioPort(deps: PortfolioDeps): PortfolioPort {
  return {
    async read(): Promise<PortfolioRead> {
      const courses = await readCourses(deps.call, true, false);
      // The portfolio has no state of its own for 403 (DIZ S-02 gave the courses read one): it stays "unavailable" here.
      if (courses.kind !== "ready") return { kind: courses.kind === "denied" ? "unavailable" : courses.kind };
      if (courses.states === null) return { kind: "unavailable" };
      const states = courses.states;
      const submitted = courses.courses.flatMap((c) => c.assignments).filter((a) => states.get(a.id) === "submitted");
      const ones = await Promise.all(submitted.map((a) => entryOf(deps, a.id, a.title)));
      if (ones.some((o) => o.kind === "signedOut")) return { kind: "signedOut" };
      if (ones.some((o) => o.kind === "unavailable")) return { kind: "unavailable" };
      return { kind: "ok", entries: ones.flatMap((o) => (o.kind === "entry" ? [o.raw] : [])) };
    },
  };
}

/** The port the app uses in the browser. */
export function browserPortfolioPort(): PortfolioPort {
  return portfolioPort({
    call: createApi() as unknown as CoursesCall,
    submission: (assignmentId) => readSubmittedWork(assignmentId, { baseUrl: window.location.origin, fetchImpl: browserTransport }),
  });
}
