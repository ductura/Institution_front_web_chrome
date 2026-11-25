import { describe, expect, it } from "vitest";

import type { MentoredWork } from "../../../../../../src/components/teacher/mentored-works-read";
import { overviewText as t } from "./messages.hr";
import { ofType, overviewRows, readOutcome, type MilestoneEntry, type WorkProgress } from "./overview-model";

// Invented people and works only. "Today" is 1. 12. 2026. at noon, Zagreb.
const NOW = Date.parse("2026-12-01T11:00:00.000Z");
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const work = (n: number, family: string, extra: Partial<MentoredWork> = {}): MentoredWork => ({
  mentorshipId: id(n), assignmentId: id(100 + n), documentId: `izmisljeni-rad-${n}`, student: { givenName: "Student", familyName: family },
  title: `Izmišljeni rad ${n}`, workType: "bachelor_thesis", workState: "in_progress", ...extra,
});
const stage = (title: string, state: MilestoneEntry["state"], dueAt: string | null = null, revisionDueAt: string | null = null): MilestoneEntry =>
  ({ title, state, dueAt, revisionDueAt });
const ready = (milestones: MilestoneEntry[], slots: { state: "requested" | "countered" | "confirmed"; startsAt: string }[] = []): WorkProgress =>
  ({ kind: "ready", milestones, slots });

describe("Moji studenti (MK-11)", () => {
  it("puts what waits on the mentor first, then the student's turn, then submitted; by family name inside a group", () => {
    const works = [
      work(1, "A", { workState: "submitted" }),
      work(2, "B"),
      work(3, "C"),
      work(4, "D", { documentId: null, workState: "not_started" }),
      work(5, "E"),
    ];
    const progress = new Map<string, WorkProgress>([
      [id(2), ready([stage("Nacrt", "approved"), stage("Prvo poglavlje", "not_submitted", "2026-11-28T12:00:00.000Z")])],
      [id(3), ready([stage("Nacrt", "submitted")])],
      [id(5), ready([stage("Nacrt", "approved")], [{ state: "requested", startsAt: "2026-12-04T11:00:00.000Z" }])],
    ]);
    const rows = overviewRows(works, progress, NOW);
    expect(rows.map((r) => [r.name, r.standing, r.stage, r.state])).toEqual([
      ["Student C", "yours", "Nacrt", "čeka Vas: etapa „Nacrt” je na pregledu"],
      ["Student E", "yours", t.stageAllApproved, "čeka Vas: termin konzultacija 4. 12. 2026. u 12:00 za potvrdu"],
      ["Student B", "student", "Prvo poglavlje", "kod studenta, rok je bio prije 3 dana"],
      ["Student D", "student", t.stageNotStarted, t.studentNotStarted],
      ["Student A", "submitted", t.stageFinal, t.submitted],
    ]);
    expect(rows.find((r) => r.name === "Student D")?.href).toBeNull();
    expect(rows.find((r) => r.name === "Student C")?.href).toBe("/nastavnik/rad/izmisljeni-rad-3");
  });

  it("never orders by how late a work is: the works list order holds inside the student's group", () => {
    const works = [work(1, "A"), work(2, "B")];
    const progress = new Map<string, WorkProgress>([
      [id(1), ready([stage("Nacrt", "not_submitted", "2026-12-20T12:00:00.000Z")])],
      [id(2), ready([stage("Nacrt", "not_submitted", "2026-10-01T12:00:00.000Z")])],
    ]);
    expect(overviewRows(works, progress, NOW).map((r) => r.name)).toEqual(["Student A", "Student B"]);
  });

  it("a revision names its own deadline; a due today is 'danas'; no deadline says only whose turn it is", () => {
    const works = [work(1, "A"), work(2, "B"), work(3, "C"), work(4, "D")];
    const progress = new Map<string, WorkProgress>([
      [id(1), ready([stage("Nacrt", "revision_requested", "2026-11-01T12:00:00.000Z", "2026-12-06T12:00:00.000Z")])],
      [id(2), ready([stage("Nacrt", "not_submitted", "2026-12-01T20:00:00.000Z")])],
      [id(3), ready([stage("Nacrt", "not_submitted")])],
      [id(4), ready([])],
    ]);
    expect(overviewRows(works, progress, NOW).map((r) => [r.stage, r.state])).toEqual([
      ["Nacrt", "kod studenta: dorada, rok je za 5 dana"],
      ["Nacrt", "kod studenta, rok je danas"],
      ["Nacrt", t.student],
      [t.stageNone, t.student],
    ]);
  });

  it("a countered or confirmed slot does not wait on the mentor", () => {
    const progress = new Map<string, WorkProgress>([[id(1), ready([], [
      { state: "countered", startsAt: "2026-12-04T11:00:00.000Z" }, { state: "confirmed", startsAt: "2026-12-05T11:00:00.000Z" },
    ])]]);
    expect(overviewRows([work(1, "A")], progress, NOW)[0]?.standing).toBe("student");
  });

  it("a work whose reads failed is 'not available' and comes last, never a guessed state", () => {
    const progress = new Map<string, WorkProgress>([[id(1), { kind: "unavailable" }], [id(2), ready([stage("Nacrt", "submitted")])]]);
    const rows = overviewRows([work(1, "A"), work(2, "B")], progress, NOW);
    expect(rows.map((r) => [r.name, r.standing, r.stage, r.state])).toEqual([
      ["Student B", "yours", "Nacrt", "čeka Vas: etapa „Nacrt” je na pregledu"],
      ["Student A", "unknown", t.stageUnknown, t.unknown],
    ]);
  });

  it("one row per mentorship; the filter keeps one work type", () => {
    const works = [work(1, "A"), work(1, "A"), work(2, "B", { workType: "master_thesis", workState: "submitted" })];
    const rows = overviewRows(works, new Map([[id(1), ready([])]]), NOW);
    expect(rows).toHaveLength(2);
    expect(ofType(rows, "master_thesis").map((r) => r.name)).toEqual(["Student B"]);
    expect(ofType(rows, "")).toHaveLength(2);
  });

  it("reads the outcome of all reads: ok, partly, none, signed out", () => {
    const ok: WorkProgress = ready([]);
    expect(readOutcome(new Map())).toBe("ok");
    expect(readOutcome(new Map([["a", ok]]))).toBe("ok");
    expect(readOutcome(new Map<string, WorkProgress>([["a", ok], ["b", { kind: "unavailable" }]]))).toBe("partly");
    expect(readOutcome(new Map<string, WorkProgress>([["b", { kind: "unavailable" }]]))).toBe("none");
    expect(readOutcome(new Map<string, WorkProgress>([["a", ok], ["b", { kind: "signedOut" }]]))).toBe("signedOut");
  });
});
