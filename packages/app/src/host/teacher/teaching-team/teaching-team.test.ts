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

  it("shows the assistant only the scoped group and renders no editing controls", async () => {
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
    expect(html).not.toMatch(/<button|<input|<select|Spremi/);
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

describe("NZ-14 roles on the course", () => {
  it("names the three roles, the caller's own, and links the mentored works under the app's base", () => {
    const html = renderToStaticMarkup(createElement(TeamRoles, { role: "holder", mentorHref: "/app/web/nastavnik/mentorstva" }));
    expect(html).toContain("Vaša uloga: nositelj.");
    for (const name of ["Nositelj", "Suradnik", "Mentor"]) expect(html).toContain(`<strong>${name}</strong>`);
    expect(html).toContain("samo čita i komentira");
    expect(html).toContain('href="/app/web/nastavnik/mentorstva"');
    expect(html).toContain("administrator ustanove");
  });
  it("tells a collaborator they read and comment only, without the note on adding teachers", () => {
    const html = renderToStaticMarkup(createElement(TeamRoles, { role: "assistant", mentorHref: "/x" }));
    expect(html).toContain("Vaša uloga: suradnik.");
    expect(html).not.toContain("administrator ustanove");
  });
});
