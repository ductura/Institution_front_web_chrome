// WEB-NUZ-NZ NZ-1 and NZ-2: the entries of one assignment and the course's task chooser. Invented data.
import { describe, expect, it } from "vitest";

import { PAGES } from "../../../routes";
import { assignmentCardMessages as t } from "./messages.hr";
import { courseOverviewPath, issueCodePath, pickedPath, taskOptionLabel, taskOptions, taskPaths } from "./model";

const A1 = "00000000-0000-4000-8000-0000000000a1";
const A2 = "00000000-0000-4000-8000-0000000000a2";
const NOW = Date.parse("2026-11-24T10:00:00.000Z");
const course = {
  assignments: [
    { id: A1, title: "Kućno kompostiranje", dueAt: "2026-12-15T22:59:00.000Z" },
    { id: A2, title: "Prikaz članka", dueAt: "2026-11-08T22:59:00.000Z" },
  ],
} as unknown as Parameters<typeof taskOptions>[0];

/** A path of the host matches a route of src/routes.ts (a `[param]` stands for one segment). */
const routed = (path: string) => PAGES.some((page) => {
  const pattern = new RegExp(`^${page.path.replace(/\[[^\]]+\]/g, "[^/]+")}$`);
  return pattern.test(path.split("?")[0]!);
});

describe("NZ-1: every entry of an assignment is a page of the host", () => {
  it("leads to Predaje, Uredi, Kopiraj, Produljenje, Izvoz and Brz put of that assignment", () => {
    const paths = taskPaths(A1);
    expect(paths).toEqual({
      submissions: `/nastavnik/zadatak/${A1}/predaje`,
      edit: `/nastavnik/zadatak/${A1}/uredi`,
      copy: `/nastavnik/zadatak/${A1}/uredi?kopiraj=1`,
      extension: `/nastavnik/zadatak/${A1}/produljenje`,
      merlin: `/nastavnik/zadatak/${A1}/merlin`,
      fastPath: `/nastavnik/brz-put?zadatak=${A1}`,
    });
    for (const path of Object.values(paths)) expect(routed(path), path).toBe(true);
  });
  it("sends the course overview and the new code to routes that exist", () => {
    expect(courseOverviewPath("k 1")).toBe("/nastavnik/zbirni?kolegij=k%201");
    expect(issueCodePath("k1")).toBe("/nastavnik?kod=k1");
    expect(routed(courseOverviewPath("k1"))).toBe(true);
    expect(routed(issueCodePath("k1"))).toBe(true);
    expect(routed("/nastavnik/novi-zadatak")).toBe(false);
  });
  it("encodes an id it does not trust", () => {
    expect(taskPaths("a/../b").submissions).toBe("/nastavnik/zadatak/a%2F..%2Fb/predaje");
  });
});

describe("NZ-2: the task chooser", () => {
  it("offers every assignment, one whose deadline has passed too", () => {
    expect(taskOptions(course, NOW)).toEqual([
      { value: A1, label: "Kućno kompostiranje, rok 15. 12. 2026. u 23:59" },
      { value: A2, label: `Prikaz članka, ${t.deadlinePassed}` },
    ]);
  });
  it("says the deadline in words and keeps an unreadable one as it is", () => {
    expect(taskOptionLabel({ title: "X", dueAt: "nije datum" }, NOW)).toBe("X, rok nije datum");
  });
  it("goes only to an assignment of this course", () => {
    expect(pickedPath(course, "extension", A2)).toBe(`/nastavnik/zadatak/${A2}/produljenje`);
    expect(pickedPath(course, "merlin", A1)).toBe(`/nastavnik/zadatak/${A1}/merlin`);
    expect(pickedPath(course, "merlin", "")).toBeNull();
    expect(pickedPath(course, "extension", "00000000-0000-4000-8000-0000000000ff")).toBeNull();
  });
  it("uses the prototype's words", () => {
    expect(t.extension).toBe("Produljenje roka…");
    expect(t.merlin).toBe("Izvoz za Merlin…");
    expect([t.submissions, t.edit, t.copy, t.taskExtension, t.taskMerlin, t.fastPath])
      .toEqual(["Predaje", "Uredi (nova verzija)", "Dupliciraj zadatak", "Produljenje", "Izvoz", "Brz put kroz radove"]);
  });
});
