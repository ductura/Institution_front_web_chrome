import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { createApi } from "../../../../../../src/client/api";
import { createTeachingTeam } from "../../../../../../src/client/teaching-team";
import { TeachingTeamContent } from "./TeachingTeam";

const ORIGIN = "https://ductura.example.invalid";
const courseId = "c0000000-0000-4000-8000-000000000001";
const holderId = "c0000000-0000-4000-8000-000000000002";
const assistantId = "c0000000-0000-4000-8000-000000000003";
const groupId = "c0000000-0000-4000-8000-000000000004";
const studentId = "c0000000-0000-4000-8000-000000000005";
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
      .mockResolvedValueOnce(Response.json({ updated: true }))
      .mockResolvedValueOnce(Response.json(holder))
      .mockResolvedValueOnce(Response.json({ holderId, assistantIds: [assistantId] }))
      .mockResolvedValueOnce(Response.json({ updated: true }));

    expect(await port.read()).toMatchObject({ kind: "ready", view: { assistantIds: [] } });
    expect(await port.saveAssistants([assistantId])).toEqual({ kind: "saved" });
    expect(await port.read()).toMatchObject({ kind: "ready", view: { assistantIds: [assistantId] } });
    expect(await port.saveGroup(groupId, [assistantId], [studentId])).toEqual({ kind: "saved" });

    expect(transport.mock.calls.map(([url, init]) => [String(url).slice(ORIGIN.length), init?.method, init?.body && JSON.parse(String(init.body))]))
      .toEqual([
        [`/api/v1/courses/${courseId}/team/view`, "GET", undefined],
        [`/api/v1/courses/${courseId}/team`, "GET", undefined],
        [`/api/v1/courses/${courseId}/team`, "POST", { assistantIds: [assistantId] }],
        [`/api/v1/courses/${courseId}/team/view`, "GET", undefined],
        [`/api/v1/courses/${courseId}/team`, "GET", undefined],
        [`/api/v1/courses/${courseId}/groups/${groupId}/members`, "PUT", { assistantIds: [assistantId], studentIds: [studentId] }],
      ]);
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
