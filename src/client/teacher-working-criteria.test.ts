import { describe, expect, it } from "vitest";

import vectors from "./migration-contract-vectors.generated.json";
import {
  CRITERION_IDS, NOTE_MAX, criterionSendable, readWorkingCriteria, saveWorkingCriterion,
  type CriteriaCall, type WorkingCriterion,
} from "./teacher-working-criteria";

const DOC = "izmisljeni-rad-0001";
const six = (): WorkingCriterion[] =>
  CRITERION_IDS.map((id) => ({ id, label: `workingCriteria.${id}`, assessment: null, note: null }));
const ok = (body: unknown, status = 200): CriteriaCall => async () => ({ ok: true, status, body });
const fail = (status: number): CriteriaCall => async () => ({ ok: false, status, code: "x" });
type Vector = { route: string; name: string; request: { params?: Record<string, string>; body?: unknown }; response: { status: number; body?: unknown } };
const vector = (route: string, name: string): Vector => {
  const found = (vectors as Vector[]).find((v) => v.route === route && v.name === name);
  if (!found) throw new Error(`missing vector ${route}:${name}`);
  return found;
};

describe("readWorkingCriteria", () => {
  it("reads the server's six-criteria answer from the contract vectors", async () => {
    const v = vector("teacher.working-criteria.get", "six-criteria");
    const read = await readWorkingCriteria(ok(v.response.body), DOC);
    expect(read).toEqual({ kind: "ready", criteria: (v.response.body as { criteria: unknown }).criteria });
  });
  it("returns all six criteria from a 200 and sends the work id as a path param", async () => {
    const seen: unknown[] = [];
    const call: CriteriaCall = async (op, input) => { seen.push([op, input]); return { ok: true, status: 200, body: { criteria: six() } }; };
    const read = await readWorkingCriteria(call, DOC);
    expect(read).toEqual({ kind: "ready", criteria: six() });
    expect(seen).toEqual([["teacher.working-criteria.get", { params: { documentId: DOC }, query: undefined }]]);
  });
  it("is unknown for five, seven, duplicate or unknown ids, unknown fields, a sentence label or a non-200", async () => {
    const unknown = async (body: unknown, status = 200) => (await readWorkingCriteria(ok(body, status), DOC)).kind;
    expect(await unknown({ criteria: six().slice(1) })).toBe("nepoznato");
    expect(await unknown({ criteria: [...six(), six()[0]] })).toBe("nepoznato");
    expect(await unknown({ criteria: six().map((c) => ({ ...c, id: "topic" })) })).toBe("nepoznato");
    expect(await unknown({ criteria: six().map((c, i) => (i === 0 ? { ...c, id: "grade" } : c)) })).toBe("nepoznato");
    expect(await unknown({ criteria: six().map((c) => ({ ...c, extra: 1 })) })).toBe("nepoznato");
    expect(await unknown({ criteria: six().map((c) => ({ ...c, label: "Tema rada" })) })).toBe("nepoznato");
    expect(await unknown({ criteria: six().map((c) => ({ ...c, assessment: 3 })) })).toBe("nepoznato");
    expect(await unknown({ criteria: six() }, 204)).toBe("nepoznato");
  });
  it("maps 401, 404, other failures, a throwing transport and an invalid work id", async () => {
    expect((await readWorkingCriteria(fail(401), DOC)).kind).toBe("session-expired");
    expect(await readWorkingCriteria(fail(404), DOC)).toEqual({ kind: "greska", code: "not_found" });
    expect((await readWorkingCriteria(fail(503), DOC)).kind).toBe("nepoznato");
    expect((await readWorkingCriteria(async () => { throw new Error("offline"); }, DOC)).kind).toBe("nepoznato");
    for (const bad of ["", " rad", "rad\n", "a".repeat(257)]) {
      expect(await readWorkingCriteria(ok({}), bad)).toEqual({ kind: "greska", code: "invalid" });
    }
  });
});

