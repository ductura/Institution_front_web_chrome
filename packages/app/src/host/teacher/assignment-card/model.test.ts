import { describe, expect, it } from "vitest";

import { codeFieldText, enrolledText, nextDeadline, roleOf } from "./model";

const a = (id: string, dueAt: string) => ({ id, title: id, workType: "x", opensAt: dueAt, dueAt, currentVersion: 1, enrolledStudents: 1 });

describe("N-01 card model", () => {
  it("picks the nearest deadline not yet passed", () => {
    const course = { assignments: [a("old", "2026-10-15T21:59:00Z"), a("far", "2026-12-01T22:59:00Z"), a("near", "2026-11-08T22:59:00Z")] };
    expect(nextDeadline(course, Date.parse("2026-11-01T00:00:00Z"))?.id).toBe("near");
    expect(nextDeadline(course, Date.parse("2027-01-01T00:00:00Z"))).toBeNull();
  });
  it("says role unknown without a view and maps an assistant to collaborator", () => {
    expect(roleOf(null)).toBe("unknown");
    expect(roleOf({ role: "assistant", groups: [] } as never)).toBe("collaborator");
    expect(roleOf({ role: "holder" } as never)).toBe("holder");
  });
  it("counts students with Croatian plurals and lists groups", () => {
    const view = { role: "holder", students: [{}, {}, {}, {}], groups: [{ name: "grupa 2" }, { name: "grupa 4" }] } as never;
    expect(enrolledText(view)).toBe("4 studenta · grupa 2, grupa 4");
    expect(enrolledText(null)).toBeNull();
  });
  it("never claims a code state the server cannot give", () => {
    expect(codeFieldText("holder", null)).toContain("nije dostupno");
    expect(codeFieldText("holder", "now")).toBe("Novi kod izdan; prikazuje se samo sada.");
    expect(codeFieldText("collaborator", "now")).toBe("Izdaje nositelj kolegija.");
  });
});
