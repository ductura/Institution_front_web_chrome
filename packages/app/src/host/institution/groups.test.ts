// F4-OPE-R04 (OPE-20): making a course group and assigning a teacher over a stub transport with invented data.
import { describe, expect, it, vi } from "vitest";

import { assignGroupTeacher, createCourseGroup, groupName } from "./groups";

const BASE = "https://ductura.example.invalid";
const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const reply = (status: number, body: unknown) => vi.fn(async (_url: URL | RequestInfo, _init?: RequestInit) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
const error = (code: string) => ({ error: code, code, messageKey: `errors.${code}`, status: 0 });

describe("groupName", () => {
  it("trims, and refuses an empty or too long name", () => {
    expect(groupName("  Grupa A ")).toBe("Grupa A");
    expect(groupName("   ")).toBeNull();
    expect(groupName("x".repeat(81))).toBeNull();
    expect(groupName("x".repeat(80))).toBe("x".repeat(80));
  });
});

describe("createCourseGroup", () => {
  it("posts the trimmed name to the course's own route", async () => {
    const fetchImpl = reply(200, { id: B });
    expect(await createCourseGroup(A, " Grupa A ", { baseUrl: BASE, fetchImpl })).toBe("ok");
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(`${BASE}/api/v1/institution/courses/${A}/groups`);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ name: "Grupa A" });
  });

  it("sends nothing for a bad name or an id that is not a UUID", async () => {
    const fetchImpl = reply(200, { id: B });
    expect(await createCourseGroup(A, "  ", { baseUrl: BASE, fetchImpl })).toBe("invalid");
    expect(await createCourseGroup("nije-uuid", "Grupa", { baseUrl: BASE, fetchImpl })).toBe("invalid");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps the refusals; a body outside the contract or a lost connection proves nothing", async () => {
    const send = (status: number, body: unknown = error("x")) => createCourseGroup(A, "Grupa", { baseUrl: BASE, fetchImpl: reply(status, body) });
    expect(await send(401)).toBe("unauthorized");
    expect(await send(403)).toBe("forbidden");
    expect(await send(422)).toBe("invalid");
    expect(await send(404)).toBe("unknown");
    expect(await send(503)).toBe("unknown");
    expect(await send(200, {})).not.toBe("ok");
    expect(await createCourseGroup(A, "Grupa", { baseUrl: BASE, fetchImpl: vi.fn(async () => { throw new Error("offline"); }) })).toBe("unknown");
  });
});

describe("assignGroupTeacher", () => {
  it("posts the teacher to the group's own route", async () => {
    const fetchImpl = reply(200, { assigned: true });
    expect(await assignGroupTeacher(A, B, { baseUrl: BASE, fetchImpl })).toBe("ok");
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(`${BASE}/api/v1/institution/groups/${A}/teachers`);
    expect(JSON.parse(String(init?.body))).toEqual({ teacherId: B });
  });

  it("does not claim an assignment the answer does not prove", async () => {
    expect(await assignGroupTeacher(A, B, { baseUrl: BASE, fetchImpl: reply(200, { assigned: false }) })).toBe("unknown");
    expect(await assignGroupTeacher(A, B, { baseUrl: BASE, fetchImpl: reply(403, error("forbidden")) })).toBe("forbidden");
    expect(await assignGroupTeacher(A, B, { baseUrl: BASE, fetchImpl: reply(404, error("x")) })).toBe("unknown");
  });

  it("sends nothing for ids that are not UUIDs", async () => {
    const fetchImpl = reply(200, { assigned: true });
    expect(await assignGroupTeacher("x", B, { baseUrl: BASE, fetchImpl })).toBe("invalid");
    expect(await assignGroupTeacher(A, "y", { baseUrl: BASE, fetchImpl })).toBe("invalid");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
