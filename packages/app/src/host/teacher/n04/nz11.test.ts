// NZ-11: filters by state, order by surname or by state, and "Nije započelo n" on the roster. Invented data only.
import { describe, expect, it } from "vitest";

import { listedStudents, notStartedCount, stateOptions, type RosterStudent, type RosterWork } from "./model";

const work = (over: Partial<RosterWork>): RosterWork => ({ assignmentId: "a", title: "T", workType: "essay", status: "submitted", ...over });
const student = (id: string, name: string | null, group: string | null, ...works: RosterWork[]): RosterStudent => ({ studentId: id, name, group, works });

const STUDENTS = [
  student("1", "Ana Šarić", "Grupa 2", work({ status: "submitted", afterDeadline: false })),
  student("2", "Ivan Babić", "Grupa 4", work({ status: "not_submitted" })),
  student("3", "Marta Čović", "Grupa 2", work({ status: "writing" })),
  student("4", "Luka Ćosić", "Grupa 4", work({ status: "submitted", afterDeadline: true })),
  student("5", "Eva Ban", "Grupa 2", work({ status: "submitted", revision: { state: "open", deadline: null } })),
  student("6", null, null),
];
const names = (list: readonly RosterStudent[]) => list.map((s) => s.name);

describe("NZ-11 state filters", () => {
  it("counts the students of each state and lists a state nobody is in with 0", () => {
    expect(stateOptions(STUDENTS).map((o) => o.label)).toEqual([
      "Sva stanja (6)", "Nije započelo (1)", "Piše (1)", "Predano (3)", "Nakon roka (1)", "Dorada (1)",
    ]);
    expect(stateOptions([]).at(-1)?.label).toBe("Dorada (0)");
  });
  it("filters by state and by group together", () => {
    expect(names(listedStudents(STUDENTS, "", "late", "surname"))).toEqual(["Luka Ćosić"]);
    expect(names(listedStudents(STUDENTS, "Grupa 2", "submitted", "surname"))).toEqual(["Eva Ban", "Ana Šarić"]);
    expect(names(listedStudents(STUDENTS, "Grupa 4", "writing", "surname"))).toEqual([]);
    expect(names(listedStudents(STUDENTS, "", "revision", "surname"))).toEqual(["Eva Ban"]);
  });
  it("says how many have not started, from the whole roster", () => {
    expect(notStartedCount(STUDENTS)).toBe(1);
    expect(notStartedCount([])).toBe(0);
  });
});

describe("NZ-11 order", () => {
  it("by surname puts a student without a name last and sorts Croatian letters properly", () => {
    expect(names(listedStudents(STUDENTS, "", "", "surname"))).toEqual(["Ivan Babić", "Eva Ban", "Marta Čović", "Luka Ćosić", "Ana Šarić", null]);
  });
  it("by state puts what waits for the teacher first and keeps the order by surname inside a state", () => {
    expect(names(listedStudents(STUDENTS, "", "", "state"))).toEqual(["Eva Ban", "Ivan Babić", "Marta Čović", "Luka Ćosić", "Ana Šarić", null]);
  });
});
