import { describe, expect, it, vi } from "vitest";

import { createApi } from "./api";
import vectors from "./migration-contract-vectors.generated.json" with { type: "json" };
import { readAssignmentVersion, readWorkLanguage, writeWorkLanguage } from "./teacher-assignment";

const vector = vectors.find((item) => item.route === "institution.assignment.get" && item.name === "current")!;
const assignmentId = vector.request.params!.assignmentId!;
const documentId = "izmišljeni rad/1";
const workLanguage = { title: "Izmišljeni seminar", assignmentLanguage: "hr", exception: null };
const baseUrl = "https://ductura.example.invalid";
const workPath = `/api/v1/institution/assignments/${assignmentId}/works/${encodeURIComponent(documentId)}/work-language`;

function server(status: number, body: unknown) {
  const fetchImpl = vi.fn<typeof fetch>(async () => Response.json(body, { status }));
  return { api: createApi({ baseUrl, fetchImpl }), fetchImpl };
}

describe("teacher assignment API", () => {
  it("loads the exact current version for the assignment", async () => {
    const { api } = server(200, vector.response.body);
    await expect(readAssignmentVersion(assignmentId.toUpperCase(), api)).resolves.toEqual({ kind: "ready", value: vector.response.body });
    await expect(readAssignmentVersion("00000000-0000-4000-8000-000000000000", api)).resolves.toEqual({ kind: "unavailable" });
  });

  it("loads the work language by encoded document ID", async () => {
    const { api, fetchImpl } = server(200, workLanguage);
    await expect(readWorkLanguage(assignmentId, documentId, api)).resolves.toEqual({ kind: "ready", value: workLanguage });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(baseUrl + workPath);
    expect(init?.method).toBe("GET");
    expect(init?.body).toBeUndefined();
  });

  it.each([
    [401, "unauthorized", "signedOut"], [403, "forbidden", "notTeacher"],
    [404, "not_found", "notFound"], [503, "unavailable", "unavailable"],
  ] as const)("maps a %s %s read to %s", async (status, code, kind) => {
    const { api } = server(status, { code });
    await expect(readAssignmentVersion(assignmentId, api)).resolves.toEqual({ kind });
    await expect(readWorkLanguage(assignmentId, documentId, api)).resolves.toEqual({ kind });
  });

  it("rejects an unconfirmed read and a dot path segment", async () => {
    const { api, fetchImpl } = server(200, { ...workLanguage, exception: "xx" });
    await expect(readWorkLanguage(assignmentId, documentId, api)).resolves.toEqual({ kind: "unavailable" });
    await expect(readWorkLanguage(assignmentId, "..", api)).resolves.toEqual({ kind: "notFound" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("states network failures for reads and writes", async () => {
    const api = createApi({ baseUrl, fetchImpl: vi.fn<typeof fetch>().mockRejectedValue(new TypeError("offline")) });
    await expect(readAssignmentVersion(assignmentId, api)).resolves.toEqual({ kind: "unavailable" });
    await expect(readWorkLanguage(assignmentId, documentId, api)).resolves.toEqual({ kind: "unavailable" });
    await expect(writeWorkLanguage(assignmentId, documentId, "en", api)).resolves.toEqual({ kind: "unavailable" });
  });

  it("posts only the language, and accepts the server's effective language after removal", async () => {
    const { api, fetchImpl } = server(200, { language: "hr" });
    await expect(writeWorkLanguage(assignmentId, documentId, null, api)).resolves.toEqual({ kind: "saved", language: "hr" });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(baseUrl + workPath);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ language: null });
    await expect(writeWorkLanguage(assignmentId, documentId, "en", api)).resolves.toEqual({ kind: "unavailable" });
  });
});
