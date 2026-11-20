// WEB-1113 (N-13): the client of deadline extensions over invented answers only.
import { describe, expect, it } from "vitest";

import {
  createDeadlineExtension, extensionInput, readDeadlineExtensions,
  type DeadlineExtension, type ExtensionCall, type ExtensionInput,
} from "./deadline-extensions";

const A = "2d8b3e4a-6c7f-4a01-9c3d-4e5f6a7b8c01";
const S = "2d8b3e4a-6c7f-4a01-9c3d-4e5f6a7b8c02";
const ext = (over: Partial<DeadlineExtension> = {}): DeadlineExtension => ({
  extensionId: "2d8b3e4a-6c7f-4a01-9c3d-4e5f6a7b8c10", scope: "student", studentId: S, studentName: "Izmišljena Studentica",
  previousDueAt: "2026-12-14T22:59:00Z", dueAt: "2026-12-20T22:59:00Z", reasonId: "justified", recordedAt: "2026-12-10T09:00:00Z", ...over,
});
const answer = (status: number, body: unknown): ExtensionCall => async () => ({ ok: true, status, body });

describe("extensionInput", () => {
  const form = { scope: "student" as const, studentId: S, dueLocal: "2026-12-20T23:59", reasonId: "justified" };

  it("sends the Zagreb minute as the UTC instant (winter time is UTC+1)", () => {
    expect(extensionInput(form)).toEqual({ ok: true, input: { scope: "student", studentId: S, dueAt: "2026-12-20T22:59:00.000Z", reasonId: "justified" } });
  });

  it("uses summer time in summer (UTC+2)", () => {
    const r = extensionInput({ ...form, dueLocal: "2027-06-20T23:59" });
    expect(r.ok && r.input.dueAt).toBe("2027-06-20T21:59:00.000Z");
  });

  it("drops the student for all and requires one for a single student", () => {
    expect(extensionInput({ ...form, scope: "all" })).toEqual({ ok: true, input: { scope: "all", dueAt: "2026-12-20T22:59:00.000Z", reasonId: "justified" } });
    expect(extensionInput({ ...form, studentId: "" })).toEqual({ ok: false, problem: "student" });
  });

  it("rejects an invalid deadline or a reason outside the closed list", () => {
    expect(extensionInput({ ...form, dueLocal: "" })).toEqual({ ok: false, problem: "due" });
    expect(extensionInput({ ...form, dueLocal: "2026-02-30T10:00" })).toEqual({ ok: false, problem: "due" });
    expect(extensionInput({ ...form, reasonId: "other" })).toEqual({ ok: false, problem: "reason" });
  });
});

describe("readDeadlineExtensions", () => {
  it("reads 200 {extensions}, also an empty list", async () => {
    expect(await readDeadlineExtensions(answer(200, { extensions: [ext()] }), A)).toEqual({ kind: "ready", extensions: [ext()] });
    expect(await readDeadlineExtensions(answer(200, { extensions: [] }), A)).toEqual({ kind: "ready", extensions: [] });
  });

  it("calls GET without a body", async () => {
    const seen: unknown[] = [];
    await readDeadlineExtensions(async (id, input) => { seen.push(id, input); return { ok: true, status: 200, body: { extensions: [] } }; }, A);
    expect(seen).toEqual(["teacher.deadline-extensions.get", { params: { assignmentId: A } }]);
  });

  it("treats unknown fields, wrong status and contradictory scope as unknown, never as none", async () => {
    expect(await readDeadlineExtensions(answer(200, { extensions: [], x: 1 }), A)).toEqual({ kind: "nepoznato" });
    expect(await readDeadlineExtensions(answer(204, null), A)).toEqual({ kind: "nepoznato" });
    expect(await readDeadlineExtensions(answer(200, { extensions: [ext({ scope: "all" })] }), A)).toEqual({ kind: "nepoznato" });
    expect(await readDeadlineExtensions(async () => { throw new Error("net"); }, A)).toEqual({ kind: "nepoznato" });
  });

  it("maps 401 to session-expired", async () => {
    expect(await readDeadlineExtensions(async () => ({ ok: false, status: 401, code: "session_expired" }), A)).toEqual({ kind: "session-expired" });
  });
});

describe("createDeadlineExtension", () => {
  const input: ExtensionInput = { scope: "student", studentId: S, dueAt: "2026-12-20T22:59:00.000Z", reasonId: "justified" };

  it("is recorded only when 201 names what was sent", async () => {
    const out = await createDeadlineExtension(answer(201, { extension: ext(), existingSubmissionsUnchanged: true }), A, input);
    expect(out).toEqual({ kind: "zabiljezeno", extension: ext(), existingSubmissionsUnchanged: true });
  });

  it("sends the body to POST with the assignment id", async () => {
    const seen: unknown[] = [];
    await createDeadlineExtension(async (id, i) => { seen.push(id, i); return { ok: false, status: 503, code: "x" }; }, A, input);
    expect(seen).toEqual(["teacher.deadline-extensions.post", { params: { assignmentId: A }, body: input }]);
  });

  it("is unknown when the answer is for another student, another deadline or another status", async () => {
    for (const body of [ext({ studentId: A }), ext({ dueAt: "2026-12-21T22:59:00Z" }), ext({ reasonId: "agreed" })]) {
      expect(await createDeadlineExtension(answer(201, { extension: body, existingSubmissionsUnchanged: true }), A, input)).toEqual({ kind: "nepoznato" });
    }
    expect(await createDeadlineExtension(answer(200, { extension: ext(), existingSubmissionsUnchanged: true }), A, input)).toEqual({ kind: "nepoznato" });
  });

  it("maps errors", async () => {
    const fail = (status: number): ExtensionCall => async () => ({ ok: false, status, code: "x" });
    expect(await createDeadlineExtension(fail(401), A, input)).toEqual({ kind: "session-expired" });
    expect(await createDeadlineExtension(fail(404), A, input)).toEqual({ kind: "greska", code: "not_found" });
    expect(await createDeadlineExtension(fail(422), A, input)).toEqual({ kind: "greska", code: "invalid" });
    expect(await createDeadlineExtension(fail(503), A, input)).toEqual({ kind: "nepoznato" });
  });
});
