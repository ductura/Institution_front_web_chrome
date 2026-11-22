import { afterEach, describe, expect, it, vi } from "vitest";

import type { StudentDataExportCall } from "./api";
import {
  approveStudentDataExport, downloadStudentDataExport, listStudentDataExports, requestStudentDataExport, studentDataExportCall,
} from "./student-data-export";

const ORIGIN = "https://ductura.example.invalid";
const EXPORT = "e1302000-0000-4000-8000-000000000001";
const STUDENT = "c1302000-0000-4000-8000-000000000001";
const TOKEN = "A".repeat(40) + "_-9";
const REQUEST = { studentId: STUDENT, identityCheckedBy: "passport", note: "IZM-2026-1" } as const;
const row = { exportId: EXPORT, state: "ready", requestedAt: "2026-11-21T10:00:00.000Z", expiresAt: "2026-11-28T10:00:00.000Z" };

type Answer = Awaited<ReturnType<StudentDataExportCall>>;
const ok = (status: number, body: unknown): Answer => ({ ok: true, status, body });
const fail = (status: number): Answer => ({ ok: false, status, code: "error" });
const calling = (answer: Answer) => vi.fn<StudentDataExportCall>(async () => answer);

afterEach(() => vi.unstubAllGlobals());

describe("listStudentDataExports", () => {
  it("returns the requests the server sent", async () => {
    const call = calling(ok(200, { exports: [row, { ...row, exportId: STUDENT, state: "requested", expiresAt: null }] }));
    const out = await listStudentDataExports(call);
    expect(out).toEqual({ kind: "ok", exports: [row, { ...row, exportId: STUDENT, state: "requested", expiresAt: null }] });
    expect(call).toHaveBeenCalledWith("institution.student-data-exports.get", {});
  });

  it.each([
    ["an unknown state", { exports: [{ ...row, state: "deleted" }] }],
    ["an extra field", { exports: [{ ...row, studentName: "Izmišljeni Student" }] }],
    ["a repeated id", { exports: [row, row] }],
    ["no list", {}],
  ])("%s is unavailable, never a partial list", async (_name, body) => {
    expect(await listStudentDataExports(calling(ok(200, body)))).toEqual({ kind: "unavailable" });
  });

  it.each([[401, "signedOut"], [403, "denied"], [503, "unavailable"], [0, "unavailable"]] as const)("status %i is %s", async (status, kind) => {
    expect(await listStudentDataExports(calling(fail(status)))).toEqual({ kind });
  });
});

describe("requestStudentDataExport", () => {
  it("sends the closed body and returns the new id after a 201", async () => {
    const call = calling(ok(201, { exportId: EXPORT }));
    expect(await requestStudentDataExport(REQUEST, call)).toEqual({ kind: "ok", exportId: EXPORT });
    expect(call).toHaveBeenCalledWith("institution.student-data-exports.post", { body: REQUEST });
  });

  it.each([
    ["an upper-case student", { ...REQUEST, studentId: STUDENT.toUpperCase() }],
    ["an unknown document", { ...REQUEST, identityCheckedBy: "driving_licence" as "passport" }],
    ["an empty note", { ...REQUEST, note: "" }],
    ["a note over 80 characters", { ...REQUEST, note: "x".repeat(81) }],
    ["a note with outer spaces", { ...REQUEST, note: " IZM " }],
  ])("%s is invalid and never sent", async (_name, input) => {
    const call = calling(ok(201, { exportId: EXPORT }));
    expect(await requestStudentDataExport(input, call)).toEqual({ kind: "invalid" });
    expect(call).not.toHaveBeenCalled();
  });

  it.each([[401, "signedOut"], [403, "denied"], [404, "notFound"], [409, "exists"], [422, "invalid"], [503, "unavailable"]] as const)(
    "status %i is %s", async (status, kind) => {
      expect(await requestStudentDataExport(REQUEST, calling(fail(status)))).toEqual({ kind });
    });

  it("a 200 or a malformed id is unavailable, never a request", async () => {
    expect(await requestStudentDataExport(REQUEST, calling(ok(200, { exportId: EXPORT })))).toEqual({ kind: "unavailable" });
    expect(await requestStudentDataExport(REQUEST, calling(ok(201, { exportId: "x" })))).toEqual({ kind: "unavailable" });
  });
});

