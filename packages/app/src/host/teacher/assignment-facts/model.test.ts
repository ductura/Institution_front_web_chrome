import { describe, expect, it } from "vitest";

import { assignmentFactsMessages as m } from "./messages.hr";
import { deadlineOf, factsOf, interruptedOf, publishedIn, type AssignmentReads, type StudentWork, type SubmissionDetail } from "./model";

// Invented people and ids only (the prototype's "Student A…D").
const NOW = Date.parse("2026-11-01T12:00:00Z");
const DUE = "2026-11-08T22:59:00.000Z"; // 8. 11. 2026. u 23:59 (Zagreb)
const PAST = "2026-10-15T21:59:00.000Z"; // 15. 10. 2026. u 23:59 (Zagreb)
const work = (id: string, family: string | null, state: StudentWork["state"], documentId: string | null = `doc-${id}`): StudentWork =>
  ({ studentId: id, givenName: family === null ? null : "Student", familyName: family, state, documentId: state === "not_started" ? null : documentId });
const detail = (d: Partial<SubmissionDetail>): SubmissionDetail => ({ requestedMinute: null, afterDeadline: null, revision: null, record: null, ...d });
const reads = (r: Partial<AssignmentReads>): AssignmentReads => ({ dueAt: DUE, works: [], details: new Map(), extensions: [], ...r });

describe("N-01 task facts (WEB-2145)", () => {
  it("says opened X of Y, names who has not opened and sums in words, as the prototype's taskFacts", () => {
    const facts = factsOf(reads({
      works: [work("a", "A", "submitted"), work("b", "B", "in_progress"), work("c", "C", "not_started"), work("d", "D", "in_progress")],
      details: new Map([["a", detail({ requestedMinute: "2026-10-31T21:12:00.000Z", afterDeadline: false, revision: 3, record: "continuous" })]]),
    }), NOW);
    expect(facts.opened).toBe("Otvorilo rad: 3 od 4 studenta. Rad još nisu otvorili: Student C.");
    expect(facts.sum).toBe("Zbroj: predano 1, u pisanju 2, rad nije otvoren 1.");
    expect(facts.rows.map((r) => r.line)).toEqual([
      "Predano 31. 10. 2026. u 22:12, prije roka · verzija 3 · zapis je cjelovit", "U pisanju", "Rad nije otvoren", "U pisanju",
    ]);
    expect(facts.rows.map((r) => r.documentId)).toEqual(["doc-a", "doc-b", null, "doc-d"]);
  });

  it("after the deadline: not submitted with the deadline, late submissions counted, gaps said", () => {
    const facts = factsOf(reads({
      dueAt: PAST,
      works: [work("a", "A", "submitted"), work("b", "B", "submitted"), work("d", "D", "in_progress")],
      details: new Map([
        ["a", detail({ requestedMinute: "2026-10-14T15:40:00.000Z", afterDeadline: false, revision: 1, record: "with_gaps" })],
        ["b", detail({ requestedMinute: "2026-10-16T08:05:00.000Z", afterDeadline: true, revision: 2, record: "continuous" })],
      ]),
    }), NOW);
    expect(facts.sum).toBe("Zbroj: predano 2 (od toga 1 nakon roka), nije predano 1.");
    expect(facts.opened).toBe("Otvorilo rad: 3 od 3 studenta.");
    expect(facts.rows[0]?.line).toBe("Predano 14. 10. 2026. u 17:40, prije roka · verzija 1 · zapis ima praznine");
    expect(facts.rows[1]?.line).toBe("Predano 16. 10. 2026. u 10:05, nakon roka · verzija 2 · zapis je cjelovit");
    expect(facts.rows[2]?.line).toBe("Nije predano · rok 15. 10. 2026. u 23:59 je prošao");
  });

  it("an extension keeps the student writing and is said", () => {
    const extended = [{ scope: "one" as const, studentId: "d", dueAt: DUE }];
    const facts = factsOf(reads({ dueAt: PAST, works: [work("d", "D", "in_progress")], extensions: extended }), NOW);
    expect(facts.rows[0]?.line).toBe("U pisanju · rok produljen do 8. 11. 2026. u 23:59");
    expect(deadlineOf("x", PAST, extended)).toEqual({ dueAt: PAST, extended: false });
    expect(deadlineOf("x", PAST, [{ scope: "all", studentId: null, dueAt: DUE }])).toEqual({ dueAt: DUE, extended: true });
  });

  it("leaves out what was not read, never guesses", () => {
    const failed = factsOf(reads({ works: [work("a", "A", "submitted")], details: null }), NOW);
    expect(failed.rows[0]?.line).toBe("Predano · pojedinosti predaje trenutačno nisu dostupne");
    expect(failed.sum).toBe("Zbroj: predano 1.");
    const unbound = factsOf(reads({ works: [work("a", "A", "submitted")], details: new Map([["a", detail({ revision: 1 })]]) }), NOW);
    expect(unbound.rows[0]?.line).toBe("Predano · verzija 1");
  });

  it("orders by family name, never by any figure; a missing name is said and last; an unsafe id gets no link", () => {
    const facts = factsOf(reads({ works: [work("z", null, "not_started"), work("b", "Č", "in_progress", "../x"), work("a", "C", "in_progress")] }), NOW);
    expect(facts.rows.map((r) => r.name)).toEqual(["Student C", "Student Č", m.noName]);
    expect(facts.rows[1]?.documentId).toBeNull();
    expect(facts.opened).toBe(`Otvorilo rad: 2 od 3 studenta. Rad još nisu otvorili: ${m.noName}.`);
  });

  it("no student on the assignment is its own sentence; 5 and 11 take the genitive plural", () => {
    expect(factsOf(reads({}), NOW)).toEqual({ rows: [], opened: null, sum: null });
    expect(m.opened(5, 5)).toBe("Otvorilo rad: 5 od 5 studenata.");
    expect(m.opened(11, 11)).toBe("Otvorilo rad: 11 od 11 studenata.");
    expect(m.opened(0, 1)).toBe("Otvorilo rad: 0 od 1 studenta.");
  });
});

