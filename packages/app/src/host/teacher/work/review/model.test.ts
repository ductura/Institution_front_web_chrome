import { describe, expect, it } from "vitest";

import type { Facts } from "../../n06/model";
import {
  contextLine, gradeNote, headingOf, matchPart, matchShareLine, partOf, reviewPath, ruleLines, stateOf, tabOf, taskPath,
  type Header,
} from "./model";
import { reviewMessages as t } from "./messages.hr";

// Invented work, student and course only.
const FACTS: Facts = {
  studentName: "Student A", assignmentId: "00000000-0000-4000-8000-0000000000a1", state: "nije_predano",
  previousId: null, nextId: "rad-b", receipt: null,
};
const CONTEXT = { course: "Kolegij A", title: "Lokalni mediji", workType: "seminar_paper", dueAt: "2026-11-30T22:59:00.000Z" } as const;
const header = (over: Partial<Header> = {}): Header => ({ facts: FACTS, context: CONTEXT, grade: "eligible", ...over });

describe("WEB-NUZ-PG PG-1: header with the context of the work", () => {
  it("names course, assignment, kind of work and deadline", () => {
    expect(contextLine(header())).toBe("Kolegij A, zadatak „Lokalni mediji”");
    expect(headingOf(header())).toBe("Student A, Seminarski rad „Lokalni mediji”");
    expect(stateOf(header())).toBe("U pisanju, prikaz se osvježava dok student piše, rok 30. studenoga 2026. u 23:59");
  });

  it("says what the server did not give instead of guessing", () => {
    expect(contextLine(header({ context: null }))).toBe(`${t.courseUnavailable}, ${t.titleUnavailable}`);
    expect(headingOf(header({ context: null, facts: { ...FACTS, studentName: null } }))).toBe(`${t.noName}, Rad`);
    expect(stateOf(header({ context: null }))).toContain(t.dueUnavailable);
  });

  it("marks a practice assignment and keeps the receipt line of a submitted work", () => {
    expect(contextLine(header({ grade: "practice" }))).toBe("Kolegij A, zadatak „Lokalni mediji”, probni zadatak");
    const receipt = { submittedAt: "2026-11-20T10:00:00.000Z", dueAt: "2026-11-30T22:59:00.000Z", afterDeadline: false, version: 2, record: "continuous" } as const;
    const line = stateOf(header({ facts: { ...FACTS, state: "predano", receipt } }));
    expect(line).toBe("Predano 20. studenoga 2026. u 11:00, rok 30. studenoga 2026. u 23:59, verzija 2, zapis je cjelovit");
  });

  it("keeps the open tab in the address for the previous and next work", () => {
    expect(tabOf("?kartica=izjava")).toBe("izjava");
    expect(tabOf("?kartica=nepoznato")).toBe("tekst");
    expect(tabOf("")).toBe("tekst");
    expect(reviewPath("/nastavnik/rad/rad-b", "sazetak")).toBe("/nastavnik/rad/rad-b/pregled?kartica=sazetak");
    expect(reviewPath("/nastavnik/rad/rad-b", "tekst")).toBe("/nastavnik/rad/rad-b/pregled");
    expect(taskPath(FACTS.assignmentId)).toBe(`/nastavnik/zadatak/${FACTS.assignmentId}/predaje`);
  });
});

describe("WEB-NUZ-PG PG-10: the grade stays in Merlin and Studomat", () => {
  it("says so, and that no mark goes into a grade or export", () => {
    expect(gradeNote("eligible")).toEqual({ strong: "Ocjenu upisujete u Merlin i Studomat.", note: t.gradeExternalNote });
    expect(gradeNote("unknown").strong).toBe("Ocjenu upisujete u Merlin i Studomat.");
    expect(gradeNote("practice").strong).toBe("Probni zadatak se ne ocjenjuje i ne izvozi.");
  });
});

describe("WEB-NUZ-PG PG-4: not available apart from an error", () => {
  it("maps a part: 404 is not given (no retry), 503 is an error", () => {
    expect(partOf({ kind: "ok", value: 3 })).toEqual({ kind: "ready", value: 3 });
    expect(partOf({ kind: "notFound" })).toEqual({ kind: "notGiven" });
    expect(partOf({ kind: "unavailable" })).toEqual({ kind: "error" });
    expect(partOf({ kind: "signedOut" })).toEqual({ kind: "signedOut" });
  });

  it("counts findings and distinct attached conversations of the match, never more", () => {
    const finding = (conversationId: string) => ({
      segmentRef: "s1", conversationId, messageId: "00000000-0000-4000-8000-0000000000f1", runWords: 12,
      recordedAt: "2026-11-01T10:00:00.000Z", attachedAt: "2026-11-02T10:00:00.000Z",
    });
    const c1 = "00000000-0000-4000-8000-0000000000c1";
    const c2 = "00000000-0000-4000-8000-0000000000c2";
    expect(matchPart({ kind: "ready", percent: 4, findings: [finding(c1), finding(c1), finding(c2)] }))
      .toEqual({ kind: "ready", value: { percent: 4, findings: 3, conversations: 2 } });
    expect(matchPart({ kind: "none" })).toEqual({ kind: "ready", value: { percent: 0, findings: 0, conversations: 0 } });
    expect(matchPart({ kind: "unavailable" })).toEqual({ kind: "error" });
    expect(matchPart({ kind: "notFound" })).toEqual({ kind: "notGiven" });
  });

  it("puts „nije dokaz autorstva” next to every share", () => {
    expect(matchShareLine(4)).toBe("Udio teksta koji se podudara: 4 %, nije dokaz autorstva");
    expect(matchShareLine(0)).toBeNull();
  });

  it("names faculty rules in words", () => {
    expect(ruleLines([{ origin: "imported_file", state: "for_review" }, { origin: "typed", state: "in_line" }]))
      .toEqual(["Uvezeno iz datoteke: za pregled", "Tipkano u Ducturi: u skladu"]);
  });
});