describe("saveWorkingCriterion", () => {
  const saved = (over: Partial<WorkingCriterion>): WorkingCriterion => ({ ...six()[0]!, ...over });
  it("saves the server's saved-with-note and cleared vectors", async () => {
    for (const name of ["saved-with-note", "cleared"]) {
      const v = vector("teacher.working-criterion.put", name);
      const criterionId = v.request.params!.criterionId as WorkingCriterion["id"];
      const out = await saveWorkingCriterion(ok(v.response.body), v.request.params!.documentId!, criterionId, v.request.body as never);
      expect(out).toEqual({ kind: "saved", criterion: v.response.body });
    }
  });
  it("puts {assessment, note} with both path params and accepts the matching answer", async () => {
    const seen: unknown[] = [];
    const call: CriteriaCall = async (op, input) => { seen.push([op, input]); return { ok: true, status: 200, body: saved({ assessment: 1, note: "Dobro." }) }; };
    const out = await saveWorkingCriterion(call, DOC, "topic", { assessment: 1, note: "Dobro." });
    expect(out).toEqual({ kind: "saved", criterion: saved({ assessment: 1, note: "Dobro." }) });
    expect(seen).toEqual([["teacher.working-criterion.put", {
      params: { documentId: DOC, criterionId: "topic" }, query: undefined, body: { assessment: 1, note: "Dobro." },
    }]]);
  });
  it("clears an assessment with null", async () => {
    expect((await saveWorkingCriterion(ok(saved({})), DOC, "topic", { assessment: null, note: null })).kind).toBe("saved");
  });
  it("is unknown when the answer names another criterion or other values", async () => {
    expect((await saveWorkingCriterion(ok(saved({ id: "method", assessment: 1 })), DOC, "topic", { assessment: 1, note: null })).kind).toBe("nepoznato");
    expect((await saveWorkingCriterion(ok(saved({ assessment: 2 })), DOC, "topic", { assessment: 1, note: null })).kind).toBe("nepoznato");
    expect((await saveWorkingCriterion(ok(saved({ note: "Drugo." })), DOC, "topic", { assessment: null, note: null })).kind).toBe("nepoznato");
    expect((await saveWorkingCriterion(ok(saved({}), 201), DOC, "topic", { assessment: null, note: null })).kind).toBe("nepoznato");
  });
  it("sends nothing for a blank or over-long note, an unknown assessment, criterion or work id", async () => {
    let calls = 0;
    const call: CriteriaCall = async () => { calls++; return { ok: true, status: 200, body: saved({}) }; };
    expect(criterionSendable({ assessment: null, note: "  " })).toBe(false);
    expect(criterionSendable({ assessment: null, note: "a".repeat(NOTE_MAX) })).toBe(true);
    expect(criterionSendable({ assessment: null, note: "a".repeat(NOTE_MAX + 1) })).toBe(false);
    expect(criterionSendable({ assessment: 3 as never, note: null })).toBe(false);
    expect(criterionSendable({ assessment: "good" as never, note: null })).toBe(false);
    for (const input of [{ assessment: null, note: " " }, { assessment: null, note: "a".repeat(NOTE_MAX + 1) }]) {
      expect(await saveWorkingCriterion(call, DOC, "topic", input)).toEqual({ kind: "greska", code: "invalid" });
    }
    expect(await saveWorkingCriterion(call, DOC, "ocjena" as never, { assessment: 1, note: null })).toEqual({ kind: "greska", code: "invalid" });
    expect(await saveWorkingCriterion(call, " rad", "topic", { assessment: 1, note: null })).toEqual({ kind: "greska", code: "invalid" });
    expect(calls).toBe(0);
  });
  it("maps 401, 404, 422, 503 and a throw", async () => {
    const input = { assessment: 1, note: null } as const;
    expect((await saveWorkingCriterion(fail(401), DOC, "topic", input)).kind).toBe("session-expired");
    expect(await saveWorkingCriterion(fail(404), DOC, "topic", input)).toEqual({ kind: "greska", code: "not_found" });
    expect(await saveWorkingCriterion(fail(422), DOC, "topic", input)).toEqual({ kind: "greska", code: "invalid" });
    expect((await saveWorkingCriterion(fail(503), DOC, "topic", input)).kind).toBe("nepoznato");
    expect((await saveWorkingCriterion(async () => { throw new Error("x"); }, DOC, "topic", input)).kind).toBe("nepoznato");
  });
});
