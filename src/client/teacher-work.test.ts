import { describe, expect, it, vi } from "vitest";

import { readTeacherWorkAccess, readTeacherWorkReceipt } from "./teacher-work";
import vectors from "./migration-contract-vectors.generated.json" with { type: "json" };

const baseUrl = "https://ductura.example.invalid";
const profile = vectors.find((v) => v.route === "profile.me.get" && v.name === "teacher-without-name")!.response.body;
const doc = "izmisljeni-rad-1";
const assignmentId = "00000000-0000-4000-8000-0000000000a1";
const studentId = "00000000-0000-4000-8000-0000000000e1";
const work = { documentId: doc, assignmentId, studentId, studentName: "Iva Izmišljena", state: "ceka",
  prevDocumentId: null, nextDocumentId: null };
const reply = (status: number, body: unknown) => Response.json(body, { status });

describe("teacher work access", () => {
  it("requires an allowed role and the current login's tag", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(reply(200, { access: "allowed", scope: "a".repeat(64) }))
      .mockResolvedValueOnce(reply(200, profile));

    expect(await readTeacherWorkAccess({ baseUrl, fetchImpl })).toMatchObject({
      kind: "ready", value: { tag: "sessionTag" in profile ? profile.sessionTag : undefined, at: expect.any(Number) },
    });
    expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual([
      `${baseUrl}/api/v1/teacher/access`, `${baseUrl}/api/v1/me`,
    ]);
  });

  it.each([
    [200, { access: "denied", scope: "a".repeat(64) }, "notTeacher"],
    [401, { error: "unauthorized" }, "signedOut"],
    [503, { error: "unavailable" }, "unavailable"],
  ])("stops before the profile read for %i %j", async (status, body, kind) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(reply(status, body));
    expect(await readTeacherWorkAccess({ baseUrl, fetchImpl })).toEqual({ kind });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("teacher work receipt", () => {
  it("looks up the student and assignment before reading their receipt", async () => {
    const requestedAt = "2026-11-20T12:00:00.000Z";
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(reply(200, work))
      .mockResolvedValueOnce(reply(200, { state: "ceka", revision: 1, requestedAt }));
    expect(await readTeacherWorkReceipt(doc, () => true, { baseUrl, fetchImpl })).toEqual({
      kind: "ready", state: "ceka", studentName: work.studentName, submission: { kind: "ceka", revision: 1, requestedAt },
    });
    expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual([
      `${baseUrl}/api/v1/teacher/works/${doc}`, `${baseUrl}/api/v1/teacher/assignments/${assignmentId}/students/${studentId}/submission`,
    ]);
  });

  it("does not ask for a receipt from a different work or after the session ends", async () => {
    const wrong = vi.fn<typeof fetch>().mockResolvedValueOnce(reply(200, { ...work, documentId: "izmisljeni-drugi" }));
    expect(await readTeacherWorkReceipt(doc, () => true, { baseUrl, fetchImpl: wrong })).toEqual({ kind: "unavailable" });
    expect(wrong).toHaveBeenCalledTimes(1);

    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(reply(200, work));
    const current = () => fetchImpl.mock.calls.length === 0;
    expect(await readTeacherWorkReceipt(doc, current, { baseUrl, fetchImpl })).toEqual({ kind: "signedOut" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([[401, "signedOut"], [404, "notFound"], [503, "unavailable"]])(
    "preserves the receipt read's %i", async (status, kind) => {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(reply(200, work))
        .mockResolvedValueOnce(reply(status, {}));
      expect(await readTeacherWorkReceipt(doc, () => true, { baseUrl, fetchImpl })).toEqual({ kind });
    },
  );
});
