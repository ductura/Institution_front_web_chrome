import { afterEach, describe, expect, it, vi } from "vitest";

import { createApi } from "./api";
import {
  approveStudentDataExport, downloadStudentDataExport, listStudentDataExports, requestStudentDataExport,
  type StudentDataExportCall,
} from "./student-data-export";

const ORIGIN = "https://ductura.example.invalid";
const EXPORT = "e1302000-0000-4000-8000-000000000001";
const STUDENT = "c1302000-0000-4000-8000-000000000001";
const TOKEN = "A".repeat(40) + "_-9";
const REQUEST = { studentId: STUDENT, identityCheckedBy: "passport", note: "IZM-2026-1" } as const;
const row = { exportId: EXPORT, state: "ready", requestedAt: "2026-11-21T10:00:00.000Z", expiresAt: "2026-11-28T10:00:00.000Z" };
const CODES: Record<number, string> = { 401: "unauthorized", 403: "forbidden", 404: "not_found", 409: "conflict", 422: "invalid_input", 503: "unavailable" };

/** createApi itself, on a fetch that answers once with this status and JSON body. */
function serving(status: number, body: unknown = { code: CODES[status] }) {
  const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(body, { status }));
  const call: StudentDataExportCall = createApi({ baseUrl: ORIGIN, fetchImpl });
  return { fetchImpl, call };
}
const offline = (): StudentDataExportCall => createApi({ baseUrl: ORIGIN, fetchImpl: vi.fn(async () => { throw new TypeError("offline"); }) });
function sent(fetchImpl: ReturnType<typeof serving>["fetchImpl"]) {
  const [url, init] = fetchImpl.mock.calls[0]!;
  return { url: String(url), method: init?.method, body: init?.body };
}

afterEach(() => vi.unstubAllGlobals());

describe("listStudentDataExports", () => {
  it("returns the requests the server sent", async () => {
    const exports = [row, { ...row, exportId: STUDENT, state: "requested", expiresAt: null }];
    const { fetchImpl, call } = serving(200, { exports });
    expect(await listStudentDataExports(call)).toEqual({ kind: "ok", exports });
    expect(sent(fetchImpl)).toEqual({ url: `${ORIGIN}/api/v1/institution/student-data-exports`, method: "GET", body: undefined });
  });

  it.each([
    ["an unknown state", { exports: [{ ...row, state: "deleted" }] }],
    ["an extra field", { exports: [{ ...row, studentName: "Izmišljeni Student" }] }],
    ["a repeated id", { exports: [row, row] }],
    ["no list", {}],
  ])("%s is unavailable, never a partial list", async (_name, body) => {
    expect(await listStudentDataExports(serving(200, body).call)).toEqual({ kind: "unavailable" });
  });

  it.each([[401, "signedOut"], [403, "denied"], [503, "unavailable"]] as const)("status %i is %s", async (status, kind) => {
    expect(await listStudentDataExports(serving(status).call)).toEqual({ kind });
  });

  it("a broken connection is unavailable", async () => {
    expect(await listStudentDataExports(offline())).toEqual({ kind: "unavailable" });
  });
});

describe("requestStudentDataExport", () => {
  it("sends the closed body and returns the new id after a 201", async () => {
    const { fetchImpl, call } = serving(201, { exportId: EXPORT });
    expect(await requestStudentDataExport(REQUEST, call)).toEqual({ kind: "ok", exportId: EXPORT });
    const out = sent(fetchImpl);
    expect(out).toMatchObject({ url: `${ORIGIN}/api/v1/institution/student-data-exports`, method: "POST" });
    expect(JSON.parse(String(out.body))).toEqual(REQUEST);
  });

  it.each([
    ["an upper-case student", { ...REQUEST, studentId: STUDENT.toUpperCase() }],
    ["an unknown document", { ...REQUEST, identityCheckedBy: "driving_licence" as "passport" }],
    ["an empty note", { ...REQUEST, note: "" }],
    ["a note over 80 characters", { ...REQUEST, note: "x".repeat(81) }],
    ["a note with outer spaces", { ...REQUEST, note: " IZM " }],
  ])("%s is invalid and never sent", async (_name, input) => {
    const { fetchImpl, call } = serving(201, { exportId: EXPORT });
    expect(await requestStudentDataExport(input, call)).toEqual({ kind: "invalid" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([[401, "signedOut"], [403, "denied"], [404, "notFound"], [409, "exists"], [422, "invalid"], [503, "unavailable"]] as const)(
    "status %i is %s", async (status, kind) => {
      expect(await requestStudentDataExport(REQUEST, serving(status).call)).toEqual({ kind });
    });

  it("a 200 or a malformed id is unavailable, never a request", async () => {
    expect(await requestStudentDataExport(REQUEST, serving(200, { exportId: EXPORT }).call)).toEqual({ kind: "unavailable" });
    expect(await requestStudentDataExport(REQUEST, serving(201, { exportId: "x" }).call)).toEqual({ kind: "unavailable" });
  });
});

describe("approveStudentDataExport", () => {
  it("is ok only when the answer names the same request as approved", async () => {
    const { fetchImpl, call } = serving(200, { exportId: EXPORT, state: "approved" });
    expect(await approveStudentDataExport(EXPORT, "IZM-2026-7", call)).toEqual({ kind: "ok" });
    const out = sent(fetchImpl);
    expect(out).toMatchObject({ url: `${ORIGIN}/api/v1/institution/student-data-exports/${EXPORT}/approve`, method: "POST" });
    expect(JSON.parse(String(out.body))).toEqual({ reference: "IZM-2026-7" });
    expect(await approveStudentDataExport(EXPORT, "IZM-2026-7", serving(200, { exportId: STUDENT, state: "approved" }).call)).toEqual({ kind: "unavailable" });
    expect(await approveStudentDataExport(EXPORT, "IZM-2026-7", serving(200, { exportId: EXPORT, state: "ready" }).call)).toEqual({ kind: "unavailable" });
  });

  it("a blank or over-long reference, or an id out of shape, is never sent", async () => {
    const { fetchImpl, call } = serving(200, { exportId: EXPORT, state: "approved" });
    expect(await approveStudentDataExport(EXPORT, "", call)).toEqual({ kind: "invalid" });
    expect(await approveStudentDataExport(EXPORT, "x".repeat(121), call)).toEqual({ kind: "invalid" });
    expect(await approveStudentDataExport("a/b", "IZM-2026-7", call)).toEqual({ kind: "stale" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([[401, "signedOut"], [403, "denied"], [404, "stale"], [409, "stale"], [422, "invalid"], [503, "unavailable"]] as const)(
    "status %i is %s", async (status, kind) => {
      expect(await approveStudentDataExport(EXPORT, "IZM-2026-7", serving(status).call)).toEqual({ kind });
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
