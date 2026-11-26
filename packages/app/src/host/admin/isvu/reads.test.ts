import { describe, expect, it } from "vitest";

import { confirmImport, previewImport, readSourceCourses } from "./reads";

const COURSE = "5b1f2c3d-0000-4000-8000-000000000001";
const IMPORT = "5b1f2c3d-0000-4000-8000-000000000002";
type Seen = { method: string; path: string; search: string; body: string };
const transport = (status: number, body: unknown = {}, seen: Seen[] = []) => ({
  baseUrl: "http://localhost",
  fetchImpl: async (input: RequestInfo | URL, init?: RequestInit) => {
    const r = input instanceof Request ? input : new Request(String(input), init);
    const u = new URL(r.url, "http://localhost");
    seen.push({ method: r.method, path: u.pathname, search: u.search, body: await r.clone().text() });
    return Response.json(body, { status });
  },
});

describe("WEB-V22-UVOZ-EKRAN reads", () => {
  it("reads the source courses of one year", async () => {
    const seen: Seen[] = [];
    const r = await readSourceCourses("2026/2027", transport(200, { mode: "mock", courses: [{ sourceCourseKey: "K1", name: "Izmišljeni kolegij", academicYear: "2026/2027", enrolledCount: 3 }] }, seen));
    expect(r.kind).toBe("ok");
    expect(seen[0]).toMatchObject({ method: "GET", path: "/api/v1/institution/admin/isvu/courses" });
    expect(seen[0]!.search).toContain("academicYear=2026");
  });

  it.each([[401, "signedOut"], [403, "denied"], [404, "disabled"], [503, "unavailable"]])("source status %i is %s, never an empty list", async (status, kind) => {
    expect((await readSourceCourses("2026/2027", transport(status, { error: "x" }))).kind).toBe(kind);
  });

  it("a wrong-shaped answer is unavailable", async () => {
    expect((await readSourceCourses("2026/2027", transport(200, { mode: "live", courses: [] }))).kind).toBe("unavailable");
  });

  it("a malformed year or key is refused before any request", async () => {
    const seen: Seen[] = [];
    expect((await readSourceCourses("jučer", transport(200, {}, seen))).kind).toBe("unavailable");
    expect((await previewImport(COURSE, "bad key!", transport(200, {}, seen))).kind).toBe("unavailable");
    expect(seen).toHaveLength(0);
  });

  it("preview posts only the source key; 404 is disabled", async () => {
    const seen: Seen[] = [];
    await previewImport(COURSE, "K1", transport(404, { error: "not_found" }, seen));
    expect(seen[0]).toMatchObject({ method: "POST", path: `/api/v1/institution/admin/courses/${COURSE}/isvu-roster-imports` });
    expect(JSON.parse(seen[0]!.body)).toEqual({ sourceCourseKey: "K1" });
    expect((await previewImport(COURSE, "K1", transport(404, { error: "not_found" }))).kind).toBe("disabled");
  });

  it("confirm maps 410 to expired", async () => {
    const seen: Seen[] = [];
    expect((await confirmImport(IMPORT, transport(410, { error: "import_expired" }, seen))).kind).toBe("expired");
    expect(seen[0]!.path).toBe(`/api/v1/institution/admin/roster-imports/${IMPORT}/confirm`);
  });
});
