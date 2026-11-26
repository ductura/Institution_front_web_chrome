import { describe, expect, it, vi } from "vitest";

import { seesLine } from "./SubmissionRules";
import { applyRules, bodyExtras, defaultChoices, groupsMissing, readGroups, readRules, setDeclarationRequired, setLateSubmission, setWithdrawal, type Call } from "./rules";

const ok = (body: unknown) => ({ ok: true, status: 200, body });
const callOf = (answer: (id: string, input: { body?: unknown }) => unknown) =>
  vi.fn(async (id: string, input: { body?: unknown }) => answer(id, input)) as unknown as Call & ReturnType<typeof vi.fn>;

describe("groups and extra create fields (NZ-3)", () => {
  it("reads the groups, and a failed read is unavailable, never an empty list", async () => {
    const good = callOf(() => ok({ groups: [{ id: "g1", name: "A", teachers: [], students: 3 }, { id: "g2", name: "B", teachers: [], students: 2 }] }));
    expect(await readGroups(good, "c1")).toEqual({ kind: "ready", groups: [{ id: "g1", name: "A" }, { id: "g2", name: "B" }] });
    expect(await readGroups(callOf(() => ({ ok: false, status: 503, code: "unavailable" })), "c1")).toEqual({ kind: "unavailable" });
    expect(await readGroups(callOf(() => { throw new Error("x"); }), "c1")).toEqual({ kind: "unavailable" });
    const twice = callOf(() => ok({ groups: [{ id: "g1", name: "A" }, { id: "g1", name: "B" }] }));
    expect(await readGroups(twice, "c1")).toEqual({ kind: "unavailable" });
  });

  it("sends groupIds only when groups are read and ticked; tools and summary always as booleans", () => {
    expect(bodyExtras(defaultChoices)).toEqual({ externalToolsAllowed: true, aiSummaryOnly: false });
    expect(bodyExtras({ ...defaultChoices, groupIds: ["g1"], externalTools: false, summaryOnly: true }, 2))
      .toEqual({ groupIds: ["g1"], externalToolsAllowed: false, aiSummaryOnly: true });
  });

  it("leaves groupIds out when every group is ticked, so a course with more than 20 groups still publishes", () => {
    expect(bodyExtras({ ...defaultChoices, groupIds: ["g1", "g2"] }, 2)).toEqual({ externalToolsAllowed: true, aiSummaryOnly: false });
    const many = Array.from({ length: 25 }, (_, i) => `g${i}`);
    expect(bodyExtras({ ...defaultChoices, groupIds: many }, 25)).not.toHaveProperty("groupIds");
    // A narrowed list is never dropped: past the contract maximum the server refuses it, the assignment is not widened.
    expect(bodyExtras({ ...defaultChoices, groupIds: many.slice(0, 21) }, 25)).toHaveProperty("groupIds");
  });

  it("asks for at least one group only when the course has groups", () => {
    const ready = { kind: "ready", groups: [{ id: "g1", name: "A" }] } as const;
    expect(groupsMissing(ready, { ...defaultChoices, groupIds: [] })).toBe(true);
    expect(groupsMissing(ready, { ...defaultChoices, groupIds: ["g1"] })).toBe(false);
    expect(groupsMissing({ kind: "ready", groups: [] }, { ...defaultChoices, groupIds: [] })).toBe(false);
    expect(groupsMissing({ kind: "unavailable" }, defaultChoices)).toBe(false);
    expect(groupsMissing(null, defaultChoices)).toBe(false);
  });
});

