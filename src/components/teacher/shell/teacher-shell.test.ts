import { describe, expect, it } from "vitest";

import { navFor } from "../../shell/nav";
import { currentTeacherItem, teacherShellView } from "./teacher-shell";

describe("teacherShellView", () => {
  it("sends no session and an unanswered read to the sign-in", () => {
    expect(teacherShellView({ kind: "signedOut" })).toEqual({ kind: "signIn" });
    expect(teacherShellView({ kind: "unavailable" })).toEqual({ kind: "signIn" });
  });

  it("shows an account without a role A-5", () => {
    expect(teacherShellView({ kind: "noRole" })).toEqual({ kind: "noRole" });
  });

  it("gives the teacher shell only to the teacher role the server read", () => {
    expect(teacherShellView({ kind: "signedIn", role: "teacher", institution: "Demo fakultet" }))
      .toEqual({ kind: "teacher", institution: "Demo fakultet" });
    expect(teacherShellView({ kind: "signedIn", role: "student", institution: null }))
      .toEqual({ kind: "otherRole", role: "student", institution: null });
    expect(teacherShellView({ kind: "signedIn", role: "admin", institution: "Demo fakultet" }))
      .toEqual({ kind: "otherRole", role: "admin", institution: "Demo fakultet" });
  });
});

describe("currentTeacherItem", () => {
  const items = [
    { href: "/nastavnik", label: "Moji kolegiji" },
    { href: "/nastavnik/brz-put", label: "Brz put" },
    { href: "/nastavnik/zbirni", label: "Zbirni pregled" },
  ];

  it("picks the item of the path itself, with or without a trailing slash", () => {
    expect(currentTeacherItem("/nastavnik", items)?.href).toBe("/nastavnik");
    expect(currentTeacherItem("/nastavnik/", items)?.href).toBe("/nastavnik");
    expect(currentTeacherItem("/nastavnik/zbirni", items)?.href).toBe("/nastavnik/zbirni");
  });

  it("picks the longest parent item for a page below it", () => {
    expect(currentTeacherItem("/nastavnik/brz-put/x", items)?.href).toBe("/nastavnik/brz-put");
    expect(currentTeacherItem("/nastavnik/zadatak/novi", items)?.href).toBe("/nastavnik");
  });

  it("does not take a prefix that is not a parent path", () => {
    expect(currentTeacherItem("/nastavnik/zbirnik", items)?.href).toBe("/nastavnik");
    expect(currentTeacherItem("/nastavnikx", items)).toBeUndefined();
    expect(currentTeacherItem("/zadaci", items)).toBeUndefined();
  });

  it("reads the teacher's own navigation by default", () => {
    expect(currentTeacherItem("/nastavnik")).toEqual(navFor("teacher")[0]);
  });
});
