import { describe, expect, it } from "vitest";

import {
  readStudentCriteria, teacherNameText, type StudentCriteriaCall, type TeacherCriteria,
} from "./student-working-criteria";
import { CRITERION_IDS, type WorkingCriterion } from "./teacher-working-criteria";

const DOC = "izmisljeni-rad-0001";
const A1 = "00000000-0000-4000-8000-0000000000a1";
const A2 = "00000000-0000-4000-8000-0000000000a2";
const six = (assessment: WorkingCriterion["assessment"] = null): WorkingCriterion[] =>
  CRITERION_IDS.map((id) => ({ id, label: `workingCriteria.${id}`, assessment, note: null }));
// The shape of the server's vector "each-teacher-separately" (Institution_server#838).
const TWO: TeacherCriteria[] = [
  { teacherId: A1, teacherName: { givenName: "Izmišljena", familyName: "Nastavnica" }, criteria: six(2) },
  { teacherId: A2, teacherName: null, criteria: six() },
];
const ok = (body: unknown, status = 200): StudentCriteriaCall => async () => ({ ok: true, status, body });
const fail = (status: number): StudentCriteriaCall => async () => ({ ok: false, status, code: "x" });

describe("readStudentCriteria", () => {
  it("reads each teacher separately and sends the work id as a path param", async () => {
    const seen: unknown[] = [];
    const call: StudentCriteriaCall = async (op, input) => { seen.push([op, input]); return { ok: true, status: 200, body: { teachers: TWO } }; };
    expect(await readStudentCriteria(call, DOC)).toEqual({ kind: "ready", teachers: TWO });
    expect(seen).toEqual([["student.working-criteria.get", { params: { documentId: DOC }, query: undefined }]]);
  });

  it("reads an empty list while no teacher has set a criterion", async () => {
    expect(await readStudentCriteria(ok({ teachers: [] }), DOC)).toEqual({ kind: "ready", teachers: [] });
  });

  it("is unknown for a teacher twice, five criteria, a duplicate id, an unknown field, a bad id or name, or a non-200", async () => {
    const kind = async (body: unknown, status = 200) => (await readStudentCriteria(ok(body, status), DOC)).kind;
    expect(await kind({ teachers: [TWO[0], TWO[0]] })).toBe("nepoznato");
    expect(await kind({ teachers: [{ ...TWO[0], criteria: six().slice(1) }] })).toBe("nepoznato");
    expect(await kind({ teachers: [{ ...TWO[0], criteria: six().map((c) => ({ ...c, id: "topic" })) }] })).toBe("nepoznato");
    expect(await kind({ teachers: [{ ...TWO[0], extra: 1 }] })).toBe("nepoznato");
    expect(await kind({ teachers: [{ ...TWO[0], teacherId: "a1" }] })).toBe("nepoznato");
    expect(await kind({ teachers: [{ ...TWO[0], teacherName: { givenName: "", familyName: "X" } }] })).toBe("nepoznato");
    expect(await kind({ teachers: [{ ...TWO[0], teacherName: "Izmišljena Nastavnica" }] })).toBe("nepoznato");
    expect(await kind({ criteria: six() })).toBe("nepoznato");
    expect(await kind({ teachers: TWO }, 201)).toBe("nepoznato");
  });

  it("maps 401 to session-expired, 404 to not_found and anything else, or a throw, to unknown", async () => {
    expect(await readStudentCriteria(fail(401), DOC)).toEqual({ kind: "session-expired" });
    expect(await readStudentCriteria(fail(404), DOC)).toEqual({ kind: "greska", code: "not_found" });
    expect((await readStudentCriteria(fail(503), DOC)).kind).toBe("nepoznato");
    expect((await readStudentCriteria(async () => { throw new Error("mreža"); }, DOC)).kind).toBe("nepoznato");
  });

  it("sends nothing for a malformed work id", async () => {
    let called = false;
    const call: StudentCriteriaCall = async () => { called = true; return { ok: true, status: 200, body: { teachers: [] } }; };
    expect(await readStudentCriteria(call, " rad ")).toEqual({ kind: "greska", code: "invalid" });
    expect(called).toBe(false);
  });
});

describe("teacherNameText", () => {
  it("joins the name pair and keeps null when the server holds no name", () => {
    expect(teacherNameText({ givenName: "Izmišljena", familyName: "Nastavnica" })).toBe("Izmišljena Nastavnica");
    expect(teacherNameText(null)).toBeNull();
  });
});