describe("submission rules switches (NZ-4)", () => {
  it("counts a switch as set only when the answer repeats the value sent (B-6)", async () => {
    expect(await setWithdrawal(callOf((_id, i) => ok({ allowed: (i.body as { allowed: boolean }).allowed, changedAt: null })), "a1", false)).toBe("set");
    expect(await setWithdrawal(callOf(() => ok({ allowed: true, changedAt: null })), "a1", false)).toBe("failed");
    expect(await setWithdrawal(callOf(() => ({ ok: false, status: 401, code: "unauthorized" })), "a1", false)).toBe("signedOut");
    expect(await setDeclarationRequired(callOf(() => ok({ required: false, changedAt: null })), "a1", false)).toBe("set");
    expect(await setDeclarationRequired(callOf(() => { throw new Error("x"); }), "a1", false)).toBe("failed");
  });

  it("sets after the create answer only the switches that differ from the defaults", async () => {
    const call = callOf((id, i) => ok(id.includes("withdrawal") ? { allowed: (i.body as { allowed: boolean }).allowed, changedAt: null } : { required: (i.body as { required: boolean }).required, changedAt: null }));
    expect(await applyRules(call, "a1", defaultChoices)).toEqual([]);
    expect(call).not.toHaveBeenCalled();
    expect(await applyRules(call, "a1", { ...defaultChoices, withdrawal: false })).toEqual([]);
    expect(call).toHaveBeenCalledTimes(1);
    const failing = callOf(() => ({ ok: false, status: 503, code: "unavailable" }));
    expect(await applyRules(failing, "a1", { ...defaultChoices, withdrawal: false, declarationRequired: false })).toEqual(["withdrawal", "declaration"]);
  });

  it("sets the late rule through institution.assignment-late-submission.put only when turned off (F4-NAS-R01)", async () => {
    const echo = callOf((_id, i) => ok({ lateSubmissionAllowed: (i.body as { lateSubmissionAllowed: boolean }).lateSubmissionAllowed }));
    expect(await setLateSubmission(echo, "a1", false)).toBe("set");
    expect(echo).toHaveBeenCalledWith("institution.assignment-late-submission.put", { params: { assignmentId: "a1" }, query: undefined, body: { lateSubmissionAllowed: false } });
    expect(await setLateSubmission(callOf(() => ok({ lateSubmissionAllowed: true })), "a1", false)).toBe("failed");
    expect(await setLateSubmission(callOf(() => ({ ok: false, status: 401, code: "unauthorized" })), "a1", false)).toBe("signedOut");
    expect(await setLateSubmission(callOf(() => ({ ok: false, status: 404, code: "not_found" })), "a1", false)).toBe("failed");
    expect(await setLateSubmission(callOf(() => { throw new Error("x"); }), "a1", false)).toBe("failed");
    const call = callOf((_id, i) => ok({ lateSubmissionAllowed: (i.body as { lateSubmissionAllowed: boolean }).lateSubmissionAllowed }));
    expect(await applyRules(call, "a1", defaultChoices)).toEqual([]);
    expect(call).not.toHaveBeenCalled();
    expect(await applyRules(call, "a1", { ...defaultChoices, lateAllowed: false })).toEqual([]);
    expect(call).toHaveBeenCalledTimes(1);
    const failing = callOf(() => ({ ok: false, status: 503, code: "unavailable" }));
    expect(await applyRules(failing, "a1", { ...defaultChoices, lateAllowed: false })).toEqual(["late"]);
  });

  it("reads both switches, and either failing is unavailable", async () => {
    const both = callOf((id) => ok(id.includes("withdrawal") ? { allowed: false, changedAt: null } : { required: true, changedAt: null }));
    expect(await readRules(both, "a1")).toEqual({ kind: "ready", rules: { withdrawal: false, declarationRequired: true } });
    const half = callOf((id) => (id.includes("withdrawal") ? ok({ allowed: true, changedAt: null }) : { ok: false, status: 503, code: "unavailable" }));
    expect(await readRules(half, "a1")).toEqual({ kind: "unavailable" });
    expect(await readRules(callOf(() => ({ ok: false, status: 401, code: "unauthorized" })), "a1")).toEqual({ kind: "signedOut" });
  });

  it("reads the late rule through teacher.assignment-late-submission.get; a failed late read leaves only that rule unknown (F4-NAS-R01)", async () => {
    const three = (late: () => unknown) => callOf((id) => id === "teacher.assignment-late-submission.get" ? late()
      : ok(id.includes("withdrawal") ? { allowed: true, changedAt: null } : { required: false, changedAt: null }));
    const known = three(() => ok({ lateSubmissionAllowed: false }));
    expect(await readRules(known, "a1")).toEqual({ kind: "ready", rules: { withdrawal: true, declarationRequired: false, lateAllowed: false } });
    expect(known).toHaveBeenCalledWith("teacher.assignment-late-submission.get", { params: { assignmentId: "a1" }, query: undefined, body: undefined });
    for (const late of [() => ({ ok: false, status: 503, code: "unavailable" }), () => ({ ok: false, status: 404, code: "not_found" }), () => { throw new Error("x"); }, () => ok({})]) {
      const result = await readRules(three(late), "a1");
      expect(result).toEqual({ kind: "ready", rules: { withdrawal: true, declarationRequired: false } });
      expect(result.kind === "ready" && "lateAllowed" in result.rules).toBe(false);
    }
    expect(await readRules(three(() => ({ ok: false, status: 401, code: "unauthorized" })), "a1")).toEqual({ kind: "signedOut" });
  });

  it("tells the student's view in the prototype wording", () => {
    expect(seesLine({ withdrawal: false, declarationRequired: false })).toBe("Student na koraku predaje vidi: predaju ne može povući; izjavu ne mora ispuniti.");
    expect(seesLine({ withdrawal: false, declarationRequired: false, lateAllowed: false }))
      .toBe("Student na koraku predaje vidi: nakon roka ne može predati; predaju ne može povući; izjavu ne mora ispuniti.");
  });
});
