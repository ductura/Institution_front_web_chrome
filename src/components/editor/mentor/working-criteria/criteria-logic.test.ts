import { describe, expect, it } from "vitest";

import { CRITERION_IDS, NOTE_MAX, type WorkingCriterion } from "@/client/teacher-working-criteria";

import { afterWrite, assessmentChange, criterionTitle, doneCount, failureText, headingText, noteChange, withSaved } from "./criteria-logic";
import { workingCriteriaHr as t } from "./messages.hr";

const c = (n: number, over: Partial<WorkingCriterion> = {}): WorkingCriterion =>
  ({ id: CRITERION_IDS[n - 1]!, label: `workingCriteria.${CRITERION_IDS[n - 1]!}`, assessment: null, note: null, ...over });
const six = [1, 2, 3, 4, 5, 6].map((n) => c(n));

describe("criteria logic", () => {
  it("counts the assessed criteria in the heading", () => {
    expect(headingText(six)).toBe("Kriteriji ocjene · 0 od 6");
    const list = withSaved(six, c(2, { assessment: 2 }));
    expect(doneCount(list)).toBe(1);
    expect(headingText(list)).toBe("Kriteriji ocjene · 1 od 6");
    expect(list.map((x) => x.id)).toEqual(CRITERION_IDS);
  });
  it("names each criterion by its id, never by the server's message key", () => {
    expect(six.map(criterionTitle)).toEqual([
      "Tema, cilj i istraživačko pitanje", "Struktura i logika izlaganja", "Izvori i citiranje",
      "Metoda i analiza", "Jezik i stil", "Tehnička obrada",
    ]);
  });
  it("clears the assessment on a second click of the same one and keeps the note", () => {
    expect(assessmentChange(c(1, { note: "n" }), 1)).toEqual({ assessment: 1, note: "n" });
    expect(assessmentChange(c(1, { assessment: 1, note: "n" }), 1)).toEqual({ assessment: null, note: "n" });
    expect(assessmentChange(c(1, { assessment: 1 }), 2).assessment).toBe(2);
    expect(assessmentChange(c(1, { assessment: 0 }), 0).assessment).toBeNull();
  });
  it("trims a note, turns a blank one into none and refuses an over-long one", () => {
    expect(noteChange(c(1, { assessment: 1 }), "  Tekst  ")).toEqual({ assessment: 1, note: "Tekst" });
    expect(noteChange(c(1), "   ")).toEqual({ assessment: null, note: null });
    expect(noteChange(c(1), "a".repeat(NOTE_MAX))?.note).toHaveLength(NOTE_MAX);
    expect(noteChange(c(1), "a".repeat(NOTE_MAX + 1))).toBeNull();
  });
  it("words a failed write without claiming success", () => {
    expect(failureText({ kind: "nepoznato" })).toBe(t.errors.unknown);
    expect(failureText({ kind: "session-expired" })).toBe(t.errors.signedOut);
    expect(failureText({ kind: "greska", code: "invalid" })).toBe(t.errors.invalid);
    expect(failureText({ kind: "greska", code: "not_found" })).toBe(t.errors.notFound);
  });
});

describe("afterWrite", () => {
  const editing = { busy: true, error: null, editing: true, draft: "Moja napomena" };
  it("keeps the form as typed, with the reason, when the write did not save", () => {
    for (const outcome of [{ kind: "nepoznato" }, { kind: "session-expired" }, { kind: "greska", code: "invalid" }] as const) {
      const out = afterWrite(six, editing, outcome, { editing: false });
      expect(out.criteria).toBe(six);
      expect(out.row).toEqual({ busy: false, error: failureText(outcome), editing: true, draft: "Moja napomena" });
    }
  });
  it("replaces the criterion and closes the form on the server's answer", () => {
    const saved = c(3, { assessment: 2, note: "Moja napomena" });
    const out = afterWrite(six, editing, { kind: "saved", criterion: saved }, { editing: false });
    expect(out.criteria[2]).toBe(saved);
    expect(out.row).toEqual({ busy: false, error: null, editing: false, draft: "Moja napomena" });
  });
});
