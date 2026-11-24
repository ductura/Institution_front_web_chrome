// WEB-2113: the tests of src/components/student/upis/enroll.test.ts for the host's own copy.
import { describe, expect, it, vi } from "vitest";

import { createApi } from "@/client/api";

import { enroll, normalizeCode } from "./enroll";
import { enrolError } from "./model";

const COURSE = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function apiWith(reply: () => Response | Promise<Response>) {
  const send = vi.fn(async (_url: URL | RequestInfo, _init?: RequestInit) => reply());
  return { send, api: createApi({ baseUrl: "http://web.test", fetchImpl: send as unknown as typeof fetch }) };
}

describe("WEB-11 enrollment over student.enrollments.post", () => {
  it("normalizes the code as the server compares it", () => {
    expect(normalizeCode(" upis-2026 demo ")).toBe("UPIS2026DEMO");
    for (const bad of ["", "ABC-123", "A".repeat(33), "ABCD-1234-ČĆŽŠ", "x".repeat(65)]) expect(normalizeCode(bad)).toBeNull();
  });

  it("posts only the normalized code to /api/v1/student/enrollments", async () => {
    const { send, api } = apiWith(() => json({ outcome: "enrolled", courseId: COURSE }));
    expect(await enroll("upis2026-demo", api)).toEqual({ kind: "enrolled", courseId: COURSE });
    const [url, init] = send.mock.calls[0]!;
    expect(String(url)).toBe("http://web.test/api/v1/student/enrollments");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ code: "UPIS2026DEMO" });
  });

  it.each([
    ["already_enrolled", "alreadyEnrolled"],
    ["enrolled_no_assignment", "noAssignment"],
  ] as const)("keeps the outcome %s as %s with the course", async (outcome, kind) => {
    const { api } = apiWith(() => json({ outcome, courseId: COURSE }));
    expect(await enroll("UPIS2026DEMO", api)).toEqual({ kind, courseId: COURSE });
  });

  it("does not send a code that can never match", async () => {
    const { send, api } = apiWith(() => json({}));
    expect(await enroll("12-34", api)).toEqual({ kind: "malformed" });
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    [422, "invalid_code", "invalidCode"],
    [422, "expired_code", "expiredCode"],
    [429, "too_many_attempts", "tooManyAttempts"],
    [401, "unauthorized", "signedOut"],
    [403, "forbidden", "forbidden"],
    [403, "origin_mismatch", "invalid"],
    [415, "unsupported_media_type", "invalid"],
    [503, "unavailable", "unavailable"],
    [500, "anything", "unavailable"],
  ] as const)("maps HTTP %i %s to %s", async (status, error, kind) => {
    const { api } = apiWith(() => json({ error }, status));
    expect(await enroll("STARI2025KOD", api)).toEqual({ kind });
  });

  it("treats a success body outside the contract as unavailable", async () => {
    const { api } = apiWith(() => json({ outcome: "enrolled", courseId: COURSE, extra: 1 }));
    expect(await enroll("UPIS2026DEMO", api)).toEqual({ kind: "unavailable" });
  });

  it("tells a request that never reached the server apart", async () => {
    const { api } = apiWith(() => { throw new TypeError("network"); });
    expect(await enroll("UPIS2026DEMO", api)).toEqual({ kind: "offline" });
  });

  it("gives every refused attempt a text and none for an enrollment", () => {
    const kinds = ["malformed", "invalidCode", "expiredCode", "tooManyAttempts", "signedOut", "forbidden", "invalid",
      "unavailable", "offline"] as const;
    // Every refusal has its text (the prototype's or the shared one); invalidCode and expiredCode share one in the host.
    const texts = kinds.map((kind) => enrolError({ kind }));
    expect(texts.every((text) => typeof text === "string" && text.length > 0)).toBe(true);
    expect(enrolError({ kind: "alreadyEnrolled", courseId: COURSE })).toBeNull();
    expect(enrolError(null)).toBeNull();
  });
});
