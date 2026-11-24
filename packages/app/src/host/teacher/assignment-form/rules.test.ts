import { describe, expect, it, vi } from "vitest";

import { seesLine } from "./SubmissionRules";
import { applyRules, bodyExtras, defaultChoices, groupsMissing, readGroups, readRules, setDeclarationRequired, setWithdrawal, type Call } from "./rules";

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
    expect(bodyExtras({ ...defaultChoices, groupIds: ["g1"], externalTools: false, summaryOnly: true }))
      .toEqual({ groupIds: ["g1"], externalToolsAllowed: false, aiSummaryOnly: true });
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

  it("reads both switches, and either failing is unavailable", async () => {
    const both = callOf((id) => ok(id.includes("withdrawal") ? { allowed: false, changedAt: null } : { required: true, changedAt: null }));
    expect(await readRules(both, "a1")).toEqual({ kind: "ready", rules: { withdrawal: false, declarationRequired: true } });
    const half = callOf((id) => (id.includes("withdrawal") ? ok({ allowed: true, changedAt: null }) : { ok: false, status: 503, code: "unavailable" }));
    expect(await readRules(half, "a1")).toEqual({ kind: "unavailable" });
    expect(await readRules(callOf(() => ({ ok: false, status: 401, code: "unauthorized" })), "a1")).toEqual({ kind: "signedOut" });
  });

  it("tells the student's view in the prototype wording", () => {
    expect(seesLine({ withdrawal: false, declarationRequired: false })).toBe("Student na koraku predaje vidi: predaju ne može povući; izjavu ne mora ispuniti.");
  });
});
