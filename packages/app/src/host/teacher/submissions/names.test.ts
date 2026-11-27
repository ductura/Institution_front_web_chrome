import { describe, expect, it } from "vitest";

import type { OverviewRow } from "../../../../../../src/client/teacher-reads.ts";
import { namesOf } from "./names";

const row = (studentId: string, name: string | null): OverviewRow => ({
  studentId, name, group: null, submitted: false, requestedMinute: null, afterDeadline: false, evidenceRecord: null,
});

describe("namesOf (WEB-PREDAJE-IMENA)", () => {
  it("maps each named student to the name and leaves an unnamed one out", () => {
    expect(namesOf([row("a", "Ana Primjerić"), row("b", null)])).toEqual({ a: "Ana Primjerić" });
  });
});
