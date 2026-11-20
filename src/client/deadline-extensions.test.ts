import { describe, expect, it, vi } from "vitest";

import { createApi } from "./api";
import { extensionBody, readDeadlineExtensions, readExtensionStudents, recordDeadlineExtension } from "./deadline-extensions";

// Every id and date below is invented.
const BASE_URL = "https://ductura.example.invalid";
const A = "00000000-0000-4000-8000-0000000000a1";
const S = "00000000-0000-4000-8000-0000000000e1";
const T = "00000000-0000-4000-8000-0000000000c1";
const DUE = "2026-12-27T22:59:00.000Z";
const EXT = {
  id: "00000000-0000-4000-8000-0000000000f1", scope: "one", studentId: S, previousDueAt: "2026-12-20T22:59:00.000Z",
  dueAt: DUE, reasonId: "justified", createdBy: T, createdAt: "2026-11-21T09:15:00.000Z",
};

function apiAnswering(status: number, body: unknown) {
  const fetchImpl = vi.fn(async (_url: URL | RequestInfo, _init?: RequestInit) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  return { api: createApi({ baseUrl: BASE_URL, fetchImpl }), fetchImpl };
}

const ERROR = (code: string, status: number) => ({ error: code, code, messageKey: "errors.x", status, requestId: T });

describe("extensionBody", () => {
  it("sends one student's extension with its instant and reason", () => {
    expect(extensionBody({ scope: "one", studentId: S, dueAt: DUE, reasonId: "technical" }))
      .toEqual({ scope: "one", studentId: S, dueAt: DUE, reasonId: "technical" });
  });
  it("sends an extension for all without a student", () => {
    expect(extensionBody({ scope: "all", studentId: S, dueAt: DUE, reasonId: "all" }))
      .toEqual({ scope: "all", dueAt: DUE, reasonId: "all" });
  });
  it("refuses what cannot be sent as typed", () => {
    for (const draft of [
      { scope: "one", studentId: "", dueAt: DUE, reasonId: "technical" },
      { scope: "one", studentId: S, dueAt: DUE, reasonId: "all" },
      { scope: "one", studentId: S, dueAt: null, reasonId: "technical" },
      { scope: "all", studentId: "", dueAt: "2026-12-27T23:59", reasonId: "all" },
      { scope: "all", studentId: "", dueAt: DUE, reasonId: "drugo" },
    ] as const) {
      expect(extensionBody(draft)).toBeNull();
    }
  });
});

describe("recordDeadlineExtension", () => {
  const draft = { scope: "one", studentId: S, dueAt: DUE, reasonId: "justified" } as const;

  it("is zabiljezeno only for the server's answer naming this extension (B-6)", async () => {
    const { api, fetchImpl } = apiAnswering(201, { extension: EXT, existingSubmissionsUnchanged: true });
    expect(await recordDeadlineExtension(api, A, draft))
      .toEqual({ kind: "zabiljezeno", extension: EXT, existingSubmissionsUnchanged: true });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(`${BASE_URL}/api/v1/teacher/assignments/${A}/deadline-extensions`);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ dueAt: DUE, reasonId: "justified", scope: "one", studentId: S });
  });

  it("an answer for another deadline or student is unknown, never a success", async () => {
    for (const other of [{ ...EXT, dueAt: "2026-12-28T22:59:00.000Z" }, { ...EXT, studentId: T }]) {
      const { api } = apiAnswering(201, { extension: other, existingSubmissionsUnchanged: false });
      expect(await recordDeadlineExtension(api, A, draft)).toEqual({ kind: "nepoznato" });
    }
  });

  it("maps the refusals; a draft that cannot be sent sends nothing", async () => {
    expect(await recordDeadlineExtension(apiAnswering(401, ERROR("unauthorized", 401)).api, A, draft)).toEqual({ kind: "session-expired" });
    expect(await recordDeadlineExtension(apiAnswering(404, ERROR("not_found", 404)).api, A, draft)).toEqual({ kind: "greska", code: "not_found" });
    expect(await recordDeadlineExtension(apiAnswering(422, ERROR("invalid_input", 422)).api, A, draft)).toEqual({ kind: "greska", code: "invalid" });
    expect(await recordDeadlineExtension(apiAnswering(503, ERROR("unavailable", 503)).api, A, draft)).toEqual({ kind: "nepoznato" });
    const { api, fetchImpl } = apiAnswering(201, {});
    expect(await recordDeadlineExtension(api, A, { ...draft, dueAt: null })).toEqual({ kind: "greska", code: "invalid" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("reads", () => {
  it("lists the extensions", async () => {
    const { api } = apiAnswering(200, { extensions: [EXT, { ...EXT, id: T, scope: "all", studentId: null, reasonId: null }] });
    const read = await readDeadlineExtensions(api, A);
    expect(read).toMatchObject({ kind: "ready", extensions: [{ reasonId: "justified" }, { reasonId: null }] });
  });
  it("a list it cannot read is unknown or an ended session, never empty", async () => {
    expect(await readDeadlineExtensions(apiAnswering(200, { extensions: [{ id: "x" }] }).api, A)).toEqual({ kind: "nepoznato" });
    expect(await readDeadlineExtensions(apiAnswering(401, ERROR("unauthorized", 401)).api, A)).toEqual({ kind: "session-expired" });
  });
  it("reads the students of the assignment, a missing name as null", async () => {
    const students = [
      { studentId: S, givenName: "Demo", familyName: "Kompost", groupName: null, submitted: false, requestedMinute: null, afterDeadline: null, evidenceRecord: null },
      { studentId: T, givenName: null, familyName: null, groupName: null, submitted: false, requestedMinute: null, afterDeadline: null, evidenceRecord: null },
    ];
    expect(await readExtensionStudents(apiAnswering(200, { students }).api, A))
      .toEqual([{ studentId: S, name: "Demo Kompost" }, { studentId: T, name: null }]);
    expect(await readExtensionStudents(apiAnswering(503, ERROR("unavailable", 503)).api, A)).toBeNull();
  });
});
