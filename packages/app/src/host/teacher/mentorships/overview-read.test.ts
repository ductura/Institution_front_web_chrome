import { describe, expect, it } from "vitest";

import type { MentoredWork } from "../../../../../../src/components/teacher/mentored-works-read";
import { readOverview, readProgress, type OverviewCall } from "./overview-read";

// Invented ids and texts only.
const MILESTONE = {
  id: "00000000-0000-4000-8000-0000000000e1", title: "Izmišljena etapa", description: "", dueAt: "2026-12-10T12:00:00.000Z", state: "submitted",
  everSubmitted: true, submittedRevisionId: 3, submittedAt: "2026-11-30T12:00:00.000Z", revisionComment: null, revisionDueAt: null,
  revisionRequestedAt: null, approvedAt: null, approvalMessage: null,
};
const SLOT = { id: "00000000-0000-4000-8000-0000000000f1", startsAt: "2026-12-04T11:00:00.000Z", proposedAt: "2026-11-30T10:00:00.000Z", state: "requested", topic: null };

const answering = (byOp: Record<string, { ok: true; status: number; body: unknown } | { ok: false; status: number; code: string }>): OverviewCall & { seen: string[] } => {
  const seen: string[] = [];
  const call = (async (op, input) => { seen.push(`${op} ${input.params.documentId}`); return byOp[op] ?? { ok: false, status: 503, code: "unavailable" }; }) as OverviewCall & { seen: string[] };
  call.seen = seen;
  return call;
};

describe("MK-11 reads", () => {
  it("joins the milestone states and the slots of one work", async () => {
    const call = answering({
      "work.milestone-states.get": { ok: true, status: 200, body: { milestones: [MILESTONE] } },
      "work.consultation-slots.get": { ok: true, status: 200, body: { slots: [SLOT] } },
    });
    const read = await readProgress(call, "izmisljeni-rad-1");
    expect(read.kind).toBe("ready");
    if (read.kind === "ready") expect([read.milestones[0]?.state, read.slots[0]?.state]).toEqual(["submitted", "requested"]);
  });

  it("an answer outside the contract, a failure or a throw is unavailable; 401 is signed out", async () => {
    const good = { ok: true as const, status: 200, body: { slots: [] } };
    expect((await readProgress(answering({ "work.milestone-states.get": { ok: true, status: 200, body: { milestones: [{ title: "x" }] } }, "work.consultation-slots.get": good }), "d")).kind).toBe("unavailable");
    expect((await readProgress(answering({ "work.consultation-slots.get": good }), "d")).kind).toBe("unavailable");
    expect((await readProgress(answering({ "work.milestone-states.get": { ok: false, status: 401, code: "unauthorized" }, "work.consultation-slots.get": good }), "d")).kind).toBe("signedOut");
    expect((await readProgress((async () => { throw new Error("mreža"); }) as OverviewCall, "d")).kind).toBe("unavailable");
  });

  it("reads only started works that are not yet submitted", async () => {
    const base = { assignmentId: "00000000-0000-4000-8000-000000000100", student: null, title: "Izmišljeni rad", workType: "bachelor_thesis" as const };
    const works: MentoredWork[] = [
      { ...base, mentorshipId: "m1", documentId: "d1", workState: "in_progress" },
      { ...base, mentorshipId: "m2", documentId: null, workState: "not_started" },
      { ...base, mentorshipId: "m3", documentId: "d3", workState: "submitted" },
    ];
    const call = answering({});
    const read = await readOverview(call, works);
    expect([...read.keys()]).toEqual(["m1"]);
    expect(call.seen.sort()).toEqual(["work.consultation-slots.get d1", "work.milestone-states.get d1"]);
  });
});