describe("interrupted publish banner (WEB-2145)", () => {
  const courses = [{ id: "k-a", name: "Kolegij A", academicYear: "2026./2027.", aiPolicy: "prohibited" as const,
    assignments: [{ id: "t1", title: "Analiza izborne kampanje", workType: "essay", opensAt: PAST, dueAt: DUE, currentVersion: 1, enrolledStudents: 4 }] }];

  it("reads the link of the form and names the assignment as the prototype", () => {
    expect(interruptedOf(new URLSearchParams(""))).toBeNull();
    const which = interruptedOf(new URLSearchParams("objava=prekinuta&kolegij=k-a&zadatak=Analiza%20izborne%20kampanje"));
    expect(which).toEqual({ courseId: "k-a", title: "Analiza izborne kampanje" });
    expect(m.interruptedTitle(which?.title ?? null)).toBe("Objava zadatka „Analiza izborne kampanje” prekinuta je i ishod nije poznat.");
    expect(m.interruptedTitle(null)).toBe("Objava zadatka prekinuta je i ishod nije poznat.");
  });

  it("decides published only from the list the server gave", () => {
    expect(publishedIn(courses, { courseId: "k-a", title: "Analiza izborne kampanje" })).toBe(true);
    expect(publishedIn(courses, { courseId: "k-b", title: "Analiza izborne kampanje" })).toBe(false);
    expect(publishedIn(courses, { courseId: "k-a", title: "Esej" })).toBe(false);
    expect(publishedIn(courses, { courseId: "k-a", title: null })).toBeNull();
    expect(m.checkedNotPublished).toBe("Popis zadataka učitan s poslužitelja; zadatak nije objavljen.");
  });
});
