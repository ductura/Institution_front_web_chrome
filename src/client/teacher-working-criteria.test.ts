import { describe, expect, it } from "vitest";

import {
  CRITERIA_COUNT, NOTE_MAX, criterionSendable, readWorkingCriteria, saveWorkingCriterion,
  type CriteriaCall, type WorkingCriterion,
} from "./teacher-working-criteria";

const DOC = "aaaaaaaa-0000-4000-8000-000000000001";
const id = (n: number) => `bbbbbbbb-0000-4000-8000-00000000000${n}`;
const six = (): WorkingCriterion[] =>
  Array.from({ length: CRITERIA_COUNT }, (_, i) => ({ criterionId: id(i + 1), title: `Izmišljeni kriterij ${i + 1}`, assessment: null, note: null }));
const ok = (body: unknown, status = 200): CriteriaCall => async () => ({ ok: true, status, body });
const fail = (status: number): CriteriaCall => async () => ({ ok: false, status, code: "x" });

describe("readWorkingCriteria", () => {
  it("returns all six criteria from a 200 and sends no body", async () => {
    const seen: unknown[] = [];
    const call: CriteriaCall = async (op, input) => { seen.push([op, input]); return { ok: true, status: 200, body: { criteria: six() } }; };
    const read = await readWorkingCriteria(call, DOC);
    expect(read).toEqual({ kind: "ready", criteria: six() });
    expect(seen).toEqual([["teacher.working-criteria.get", { documentId: DOC }]]);
  });
  it("is unknown for five, seven, duplicate ids, unknown fields or a non-200", async () => {
    expect((await readWorkingCriteria(ok({ criteria: six().slice(1) }), DOC)).kind).toBe("nepoznato");
    expect((await readWorkingCriteria(ok({ criteria: [...six(), { ...six()[0], criterionId: id(7) }] }), DOC)).kind).toBe("nepoznato");
    expect((await readWorkingCriteria(ok({ criteria: six().map((c) => ({ ...c, criterionId: id(1) })) }), DOC)).kind).toBe("nepoznato");
    expect((await readWorkingCriteria(ok({ criteria: six().map((c) => ({ ...c, extra: 1 })) }), DOC)).kind).toBe("nepoznato");
    expect((await readWorkingCriteria(ok({ criteria: six() }, 204), DOC)).kind).toBe("nepoznato");
    expect((await readWorkingCriteria(ok({ criteria: six().map((c) => ({ ...c, assessment: "great" })) }), DOC)).kind).toBe("nepoznato");
  });
  it("maps 401, 404, other failures and a throwing transport", async () => {
    expect((await readWorkingCriteria(fail(401), DOC)).kind).toBe("session-expired");
    expect(await readWorkingCriteria(fail(404), DOC)).toEqual({ kind: "greska", code: "not_found" });
    expect((await readWorkingCriteria(fail(503), DOC)).kind).toBe("nepoznato");
    expect((await readWorkingCriteria(async () => { throw new Error("offline"); }, DOC)).kind).toBe("nepoznato");
    expect(await readWorkingCriteria(ok({}), "not-an-id")).toEqual({ kind: "greska", code: "invalid" });
  });
});

describe("saveWorkingCriterion", () => {
  const saved = (over: Partial<WorkingCriterion>): WorkingCriterion => ({ ...six()[0]!, ...over }) as WorkingCriterion;
  it("puts {assessment, note} with the criterion id and accepts the matching answer", async () => {
    const seen: unknown[] = [];
    const call: CriteriaCall = async (op, input) => { seen.push([op, input]); return { ok: true, status: 200, body: saved({ assessment: "good", note: "Dobro." }) }; };
    const out = await saveWorkingCriterion(call, DOC, id(1), { assessment: "good", note: "Dobro." });
    expect(out).toEqual({ kind: "saved", criterion: saved({ assessment: "good", note: "Dobro." }) });
    expect(seen).toEqual([["teacher.working-criterion.put", { documentId: DOC, criterionId: id(1), body: { assessment: "good", note: "Dobro." } }]]);
  });
  it("clears an assessment with null", async () => {
    const out = await saveWorkingCriterion(ok(saved({})), DOC, id(1), { assessment: null, note: null });
    expect(out.kind).toBe("saved");
  });
  it("is unknown when the answer names another criterion or other values", async () => {
    expect((await saveWorkingCriterion(ok(saved({ criterionId: id(2), assessment: "good" })), DOC, id(1), { assessment: "good", note: null })).kind).toBe("nepoznato");
    expect((await saveWorkingCriterion(ok(saved({ assessment: "very_good" })), DOC, id(1), { assessment: "good", note: null })).kind).toBe("nepoznato");
    expect((await saveWorkingCriterion(ok(saved({}), 201), DOC, id(1), { assessment: null, note: null })).kind).toBe("nepoznato");
  });
  it("sends nothing for a blank, over-long note or unknown assessment", async () => {
    let calls = 0;
    const call: CriteriaCall = async () => { calls++; return { ok: true, status: 200, body: saved({}) }; };
    expect(criterionSendable({ assessment: null, note: "  " })).toBe(false);
    expect(criterionSendable({ assessment: null, note: "a".repeat(NOTE_MAX + 1) })).toBe(false);
    expect(criterionSendable({ assessment: "great" as never, note: null })).toBe(false);
    for (const input of [{ assessment: null, note: " " }, { assessment: null, note: "a".repeat(NOTE_MAX + 1) }]) {
      expect(await saveWorkingCriterion(call, DOC, id(1), input)).toEqual({ kind: "greska", code: "invalid" });
    }
    expect(calls).toBe(0);
  });
  it("maps 401, 404, 422, 409/503 and a throw", async () => {
    const input = { assessment: "good", note: null } as const;
    expect((await saveWorkingCriterion(fail(401), DOC, id(1), input)).kind).toBe("session-expired");
    expect(await saveWorkingCriterion(fail(404), DOC, id(1), input)).toEqual({ kind: "greska", code: "not_found" });
    expect(await saveWorkingCriterion(fail(422), DOC, id(1), input)).toEqual({ kind: "greska", code: "invalid" });
    expect((await saveWorkingCriterion(fail(503), DOC, id(1), input)).kind).toBe("nepoznato");
    expect((await saveWorkingCriterion(async () => { throw new Error("x"); }, DOC, id(1), input)).kind).toBe("nepoznato");
  });
});
