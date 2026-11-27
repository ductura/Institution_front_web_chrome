import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { createApi } from "../../../../../../src/client/api";
import { createTeachingTeam } from "../../../../../../src/client/teaching-team";
import { TeachingTeamContent, TeamRoles } from "./TeachingTeam";

const ORIGIN = "https://ductura.example.invalid";
const courseId = "c0000000-0000-4000-8000-000000000001";
const holderId = "c0000000-0000-4000-8000-000000000002";
const assistantId = "c0000000-0000-4000-8000-000000000003";
const groupId = "c0000000-0000-4000-8000-000000000004";
const studentId = "c0000000-0000-4000-8000-000000000005";
const candidateId = "c0000000-0000-4000-8000-000000000006";
const group = { id: groupId, name: "Seminar o oblacima" };
const assistant = { id: assistantId, name: "Asistent Oblak" };
const student = { id: studentId, name: "Student Jantar" };
const holder = { role: "holder", holderId, assistants: [assistant], groups: [{ ...group, assistantIds: [] }], students: [{ ...student, groupId: null }] };
const assistantView = { role: "assistant", groups: [{ ...group, students: [student] }] };

function setup() {
  const transport = vi.fn<typeof fetch>();
  const port = createTeachingTeam(courseId, createApi({ baseUrl: ORIGIN, fetchImpl: transport }));
  return { transport, port };
}

