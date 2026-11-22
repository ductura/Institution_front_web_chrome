import { describe, expect, it } from "vitest";

import type { ConsultationSlot } from "../../../../../../../src/client/consultation-slots";
import type { WorkingCriterion } from "../../../../../../../src/client/teacher-working-criteria";

import { actionsFor, assessmentChange, canEditCriteria, canWriteRecords, criteriaHeading, localToIso, noteChange, withSlot } from "./consult-model";

const slot = (state: ConsultationSlot["state"], id = "s1"): ConsultationSlot => ({ id, startsAt: "2026-12-01T10:00:00.000Z", proposedAt: "2026-11-22T10:00:00.000Z", state });
const crit = (assessment: WorkingCriterion["assessment"], note: string | null = null): WorkingCriterion => ({ criterionId: "c1", title: "Izvori i citiranje", assessment, note });

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
    expect(criteriaHeading([crit("good"), crit(null)])).toBe("Kriteriji ocjene · 1 od 2");
  });
  it("clears the pressed assessment and keeps the note", () => {
    expect(assessmentChange(crit("good", "x"), "good")).toEqual({ assessment: null, note: "x" });
    expect(assessmentChange(crit(null), "very_good")).toEqual({ assessment: "very_good", note: null });
  });
  it("trims a note, drops a blank one and refuses an over-long one", () => {
    expect(noteChange(crit(null), "  ok ")?.note).toBe("ok");
    expect(noteChange(crit(null), "   ")?.note).toBeNull();
    expect(noteChange(crit(null), "x".repeat(601))).toBeNull();
  });
  it("lets only the teacher write; the student and the collaborator read", () => {
    expect(canEditCriteria("teacher")).toBe(true);
    expect(canEditCriteria("student")).toBe(false);
    expect(canEditCriteria("collaborator")).toBe(false);
    expect(canWriteRecords("collaborator")).toBe(false);
  });
});
