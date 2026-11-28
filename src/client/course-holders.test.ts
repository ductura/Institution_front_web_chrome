import { describe, expect, it, vi } from "vitest";

import { courseHolders, readCourseHolders } from "./course-holders";

const roles = {
  pending: [],
  confirmed: [
    { personId: "00000000-0000-4000-8000-000000000001", name: { givenName: "Ana", familyName: "Izmišljena" }, confirmedAt: "2026-01-01T00:00:00Z", forReview: false },
    { personId: "00000000-0000-4000-8000-000000000002", name: null, confirmedAt: "2026-01-02T00:00:00Z", forReview: true },
  ],
};
const api = (answer: unknown) => vi.fn(async () => answer) as never;

describe("readCourseHolders", () => {
  it("lists the confirmed teachers by personId, keeping the server order and an unnamed person", async () => {
    const call = api({ ok: true, status: 200, body: roles });
    expect(await readCourseHolders(call)).toEqual({ kind: "ready", holders: courseHolders(roles) });
    expect(courseHolders(roles)).toEqual([
      { personId: "00000000-0000-4000-8000-000000000001", name: { givenName: "Ana", familyName: "Izmišljena" } },
      { personId: "00000000-0000-4000-8000-000000000002", name: null },
    ]);
  });

  it("maps each failure", async () => {
    expect(await readCourseHolders(api({ ok: false, status: 401, code: "unauthorized" }))).toEqual({ kind: "signedOut" });
    expect(await readCourseHolders(api({ ok: false, status: 403, code: "forbidden" }))).toEqual({ kind: "forbidden" });
    expect(await readCourseHolders(api({ ok: false, status: 503, code: "unavailable" }))).toEqual({ kind: "unavailable" });
    expect(await readCourseHolders((async () => { throw new Error("x"); }) as never)).toEqual({ kind: "unavailable" });
  });
});