describe("approveStudentDataExport", () => {
  it("is ok only when the answer names the same request as approved", async () => {
    const call = calling(ok(200, { exportId: EXPORT, state: "approved" }));
    expect(await approveStudentDataExport(EXPORT, "IZM-2026-7", call)).toEqual({ kind: "ok" });
    expect(call).toHaveBeenCalledWith("institution.student-data-exports-approve.post", { exportId: EXPORT, body: { reference: "IZM-2026-7" } });
    expect(await approveStudentDataExport(EXPORT, "IZM-2026-7", calling(ok(200, { exportId: STUDENT, state: "approved" })))).toEqual({ kind: "unavailable" });
  });

  it("a blank or over-long reference is invalid and never sent", async () => {
    const call = calling(ok(200, { exportId: EXPORT, state: "approved" }));
    expect(await approveStudentDataExport(EXPORT, "", call)).toEqual({ kind: "invalid" });
    expect(await approveStudentDataExport(EXPORT, "x".repeat(121), call)).toEqual({ kind: "invalid" });
    expect(call).not.toHaveBeenCalled();
  });

  it.each([[401, "signedOut"], [403, "denied"], [404, "stale"], [409, "stale"], [422, "invalid"], [503, "unavailable"]] as const)(
    "status %i is %s", async (status, kind) => {
      expect(await approveStudentDataExport(EXPORT, "IZM-2026-7", calling(fail(status)))).toEqual({ kind });
    });
});

describe("studentDataExportCall", () => {
  it("posts the approval to the encoded export path with JSON", async () => {
    vi.stubGlobal("location", { origin: ORIGIN });
    const transport = vi.fn<typeof fetch>(async () => Response.json({ exportId: EXPORT, state: "approved" }));
    const out = await studentDataExportCall(transport)("institution.student-data-exports-approve.post", { exportId: "a/b", body: { reference: "R" } });
    expect(out).toEqual({ ok: true, status: 200, body: { exportId: EXPORT, state: "approved" } });
    expect(transport).toHaveBeenCalledWith(
      new URL(`${ORIGIN}/api/v1/institution/student-data-exports/a%2Fb/approve`),
      expect.objectContaining({ method: "POST", credentials: "same-origin", body: '{"reference":"R"}' }),
    );
  });

  it("keeps the status and code of a refusal", async () => {
    vi.stubGlobal("location", { origin: ORIGIN });
    const transport = vi.fn<typeof fetch>(async () => Response.json({ code: "conflict" }, { status: 409 }));
    expect(await studentDataExportCall(transport)("institution.student-data-exports.post", { body: REQUEST })).toEqual({ ok: false, status: 409, code: "conflict" });
  });
});

describe("downloadStudentDataExport", () => {
  const answer = (response: Response) => vi.fn<typeof fetch>(async () => response);

  it("asks for that token without a session and returns the bytes untouched", async () => {
    const transport = answer(new Response(new Uint8Array([1, 2, 3]), {
      status: 200, headers: { "content-type": "application/zip", "content-disposition": 'attachment; filename="izvoz-mojih-podataka.zip"' },
    }));
    const out = await downloadStudentDataExport(TOKEN, { baseUrl: ORIGIN, transport });
    expect(out).toMatchObject({ kind: "ready", filename: "izvoz-mojih-podataka.zip", type: "application/zip" });
    expect(out.kind === "ready" && [...new Uint8Array(out.bytes)]).toEqual([1, 2, 3]);
    expect(transport).toHaveBeenCalledWith(new URL(`${ORIGIN}/api/v1/student/data-export/${TOKEN}`), expect.objectContaining({ method: "GET", credentials: "omit" }));
  });

  it.each([[410, "gone"], [503, "unavailable"], [404, "unavailable"], [204, "unavailable"]] as const)("status %i is %s", async (status, kind) => {
    expect((await downloadStudentDataExport(TOKEN, { baseUrl: ORIGIN, transport: answer(new Response(null, { status })) })).kind).toBe(kind);
  });

  it("an empty 200 and a broken connection are unavailable", async () => {
    expect((await downloadStudentDataExport(TOKEN, { baseUrl: ORIGIN, transport: answer(new Response(new Uint8Array(), { status: 200 })) })).kind).toBe("unavailable");
    expect((await downloadStudentDataExport(TOKEN, { baseUrl: ORIGIN, transport: vi.fn(async () => { throw new TypeError("offline"); }) })).kind).toBe("unavailable");
  });

  it("a token of the wrong shape is gone and never reaches the network", async () => {
    const transport = vi.fn<typeof fetch>();
    for (const token of ["../x", TOKEN.slice(1), `${TOKEN}=`]) {
      expect((await downloadStudentDataExport(token, { baseUrl: ORIGIN, transport })).kind).toBe("gone");
    }
    expect(transport).not.toHaveBeenCalled();
  });
});
