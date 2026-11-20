import { expect, it, vi } from "vitest";
import { createApi } from "./api";
import vectors from "./migration-contract-vectors.generated.json" with { type: "json" };
import { readStudentNotice } from "./student-notice";

const ORIGIN = "https://ductura.example.invalid";
const vector = vectors.find(({ route, name }) => route === "student.notice.get" && name === "unread")!;
const { body } = vector.response;
const assignmentId = vector.request.params!.assignmentId!;

function client(body: unknown, status = 200) {
  const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(body, { status }));
  return { fetchImpl, api: createApi({ baseUrl: ORIGIN, fetchImpl }) };
}

it("reads the current notice and its read and acknowledgment status from the server", async () => {
  const server = { ...body, readAt: "2026-11-03T09:14:00.000Z", acknowledgedAt: "2026-11-03T09:20:00.000Z" };
  const { fetchImpl, api } = client(server);
  expect(await readStudentNotice(assignmentId, api)).toMatchObject({
    kind: "available", readAt: server.readAt,
    view: { assignmentId, versionNo: 2, acknowledgedAt: server.acknowledgedAt },
  });
  expect(fetchImpl).toHaveBeenCalledWith(
    new URL(`${ORIGIN}/api/v1/student/assignments/${assignmentId}/notice`),
    expect.objectContaining({ method: "GET", body: undefined }),
  );
});

it.each([
  [401, "signedOut"], [403, "notFound"], [404, "notFound"], [503, "unavailable"],
] as const)("reports HTTP %s as %s", async (status, kind) => {
  expect(await readStudentNotice(assignmentId, client({}, status).api)).toEqual({ kind });
});

it("treats an invalid assignment id as not found before issuing the request", async () => {
  const { api, fetchImpl } = client(body);
  expect(await readStudentNotice("izmisljeni-nevaljani-id", api)).toEqual({ kind: "notFound" });
  expect(fetchImpl).not.toHaveBeenCalled();
});

it.each([
  { assignmentId: "00000000-0000-4000-8000-000000000002" },
  { templateVersion: 2 },
  { opensAt: "2026-02-31T08:00:00.000Z" },
  { aiPolicy: "prohibited" },
  { unexpected: true },
])("rejects unusable responses even with HTTP 200 (%j)", async (patch) => {
  expect(await readStudentNotice(assignmentId, client({ ...body, ...patch }).api)).toEqual({ kind: "unavailable" });
});
