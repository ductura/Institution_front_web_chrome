import { describe, expect, it, vi } from "vitest";

import { createApi } from "@/client/api";

import { copyAssignment } from "./client";

const origin = "https://ductura.example.invalid";
const assignmentId = "00000000-0000-4000-8000-0000000000a1";
const courseId = "00000000-0000-4000-8000-0000000000b2";
const requestKey = "00000000-0000-4000-8000-000000190401";
const id = "00000000-0000-4000-8000-000000190402";

describe("assignment copy through the shared API client", () => {
  it("sends only the target and request key, and accepts the new assignment from the server", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id, versionNo: 1 }, { status: 201 }));
    const api = createApi({ baseUrl: origin, fetchImpl });

    await expect(copyAssignment(assignmentId, courseId, requestKey, api)).resolves.toEqual({ kind: "copied", id });
    const [url, request] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(`${origin}/api/v1/teacher/assignments/${assignmentId}/copy`);
    expect(request?.method).toBe("POST");
    expect(JSON.parse(String(request?.body))).toEqual({ courseId, requestKey });
  });

  it.each([
    [401, "unauthorized", "signedOut"],
    [404, "not_found", "missing"],
    [409, "conflict", "conflict"],
    [422, "invalid_input", "invalid"],
    [503, "unavailable", "unconfirmed"],
  ])("maps status %i to the corresponding copy result", async (status, error, kind) => {
    const api = createApi({ baseUrl: origin, fetchImpl: async () => Response.json({ error }, { status }) });
    await expect(copyAssignment(assignmentId, courseId, requestKey, api)).resolves.toEqual({ kind });
  });

  it("does not confirm a copy when the network fails", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("Network unavailable"));
    const api = createApi({ baseUrl: origin, fetchImpl });
    await expect(copyAssignment(assignmentId, courseId, requestKey, api)).resolves.toEqual({ kind: "unconfirmed" });
  });
});
