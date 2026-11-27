// DIZ S-02/S-04 (Z7, R8): 403 on the courses read is "denied", not "unavailable"; 401 stays signedOut.
import { describe, expect, it } from "vitest";

import { readCourses, type CoursesCall } from "./read";

const failing = (status: number): CoursesCall => (async () => ({ ok: false, status })) as unknown as CoursesCall;

describe("readCourses statuses", () => {
  it("keeps 401, 403 and the rest apart", async () => {
    expect(await readCourses(failing(401), true)).toEqual({ kind: "signedOut" });
    expect(await readCourses(failing(403), true)).toEqual({ kind: "denied" });
    expect(await readCourses(failing(500), true)).toEqual({ kind: "unavailable" });
  });
});
