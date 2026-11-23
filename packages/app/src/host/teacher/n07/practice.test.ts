import { describe, expect, it } from "vitest";

import { readWorkPractice, type PracticeCall } from "./practice";

// Invented ids of an invented work.
const DOC = "00000000-0000-4000-8000-0000000000e1";
const ASSIGNMENT = "00000000-0000-4000-8000-0000000000e2";

function server(grade: { ok: true; status: 200; body: unknown } | { ok: false; status: number; code: string }, work: unknown = { documentId: DOC, assignmentId: ASSIGNMENT }) {
  const asked: { id: string; params: Readonly<Record<string, string>> }[] = [];
  const call: PracticeCall = async (id, input) => {
    asked.push({ id, params: input.params });
    return id === "teacher.work.get" ? { ok: true, status: 200, body: work } : grade;
  };
  return { call, asked };
}

describe("N-07 practice note (PIL-D1-BEZ-OCJENE)", () => {
  it("is shown when the work's assignment answers 409 practice_assignment", async () => {
    const s = server({ ok: false, status: 409, code: "practice_assignment" });
    expect(await readWorkPractice(s.call, DOC)).toBe(true);
    expect(s.asked).toEqual([
      { id: "teacher.work.get", params: { documentId: DOC } },
      { id: "teacher.assignment-grade.get", params: { assignmentId: ASSIGNMENT } },
    ]);
  });

  it("is not shown for a graded assignment, a failure or another work's answer", async () => {
    expect(await readWorkPractice(server({ ok: true, status: 200, body: { eligible: true } }).call, DOC)).toBe(false);
    expect(await readWorkPractice(server({ ok: false, status: 503, code: "unavailable" }).call, DOC)).toBe(false);
    const other = server({ ok: false, status: 409, code: "practice_assignment" }, { documentId: "other", assignmentId: ASSIGNMENT });
    expect(await readWorkPractice(other.call, DOC)).toBe(false);
    expect(other.asked.map((a) => a.id)).toEqual(["teacher.work.get"]);
    expect(await readWorkPractice(async () => { throw new Error("x"); }, DOC)).toBe(false);
  });
});