describe("WEB-1405 teaching team", () => {
  it("reads the authoritative roster again after saving and sends complete group membership", async () => {
    const { transport, port } = setup();
    transport.mockResolvedValueOnce(Response.json(holder))
      .mockResolvedValueOnce(Response.json({ holderId, assistantIds: [] }))
      .mockResolvedValueOnce(Response.json({ candidates: [] }))
      .mockResolvedValueOnce(Response.json({ updated: true }))
      .mockResolvedValueOnce(Response.json(holder))
      .mockResolvedValueOnce(Response.json({ holderId, assistantIds: [assistantId] }))
      .mockResolvedValueOnce(Response.json({ candidates: [] }))
      .mockResolvedValueOnce(Response.json({ updated: true }));

    expect(await port.read()).toMatchObject({ kind: "ready", view: { assistantIds: [] } });
    expect(await port.saveAssistants([assistantId])).toEqual({ kind: "saved" });
    expect(await port.read()).toMatchObject({ kind: "ready", view: { assistantIds: [assistantId] } });
    expect(await port.saveGroup(groupId, [assistantId], [studentId])).toEqual({ kind: "saved" });

    expect(transport.mock.calls.map(([url, init]) => [String(url).slice(ORIGIN.length), init?.method, init?.body && JSON.parse(String(init.body))]))
      .toEqual([
        [`/api/v1/courses/${courseId}/team/view`, "GET", undefined],
        [`/api/v1/courses/${courseId}/team`, "GET", undefined],
        [`/api/v1/courses/${courseId}/team/candidates`, "GET", undefined],
        [`/api/v1/courses/${courseId}/team`, "POST", { assistantIds: [assistantId] }],
        [`/api/v1/courses/${courseId}/team/view`, "GET", undefined],
        [`/api/v1/courses/${courseId}/team`, "GET", undefined],
        [`/api/v1/courses/${courseId}/team/candidates`, "GET", undefined],
        [`/api/v1/courses/${courseId}/groups/${groupId}/members`, "PUT", { assistantIds: [assistantId], studentIds: [studentId] }],
      ]);
  });

  it("offers the holder the institution's other teachers as candidates and lists each person once (DEMO-POP-4)", async () => {
    const { transport, port } = setup();
    const candidate = { id: candidateId, name: "Nastavnica Kandidat" };
    transport.mockResolvedValueOnce(Response.json(holder))
      .mockResolvedValueOnce(Response.json({ holderId, assistantIds: [assistantId] }))
      .mockResolvedValueOnce(Response.json({ candidates: [candidate, assistant] }));
    const result = await port.read();

    expect(result).toMatchObject({ kind: "ready", view: { assistants: [assistant, candidate], assistantIds: [assistantId] } });
    if (result.kind !== "ready") return;
    const html = renderToStaticMarkup(createElement(TeachingTeamContent, {
      view: result.view, port, save: vi.fn(), busy: false, groupId: "", setGroupId: vi.fn(),
    }));
    expect(html).toContain(candidate.name);
  });

  it("does not show the roster when the candidates cannot be read", async () => {
    const { transport, port } = setup();
    transport.mockResolvedValueOnce(Response.json(holder))
      .mockResolvedValueOnce(Response.json({ holderId, assistantIds: [] }))
      .mockResolvedValueOnce(Response.json({ code: "forbidden" }, { status: 403 }));
    expect(await port.read()).toEqual({ kind: "forbidden" });
  });

  it("shows the assistant only the scoped group and no roster editing controls, only the new-group form", async () => {
    const { transport, port } = setup();
    transport.mockResolvedValueOnce(Response.json(assistantView));
    const result = await port.read();

    expect(transport).toHaveBeenCalledTimes(1);
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    const html = renderToStaticMarkup(createElement(TeachingTeamContent, {
      view: result.view, port, save: vi.fn(), busy: false, groupId: "", setGroupId: vi.fn(),
    }));
    expect(html).toContain("<table");
    expect(html).toContain(student.name);
    expect(html).toContain(group.name);
    expect(html).not.toMatch(/<select|<input type="checkbox"|Spremi|Dodaj nastavnika/);
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toContain("Dodaj grupu");
    expect(html).not.toContain(assistant.name);
  });

  it("fails closed on a broadened assistant payload and never requests the course roster", async () => {
    const { transport, port } = setup();
    transport.mockResolvedValueOnce(Response.json({ ...assistantView, assistants: [assistant] }));
    expect(await port.read()).toEqual({ kind: "unavailable" });
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("reports a rejected replace without presenting it as a saved change", async () => {
    const { transport, port } = setup();
    transport.mockResolvedValueOnce(Response.json({ code: "conflict" }, { status: 409 }))
      .mockResolvedValueOnce(Response.json({ code: "forbidden" }, { status: 403 }));
    expect(await port.saveGroup(groupId, [], [studentId])).toEqual({ kind: "conflict" });
    expect(await port.saveAssistants([assistantId])).toEqual({ kind: "forbidden" });
  });
});

describe("F4-PM1-R08 course groups", () => {
  const other = "c0000000-0000-4000-8000-000000000007";
  it("creates a group with the trimmed name and refuses a bad name or id without a request", async () => {
    const { transport, port } = setup();
    transport.mockResolvedValueOnce(Response.json({ id: other }));
    expect(await port.createGroup("  Grupa A ")).toEqual({ kind: "saved" });
    expect(String(transport.mock.calls[0]![0])).toBe(`${ORIGIN}/api/v1/institution/courses/${courseId}/groups`);
    expect(JSON.parse(String(transport.mock.calls[0]![1]?.body))).toEqual({ name: "Grupa A" });
    expect(await port.createGroup("   ")).toEqual({ kind: "invalid" });
    expect(await port.createGroup("x".repeat(81))).toEqual({ kind: "invalid" });
    expect(await port.assignGroupTeacher("nije-uuid", assistantId)).toEqual({ kind: "invalid" });
    expect(transport).toHaveBeenCalledTimes(1);
  });
  it("maps 403 (other course or group is the same) and a throw, and never treats assigned:false as saved", async () => {
    const { transport, port } = setup();
    transport.mockResolvedValueOnce(Response.json({ code: "forbidden" }, { status: 403 }))
      .mockResolvedValueOnce(Response.json({ assigned: false }))
      .mockResolvedValueOnce(Response.json({ assigned: true }))
      .mockRejectedValueOnce(new Error("offline"));
    expect(await port.createGroup("Grupa")).toEqual({ kind: "forbidden" });
    expect(await port.assignGroupTeacher(groupId, assistantId)).toEqual({ kind: "unavailable" });
    expect(await port.assignGroupTeacher(groupId, assistantId)).toEqual({ kind: "saved" });
    expect(String(transport.mock.calls[2]![0])).toBe(`${ORIGIN}/api/v1/institution/groups/${groupId}/teachers`);
    expect(await port.createGroup("Grupa")).toEqual({ kind: "unavailable" });
  });
  it("shows the holder the new-group form and the teacher picker, leaving out teachers already in the group", () => {
    const { port } = setup();
    const view = { ...holder, assistantIds: [], groups: [{ ...group, assistantIds: [assistantId] }], assistants: [assistant, { id: candidateId, name: "Nastavnica Kandidat" }] };
    const html = renderToStaticMarkup(createElement(TeachingTeamContent, {
      view: view as never, port, save: vi.fn(), busy: false, groupId: "", setGroupId: vi.fn(),
    }));
    expect(html).toContain("Dodaj grupu");
    expect(html).toContain("Dodaj nastavnika u grupu");
    expect(html).toContain("Nastavnica Kandidat</option>");
    expect(html).not.toContain("Asistent Oblak</option>");
  });
});

describe("NZ-14 roles on the course", () => {
  it("names the three roles, the caller's own, and links the mentored works under the app's base", () => {
    const html = renderToStaticMarkup(createElement(TeamRoles, { role: "holder", mentorHref: "/aplikacija/nastavnik/mentorstva" }));
    expect(html).toContain("Vaša uloga: nositelj.");
    for (const name of ["Nositelj", "Suradnik", "Mentor"]) expect(html).toContain(`<strong>${name}</strong>`);
    expect(html).toContain("samo čita i komentira");
    expect(html).toContain('href="/aplikacija/nastavnik/mentorstva"');
    expect(html).toContain("administrator ustanove");
  });
  it("tells a collaborator they read and comment only, without the note on adding teachers", () => {
    const html = renderToStaticMarkup(createElement(TeamRoles, { role: "assistant", mentorHref: "/x" }));
    expect(html).toContain("Vaša uloga: suradnik.");
    expect(html).not.toContain("administrator ustanove");
  });
});
