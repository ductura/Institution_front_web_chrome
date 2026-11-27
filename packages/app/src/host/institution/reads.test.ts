// LOK-WEB-8: the reads and role actions of /ustanova over a stub transport answering with invented data.
import { describe, expect, it, vi } from "vitest";

import { changeCourseStudent, changeTeacherRole, readAcademicYears, readAdminCourses, readTeacherRoles } from "./reads";
import { chosenYear, displayName, overviewCounts, yearLabel } from "./views";

const BASE = "https://ductura.example.invalid";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const reply = (status: number, body: unknown) => vi.fn(async (_url: URL | RequestInfo, _init?: RequestInit) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
const error = (code: string) => ({ error: code, code, messageKey: `errors.${code}`, status: 0 });
const ROLES = {
  pending: [{ personId: A, name: { givenName: "Ana", familyName: "Izmišljena" }, revokedAt: null }],
  confirmed: [
    { personId: B, name: null, confirmedAt: "2026-10-01T08:00:00.000Z", forReview: true },
    { personId: "33333333-3333-4333-8333-333333333333", name: { givenName: "Ivo", familyName: "Primjer" }, confirmedAt: "2026-10-02T08:00:00.000Z", forReview: false },
  ],
};
const COURSE = {
  courseId: A, name: "Izmišljeni seminar", students: 7, holder: null, team: [],
  groups: [{ groupId: B, name: "Grupa A", students: 4, teachers: [] }],
};

describe("readTeacherRoles", () => {
  it("reads the two lists", async () => {
    const fetchImpl = reply(200, ROLES);
    expect(await readTeacherRoles({ baseUrl: BASE, fetchImpl })).toEqual({ kind: "ok", value: ROLES });
    expect(String(fetchImpl.mock.calls[0]![0])).toBe(`${BASE}/api/v1/institution/teachers`);
  });

  it("maps 401, 403, 503 and a thrown transport", async () => {
    expect(await readTeacherRoles({ baseUrl: BASE, fetchImpl: reply(401, error("unauthorized")) })).toEqual({ kind: "signedOut" });
    expect(await readTeacherRoles({ baseUrl: BASE, fetchImpl: reply(403, error("forbidden")) })).toEqual({ kind: "denied" });
    expect(await readTeacherRoles({ baseUrl: BASE, fetchImpl: reply(503, error("unavailable")) })).toEqual({ kind: "unavailable" });
    expect(await readTeacherRoles({ baseUrl: BASE, fetchImpl: vi.fn(async () => { throw new Error("offline"); }) })).toEqual({ kind: "unavailable" });
  });

  it("treats a body outside the contract as unavailable", async () => {
    expect(await readTeacherRoles({ baseUrl: BASE, fetchImpl: reply(200, { pending: [], confirmed: [], extra: 1 }) })).toEqual({ kind: "unavailable" });
  });
});

describe("readAcademicYears and readAdminCourses", () => {
  it("reads the years", async () => {
    const fetchImpl = reply(200, { years: ["2026/2027", "2025/2026"] });
    expect(await readAcademicYears({ baseUrl: BASE, fetchImpl })).toEqual({ kind: "ok", value: ["2026/2027", "2025/2026"] });
    expect(String(fetchImpl.mock.calls[0]![0])).toBe(`${BASE}/api/v1/institution/admin/academic-years`);
  });

  it("reads the courses of the asked year and sends the year as the query", async () => {
    const fetchImpl = reply(200, { academicYear: "2026/2027", courses: [COURSE] });
    expect(await readAdminCourses("2026/2027", { baseUrl: BASE, fetchImpl })).toEqual({ kind: "ok", value: [COURSE] });
    expect(String(fetchImpl.mock.calls[0]![0])).toBe(`${BASE}/api/v1/institution/admin/courses?academicYear=2026%2F2027`);
  });

  it("is unavailable when the answer is for another year", async () => {
    expect(await readAdminCourses("2026/2027", { baseUrl: BASE, fetchImpl: reply(200, { academicYear: "2025/2026", courses: [] }) })).toEqual({ kind: "unavailable" });
  });

  it("refuses a year that is not a year without a request", async () => {
    const fetchImpl = reply(200, { academicYear: "x", courses: [] });
    expect(await readAdminCourses("x", { baseUrl: BASE, fetchImpl })).toEqual({ kind: "unavailable" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps 401 and 403", async () => {
    expect(await readAdminCourses("2026/2027", { baseUrl: BASE, fetchImpl: reply(401, error("unauthorized")) })).toEqual({ kind: "signedOut" });
    expect(await readAcademicYears({ baseUrl: BASE, fetchImpl: reply(403, error("forbidden")) })).toEqual({ kind: "denied" });
  });
});

describe("changeTeacherRole", () => {
  it("confirms and posts to the person's own route", async () => {
    const fetchImpl = reply(200, { confirmed: true });
    expect(await changeTeacherRole("confirm", A, { baseUrl: BASE, fetchImpl })).toEqual({ kind: "confirmed" });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(`${BASE}/api/v1/institution/teachers/${A}/role-confirmation`);
    expect(init?.method).toBe("POST");
  });

  it("revokes, and says so when there was nothing to revoke", async () => {
    expect(await changeTeacherRole("revoke", A, { baseUrl: BASE, fetchImpl: reply(200, { revoked: true }) })).toEqual({ kind: "revoked" });
    expect(await changeTeacherRole("revoke", A, { baseUrl: BASE, fetchImpl: reply(200, { revoked: false }) })).toEqual({ kind: "notConfirmed" });
  });

  it("maps the refusals", async () => {
    const send = (action: "confirm" | "revoke", status: number) =>
      changeTeacherRole(action, A, { baseUrl: BASE, fetchImpl: reply(status, error("x")) });
    expect(await send("confirm", 401)).toEqual({ kind: "unauthorized" });
    expect(await send("confirm", 403)).toEqual({ kind: "forbidden" });
    expect(await send("confirm", 422)).toEqual({ kind: "invalid" });
    expect(await send("confirm", 404)).toEqual({ kind: "notCandidate" });
    expect(await send("revoke", 404)).toEqual({ kind: "unknown" });
    expect(await send("confirm", 503)).toEqual({ kind: "unknown" });
  });

  it("never claims either way for a body that does not prove it, or a lost connection", async () => {
    expect((await changeTeacherRole("confirm", A, { baseUrl: BASE, fetchImpl: reply(200, { confirmed: false }) })).kind).not.toBe("confirmed");
    expect(await changeTeacherRole("revoke", A, { baseUrl: BASE, fetchImpl: vi.fn(async () => { throw new Error("offline"); }) })).toEqual({ kind: "unknown" });
  });

  it("sends nothing for an id that is not a UUID", async () => {
    const fetchImpl = reply(200, { confirmed: true });
    expect(await changeTeacherRole("confirm", "nije-uuid", { baseUrl: BASE, fetchImpl })).toEqual({ kind: "invalid" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("views", () => {
  it("names a person given name first and a missing name as unnamed", () => {
    expect(displayName({ givenName: "Ana", familyName: "Izmišljena" }, "Ime nije upisano")).toBe("Ana Izmišljena");
    expect(displayName(null, "Ime nije upisano")).toBe("Ime nije upisano");
  });

  it("chooses the asked year only when it is listed, else the newest", () => {
    expect(chosenYear([], null)).toBeNull();
    expect(chosenYear(["2026/2027", "2025/2026"], null)).toBe("2026/2027");
    expect(chosenYear(["2026/2027", "2025/2026"], "2025/2026")).toBe("2025/2026");
    expect(chosenYear(["2026/2027"], "1999/2000")).toBe("2026/2027");
  });

  it("writes a year as the interface does", () => {
    expect(yearLabel("2026/2027")).toBe("2026./2027.");
  });

  it("counts the overview from the roles and the courses", () => {
    expect(overviewCounts(ROLES, [COURSE, { ...COURSE, courseId: B, students: 3 }])).toEqual({
      confirmedTeachers: 2, teacherCandidates: 1, teachersWithoutAffiliation: 1, courses: 2, students: 10,
    });
    expect(overviewCounts({ pending: [], confirmed: [] }, [])).toEqual({
      confirmedTeachers: 0, teacherCandidates: 0, teachersWithoutAffiliation: 0, courses: 0, students: 0,
    });
  });
});

describe("changeCourseStudent", () => {
  it("posts removal and return to the course and student route", async () => {
    const removal = reply(200, { removed: true });
    expect(await changeCourseStudent("remove", A, B, { baseUrl: BASE, fetchImpl: removal })).toEqual({ kind: "done" });
    expect(String(removal.mock.calls[0]![0])).toBe(`${BASE}/api/v1/institution/courses/${A}/students/${B}/removal`);
    expect(removal.mock.calls[0]![1]?.method).toBe("POST");
    const back = reply(200, { allowed: true });
    expect(await changeCourseStudent("return", A, B, { baseUrl: BASE, fetchImpl: back })).toEqual({ kind: "done" });
    expect(String(back.mock.calls[0]![0])).toBe(`${BASE}/api/v1/institution/courses/${A}/students/${B}/return-permission`);
  });

  it("says nothing changed for false, and never claims done for it", async () => {
    expect(await changeCourseStudent("remove", A, B, { baseUrl: BASE, fetchImpl: reply(200, { removed: false }) })).toEqual({ kind: "nothing" });
    expect(await changeCourseStudent("return", A, B, { baseUrl: BASE, fetchImpl: reply(200, { allowed: false }) })).toEqual({ kind: "nothing" });
  });

  it("maps the refusals and an unproven answer", async () => {
    const send = (status: number) => changeCourseStudent("remove", A, B, { baseUrl: BASE, fetchImpl: reply(status, error("x")) });
    expect(await send(401)).toEqual({ kind: "unauthorized" });
    expect(await send(403)).toEqual({ kind: "forbidden" });
    expect(await send(422)).toEqual({ kind: "invalid" });
    expect(await send(404)).toEqual({ kind: "unknown" });
    expect(await send(503)).toEqual({ kind: "unknown" });
    expect(await changeCourseStudent("remove", A, B, { baseUrl: BASE, fetchImpl: vi.fn(async () => { throw new Error("offline"); }) })).toEqual({ kind: "unknown" });
  });

  it("sends nothing for an id that is not a UUID", async () => {
    const fetchImpl = reply(200, { removed: true });
    expect(await changeCourseStudent("remove", A, "nije-uuid", { baseUrl: BASE, fetchImpl })).toEqual({ kind: "invalid" });
    expect(await changeCourseStudent("return", "x", B, { baseUrl: BASE, fetchImpl })).toEqual({ kind: "invalid" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
