import { describe, expect, it, vi } from "vitest";

import { maySubmit, nextMilestone, readStudentMilestones, submitMilestone, type StudentMilestone } from "./milestone-submit";

const ID = "aaaaaaaa-0000-4000-8000-000000000001";
const m = (id: string, state: StudentMilestone["state"]): StudentMilestone => ({
  id, title: `Etapa ${id}`, description: "", dueAt: null, state, everSubmitted: false, submittedRevisionId: null, submittedAt: null,
  revisionComment: null, revisionDueAt: null, revisionRequestedAt: null, approvedAt: null, approvalMessage: null,
});
const answer = (value: unknown) => vi.fn(async () => value) as never;

describe("nextMilestone and maySubmit", () => {
  it("is the first milestone not yet approved", () => {
    expect(nextMilestone([m("1", "approved"), m("2", "revision_requested"), m("3", "not_submitted")])?.id).toBe("2");
    expect(nextMilestone([m("1", "approved")])).toBeNull();
  });
  it("lets the student send only a not sent or returned milestone", () => {
    const states = ["not_submitted", "revision_requested", "submitted", "approved"] as const;
    expect(states.map((s) => maySubmit(m("1", s)))).toEqual([true, true, false, false]);
  });
});

describe("server operations", () => {
  it("reads the states and posts the submit with the milestone in the params", async () => {
    const api = vi.fn(async () => ({ ok: true, status: 200, body: { milestones: [] } }));
    await readStudentMilestones("d", api as never);
    await submitMilestone("d", ID, api as never);
    expect(api.mock.calls.map((c) => [(c as unknown[])[0], (c as unknown[])[1]])).toEqual([
      ["work.milestone-states.get", { params: { documentId: "d" }, query: undefined, body: undefined }],
      ["work.milestones.submit.post", { params: { documentId: "d", milestoneId: ID }, query: undefined, body: undefined }],
    ]);
  });
});

describe("submitMilestone", () => {
  it("is saved only when the answer names the same milestone as submitted", async () => {
    expect((await submitMilestone("d", ID, answer({ ok: true, status: 200, body: m(ID.toUpperCase(), "submitted") }))).kind).toBe("saved");
    expect((await submitMilestone("d", ID, answer({ ok: true, status: 200, body: m("other", "submitted") }))).kind).toBe("nepoznato");
    expect((await submitMilestone("d", ID, answer({ ok: true, status: 200, body: m(ID, "not_submitted") }))).kind).toBe("nepoznato");
  });
  it("maps 401, 409 and everything else", async () => {
    const fail = (status: number) => submitMilestone("d", ID, answer({ ok: false, status }));
    expect((await fail(401)).kind).toBe("session-expired");
    expect((await fail(409)).kind).toBe("promijenjeno");
    expect((await fail(503)).kind).toBe("nepoznato");
    expect((await submitMilestone("d", ID, vi.fn(async () => { throw new Error("x"); }) as never)).kind).toBe("nepoznato");
  });
});
