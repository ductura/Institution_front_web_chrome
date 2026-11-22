import { describe, expect, it } from "vitest";

import { maySubmit, nextMilestone, submitMilestone, unavailableSubmit, type StudentMilestone } from "./milestone-submit";

const m = (id: string, state: StudentMilestone["state"]): StudentMilestone => ({ id, title: `Etapa ${id}`, description: "", dueAt: null, state });
const ID = "aaaaaaaa-0000-4000-8000-000000000001";

describe("nextMilestone", () => {
  it("is the first milestone not yet approved", () => {
    expect(nextMilestone([m("1", "approved"), m("2", "returned"), m("3", "open")])?.id).toBe("2");
    expect(nextMilestone([m("1", "approved")])).toBeNull();
  });
  it("lets the student send only open or returned", () => {
    expect(["open", "returned", "submitted", "approved"].map((s) => maySubmit(m("1", s as StudentMilestone["state"])))).toEqual([true, true, false, false]);
  });
});

describe("submitMilestone", () => {
  it("is saved only when the answer names the same milestone as submitted", async () => {
    const ok = await submitMilestone(async () => ({ ok: true, status: 200, body: { ...m(ID, "submitted") } }), "d", ID);
    expect(ok.kind).toBe("saved");
    expect((await submitMilestone(async () => ({ ok: true, status: 200, body: m("other", "submitted") }), "d", ID)).kind).toBe("nepoznato");
    expect((await submitMilestone(async () => ({ ok: true, status: 200, body: m(ID, "open") }), "d", ID)).kind).toBe("nepoznato");
  });
  it("maps 401, 409 and everything else", async () => {
    const fail = (status: number) => submitMilestone(async () => ({ ok: false, status }), "d", ID);
    expect((await fail(401)).kind).toBe("session-expired");
    expect((await fail(409)).kind).toBe("promijenjeno");
    expect((await fail(503)).kind).toBe("nepoznato");
    expect((await submitMilestone(async () => { throw new Error("x"); }, "d", ID)).kind).toBe("nepoznato");
    expect((await submitMilestone(unavailableSubmit, "d", ID)).kind).toBe("nepoznato");
  });
});
