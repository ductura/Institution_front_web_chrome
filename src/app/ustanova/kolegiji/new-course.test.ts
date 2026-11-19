import { describe, expect, it } from "vitest";

import { academicYears, createOutcome, GROUPS_MAX, newCourseInput, type NewCourseFields } from "./new-course";

// Invented values only.
const HOLDER = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const FIELDS: NewCourseFields = {
  name: "  Izmišljeni kolegij A  ",
  academicYear: "2026/2027",
  aiPolicy: "partially_allowed",
  holderId: ` ${HOLDER} `,
  groups: "Grupa 1\n\n  Grupa 2 \r\n",
};

describe("academicYears", () => {
  it("starts the academic year on 1 October", () => {
    expect(academicYears(new Date(2026, 10, 19))).toEqual(["2026/2027", "2027/2028"]);
    expect(academicYears(new Date(2026, 9, 1))).toEqual(["2026/2027", "2027/2028"]);
    expect(academicYears(new Date(2026, 8, 30))).toEqual(["2025/2026", "2026/2027"]);
  });
});

describe("newCourseInput", () => {
  it("trims the fields and drops empty group lines", () => {
    expect(newCourseInput(FIELDS)).toEqual({
      ok: true,
      input: { name: "Izmišljeni kolegij A", academicYear: "2026/2027", aiPolicy: "partially_allowed", holderId: HOLDER, groups: ["Grupa 1", "Grupa 2"] },
    });
  });

  it("allows a course without groups", () => {
    const read = newCourseInput({ ...FIELDS, groups: " \n " });
    expect(read.ok && read.input.groups).toEqual([]);
  });

  it("names each field that breaks the contract", () => {
    expect(newCourseInput({ ...FIELDS, name: "   ", holderId: "demo-teacher-2" })).toEqual({
      ok: false, errors: { name: "nameRequired", holderId: "holderInvalid" },
    });
    expect(newCourseInput({ ...FIELDS, name: "č".repeat(161) })).toMatchObject({ ok: false, errors: { name: "nameTooLong" } });
    expect(newCourseInput({ ...FIELDS, name: "č".repeat(160) }).ok).toBe(true);
  });

  it("limits the groups as the contract does", () => {
    const many = Array.from({ length: GROUPS_MAX + 1 }, (_, i) => `G${i}`).join("\n");
    expect(newCourseInput({ ...FIELDS, groups: many })).toMatchObject({ errors: { groups: "groupsTooMany" } });
    expect(newCourseInput({ ...FIELDS, groups: "g".repeat(81) })).toMatchObject({ errors: { groups: "groupTooLong" } });
    expect(newCourseInput({ ...FIELDS, groups: "Grupa A\ngrupa a" })).toMatchObject({ errors: { groups: "groupDuplicate" } });
  });

  it("refuses a year or policy outside the offered options", () => {
    expect(newCourseInput({ ...FIELDS, aiPolicy: "allowed" }).ok).toBe(false);
    expect(newCourseInput({ ...FIELDS, academicYear: "2026-2027" }).ok).toBe(false);
  });
});

describe("createOutcome", () => {
  it("maps each answer of institution.admin-courses.post", () => {
    expect(createOutcome({ ok: true, status: 200 })).toBe("created");
    expect(createOutcome({ ok: false, status: 401, code: "unauthorized" })).toBe("signedOut");
    expect(createOutcome({ ok: false, status: 401, code: "session_expired" })).toBe("signedOut");
    expect(createOutcome({ ok: false, status: 403, code: "forbidden" })).toBe("forbidden");
    expect(createOutcome({ ok: false, status: 403, code: "origin_mismatch" })).toBe("unavailable");
    expect(createOutcome({ ok: false, status: 409, code: "conflict" })).toBe("conflict");
    expect(createOutcome({ ok: false, status: 422, code: "invalid_input" })).toBe("invalid");
    expect(createOutcome({ ok: false, status: 0, code: "client_rejected" })).toBe("invalid");
    expect(createOutcome({ ok: false, status: 503, code: "unavailable" })).toBe("unavailable");
    expect(createOutcome({ ok: false, status: 0, code: "unexpected" })).toBe("unavailable");
  });
});
