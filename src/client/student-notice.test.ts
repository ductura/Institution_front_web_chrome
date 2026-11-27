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

// F4-STU-R11: the previous version the student saw, when the teacher changed the notice (API 1.170.0).
const previousVersion = {
  versionNo: 1, title: body.title, instructions: body.instructions, workType: body.workType, opensAt: body.opensAt,
  dueAt: "2099-01-08T22:59:00.000Z", aiPolicy: "partially_allowed", aiPurposes: ["proofreading"],
  evidenceProfile: body.evidenceProfile, wordMin: 1200, wordMax: 1600,
};

it("passes the previous version of the notice on to the view", async () => {
  const read = await readStudentNotice(assignmentId, client({ ...body, previousVersion }).api);
  expect(read).toMatchObject({ kind: "available", view: { versionNo: 2, previousVersion } });
});

it.each([undefined, null])("leaves the view without a previous version when the server sends %s", async (value) => {
  // The "unread" vector carries a previous version; the field is taken out so that it is really absent.
  const { previousVersion: _carried, ...withoutPrevious } = body;
  const read = await readStudentNotice(assignmentId, client(value === undefined ? withoutPrevious : { ...body, previousVersion: value }).api);
  expect(read.kind).toBe("available");
  expect(read.kind === "available" && "previousVersion" in read.view).toBe(false);
});

it("drops a previous version that does not hold together and keeps the notice", async () => {
  const broken = { ...previousVersion, aiPolicy: "prohibited", aiPurposes: ["proofreading"] };
  const read = await readStudentNotice(assignmentId, client({ ...body, previousVersion: broken }).api);
  expect(read.kind).toBe("available");
  expect(read.kind === "available" && "previousVersion" in read.view).toBe(false);
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
