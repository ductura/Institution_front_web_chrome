import { describe, expect, it, vi } from "vitest";

import { createApi } from "../../../../../../src/client/api";
import { questionnairePort } from "./port";

const ORIGIN = "https://ductura.example.invalid";
const course = "c0000000-0000-4000-8000-000000000001";
const id = "c0000000-0000-4000-8000-000000000002";
const q1 = "c0000000-0000-4000-8000-000000000003";
const full = { id, courseId: course, title: "Izmišljeno istraživanje: navike kompostiranja", state: "draft",
  questions: [{ id: q1, order: 1, kind: "single", text: "Kompostirate li?", options: [{ code: "da", label: "Da" }, { code: "ne", label: "Ne" }], scale: null }] };

function setup() {
  const transport = vi.fn<typeof fetch>();
  return { transport, port: questionnairePort(createApi({ baseUrl: ORIGIN, fetchImpl: transport })) };
}
const sent = (transport: ReturnType<typeof setup>["transport"]) =>
  transport.mock.calls.map(([url, init]) => [String(url).slice(ORIGIN.length), init?.method, init?.body ? JSON.parse(String(init.body)) : undefined]);

describe("questionnaire port", () => {
  it("calls the five operations of the author and the manual entry on their paths", async () => {
    const { transport, port } = setup();
    transport
      .mockResolvedValueOnce(Response.json({ questionnaires: [{ id, title: "T", state: "draft", createdOn: "2026-11-20", questionCount: 1, responseCount: 0 }] }))
      .mockResolvedValueOnce(Response.json(full))
      .mockResolvedValueOnce(Response.json(full, { status: 201 }))
      .mockResolvedValueOnce(Response.json(full))
      .mockResolvedValueOnce(Response.json({ id, state: "open" }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const body = { title: "T", questions: [{ kind: "single" as const, text: "K?", options: [{ code: "da", label: "Da" }, { code: "ne", label: "Ne" }] }] };
    expect(await port.list(course)).toMatchObject({ kind: "ready", value: [{ id, responseCount: 0 }] });
    expect(await port.read(id)).toMatchObject({ kind: "ready", value: { id } });
    expect(await port.create(course, body)).toMatchObject({ kind: "ready" });
    expect(await port.change(id, body)).toMatchObject({ kind: "ready" });
    expect(await port.setState(id, "open")).toEqual({ kind: "ready", value: "open" });
    expect(await port.addSheet(id, [{ questionId: q1, value: "da" }])).toEqual({ kind: "ready", value: null });
    expect(sent(transport).map(([url, method]) => `${method} ${url}`)).toEqual([
      `GET /api/v1/teacher/courses/${course}/questionnaires`,
      `GET /api/v1/teacher/questionnaires/${id}`,
      `POST /api/v1/teacher/courses/${course}/questionnaires`,
      `PATCH /api/v1/teacher/questionnaires/${id}`,
      `POST /api/v1/teacher/questionnaires/${id}/state`,
      `POST /api/v1/teacher/questionnaires/${id}/responses/manual`,
    ]);
    expect(sent(transport)[4]![2]).toEqual({ state: "open" });
    expect(sent(transport)[5]![2]).toEqual({ answers: [{ questionId: q1, value: "da" }] });
  });

  it("maps statuses: 401 signed out, 404 not found (also for another teacher's id), 409, 422, the rest unavailable", async () => {
    const { transport, port } = setup();
    const code = (status: number, error: string) => Response.json({ error }, { status });
    transport
      .mockResolvedValueOnce(code(401, "unauthorized"))
      .mockResolvedValueOnce(code(404, "not_found"))
      .mockResolvedValueOnce(code(409, "conflict"))
      .mockResolvedValueOnce(code(422, "invalid_input"))
      .mockResolvedValueOnce(code(503, "unavailable"))
      .mockResolvedValueOnce(code(500, "boom"));
    expect((await port.read(id)).kind).toBe("signedOut");
    expect((await port.read(id)).kind).toBe("notFound");
    expect((await port.setState(id, "closed")).kind).toBe("conflict");
    expect((await port.addSheet(id, [{ questionId: q1, value: "da" }])).kind).toBe("invalid");
    expect((await port.list(course)).kind).toBe("unavailable");
    expect((await port.list(course)).kind).toBe("unavailable");
  });

  it("never turns a broken answer, a broken connection or a refused input into an empty list", async () => {
    const { transport, port } = setup();
    transport.mockResolvedValueOnce(Response.json({ questionnaires: "none" })).mockRejectedValueOnce(new TypeError("offline"));
    expect((await port.list(course)).kind).toBe("unavailable");
    expect((await port.list(course)).kind).toBe("unavailable");
    expect((await port.read("nije-uuid")).kind).toBe("invalid");
    expect(transport).toHaveBeenCalledTimes(2);
  });
});
