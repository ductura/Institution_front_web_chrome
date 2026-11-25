// NF-6 MK-11: the pure rules of "Moji studenti" (prototype `mentorstva`, card `ms-h`). The server has no
// aggregate per mentorship yet (SRV-MENTOR-11), so the row is joined from what the contract gives per work:
// work.milestone-states.get and work.consultation-slots.get. "čeka Vas" first, then "kod studenta", then
// "predano"; inside a group the works list's own order (by family name). Nothing is ranked by success or by
// days late, and a state the reads do not give is "nije dostupno", never a guess (B-6).
import type { MentoredWork, MentoredWorkType } from "../../../../../../src/components/teacher/mentored-works-read";
import { byFamilyName, liveHref, studentName } from "../../../../../../src/components/teacher/mentored-works-view";
import { dayDiff, relativeDays, whenOf } from "../key-dates/model";
import { overviewText as t } from "./messages.hr";

export type MilestoneEntry = {
  readonly title: string;
  readonly dueAt: string | null;
  readonly state: "not_submitted" | "submitted" | "revision_requested" | "approved";
  readonly revisionDueAt: string | null;
};
export type SlotEntry = { readonly state: "requested" | "countered" | "confirmed"; readonly startsAt: string };

/** What the two reads of one started work gave. */
export type WorkProgress =
  | { readonly kind: "ready"; readonly milestones: readonly MilestoneEntry[]; readonly slots: readonly SlotEntry[] }
  | { readonly kind: "signedOut" }
  | { readonly kind: "unavailable" };

export const STANDINGS = ["yours", "student", "submitted", "unknown"] as const;
export type Standing = (typeof STANDINGS)[number];

export type OverviewRow = {
  readonly key: string;
  readonly name: string;
  readonly title: string;
  readonly workType: MentoredWorkType;
  readonly href: string | null;
  readonly stage: string;
  readonly standing: Standing;
  readonly state: string;
};

/** The works whose state needs the two reads: started and not yet submitted. */
export const needsReads = (work: MentoredWork): work is MentoredWork & { documentId: string } =>
  work.workState === "in_progress" && work.documentId !== null;

function dueText(iso: string | null, now: number): string | null {
  const epoch = iso === null ? NaN : Date.parse(iso);
  if (!Number.isFinite(epoch)) return null;
  const n = dayDiff(epoch, now);
  return n === 0 ? t.dueToday : n > 0 ? t.dueAhead(relativeDays(epoch, now)) : t.dueGone(relativeDays(epoch, now));
}

/** Stage and state of a started work from its reads. */
function standingOf(progress: WorkProgress | undefined, now: number): Pick<OverviewRow, "stage" | "standing" | "state"> {
  if (progress === undefined || progress.kind !== "ready") return { stage: t.stageUnknown, standing: "unknown", state: t.unknown };
  const { milestones, slots } = progress;
  const review = milestones.find((m) => m.state === "submitted");
  if (review !== undefined) return { stage: review.title, standing: "yours", state: t.yoursMilestone(review.title) };
  const current = milestones.find((m) => m.state !== "approved");
  const stage = milestones.length === 0 ? t.stageNone : current === undefined ? t.stageAllApproved : current.title;
  const asked = [...slots].filter((s) => s.state === "requested" && Number.isFinite(Date.parse(s.startsAt)))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0];
  if (asked !== undefined) return { stage, standing: "yours", state: t.yoursSlot(whenOf(Date.parse(asked.startsAt))) };
  if (current === undefined) return { stage, standing: "student", state: t.student };
  const revision = current.state === "revision_requested";
  const due = dueText(revision ? current.revisionDueAt : current.dueAt, now);
  return { stage, standing: "student", state: due === null ? t.student : revision ? t.studentRevision(due) : t.studentDue(due) };
}

/** One row per mentorship (a mentorship never shows twice), "čeka Vas" first; `progress` is keyed by mentorship. */
export function overviewRows(works: readonly MentoredWork[], progress: ReadonlyMap<string, WorkProgress>, now: number): readonly OverviewRow[] {
  const seen = new Set<string>();
  const rows: OverviewRow[] = [];
  for (const work of byFamilyName(works)) {
    if (seen.has(work.mentorshipId)) continue;
    seen.add(work.mentorshipId);
    const own = work.workState === "submitted" ? { stage: t.stageFinal, standing: "submitted" as const, state: t.submitted }
      : needsReads(work) ? standingOf(progress.get(work.mentorshipId), now)
        : { stage: t.stageNotStarted, standing: "student" as const, state: t.studentNotStarted };
    rows.push({ key: work.mentorshipId, name: studentName(work), title: work.title, workType: work.workType, href: liveHref(work), ...own });
  }
  // A stable sort: the works list's order holds inside each group.
  return rows.sort((a, b) => STANDINGS.indexOf(a.standing) - STANDINGS.indexOf(b.standing));
}

/** The rows of one work type, or all for "". */
export const ofType = (rows: readonly OverviewRow[], type: MentoredWorkType | ""): readonly OverviewRow[] =>
  type === "" ? rows : rows.filter((r) => r.workType === type);

/** What the card says above the table: every read failed, some failed, or a session ended. */
export function readOutcome(progress: ReadonlyMap<string, WorkProgress>): "ok" | "partly" | "none" | "signedOut" {
  const all = [...progress.values()];
  if (all.some((p) => p.kind === "signedOut")) return "signedOut";
  const failed = all.filter((p) => p.kind !== "ready").length;
  return failed === 0 ? "ok" : failed === all.length ? "none" : "partly";
}
