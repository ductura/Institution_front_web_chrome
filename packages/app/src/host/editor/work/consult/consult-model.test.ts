import { describe, expect, it } from "vitest";

import type { ConsultationSlot } from "../../../../../../../src/client/consultation-slots";
import { CRITERION_IDS, NOTE_MAX, type WorkingCriterion } from "../../../../../../../src/client/teacher-working-criteria";

import { actionsFor, assessmentChange, canEditCriteria, canWriteRecords, criteriaHeading, criterionTitle, localToIso, noteChange, withCriterion, withSlot } from "./consult-model";

const slot = (state: ConsultationSlot["state"], id = "s1"): ConsultationSlot => ({ id, startsAt: "2026-12-01T10:00:00.000Z", proposedAt: "2026-11-22T10:00:00.000Z", state });
const crit = (assessment: WorkingCriterion["assessment"], note: string | null = null): WorkingCriterion => ({ id: "sources", label: "workingCriteria.sources", assessment, note });

describe("consultation actions", () => {
  it("lets the teacher answer a request and the student take a counter", () => {
    expect(actionsFor("teacher", slot("requested"))).toEqual(["confirm", "counter"]);
    expect(actionsFor("student", slot("countered"))).toEqual(["accept"]);
  });
  it("gives the collaborator no action and the others none out of turn", () => {
    for (const state of ["requested", "countered", "confirmed"] as const) expect(actionsFor("collaborator", slot(state))).toEqual([]);
    expect(actionsFor("student", slot("requested"))).toEqual([]);
    expect(actionsFor("teacher", slot("confirmed"))).toEqual([]);
  });
  it("puts the server's slot in place or first", () => {
    expect(withSlot([slot("requested")], slot("confirmed")).map((s) => s.state)).toEqual(["confirmed"]);
    expect(withSlot([slot("requested")], slot("requested", "s2")).map((s) => s.id)).toEqual(["s2", "s1"]);
  });
  it("reads a local time and rejects text", () => {
    expect(localToIso("2026-11-21T13:00")).not.toBeNull();
    expect(localToIso("")).toBeNull();
    expect(localToIso("sutra")).toBeNull();
  });
});

describe("criteria", () => {
  it("counts the assessed ones in the heading", () => {
    expect(criteriaHeading([crit(1), crit(null)])).toBe("Kriteriji ocjene · 1 od 2");
  });
  it("clears the pressed assessment and keeps the note", () => {
    expect(assessmentChange(crit(1, "x"), 1)).toEqual({ assessment: null, note: "x" });
    expect(assessmentChange(crit(null), 2)).toEqual({ assessment: 2, note: null });
  });
  it("trims a note, drops a blank one and refuses an over-long one", () => {
    expect(noteChange(crit(null), "  ok ")?.note).toBe("ok");
    expect(noteChange(crit(null), "   ")?.note).toBeNull();
    expect(noteChange(crit(null), "x".repeat(NOTE_MAX))?.note).toHaveLength(NOTE_MAX);
    expect(noteChange(crit(null), "x".repeat(NOTE_MAX + 1))).toBeNull();
  });
  it("names a criterion by its id, never by the server's message key", () => {
    expect(criterionTitle(crit(null))).toBe("Izvori i citiranje");
    expect(CRITERION_IDS.map((id) => criterionTitle({ id, label: `workingCriteria.${id}`, assessment: null, note: null })).join(" ")).not.toContain("workingCriteria.");
  });
  it("puts the saved criterion in place by its id", () => {
    const other: WorkingCriterion = { id: "topic", label: "workingCriteria.topic", assessment: null, note: null };
    expect(withCriterion([other, crit(null)], crit(2, "ok"))).toEqual([other, crit(2, "ok")]);
  });
  it("lets only the teacher write; the student and the collaborator read", () => {
    expect(canEditCriteria("teacher")).toBe(true);
    expect(canEditCriteria("student")).toBe(false);
    expect(canEditCriteria("collaborator")).toBe(false);
    expect(canWriteRecords("collaborator")).toBe(false);
  });
});
