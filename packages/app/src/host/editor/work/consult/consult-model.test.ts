import { describe, expect, it } from "vitest";

import type { ConsultationSlot, SlotDetail } from "../../../../../../../src/client/consultation-slots";
import { CRITERION_IDS, NOTE_MAX, type WorkingCriterion } from "../../../../../../../src/client/teacher-working-criteria";

import {
  asDetail, closeActionsFor, closeFailure, closingText, lineText, statusText, topicText,
} from "./consult-model";
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

// WEB-NF6-KONZ (MK-3): topic, closing and who may close. All data is invented.
const NOW = Date.parse("2026-11-24T12:00:00.000Z");
const detail = (state: SlotDetail["state"], extra: Partial<SlotDetail> = {}): SlotDetail =>
  ({ id: "s1", startsAt: "2026-12-01T10:00:00.000Z", proposedAt: "2026-11-22T10:00:00.000Z", state, topic: null, closing: null, preparation: null, ...extra });

describe("closing a slot (MK-3)", () => {
  it("the student withdraws and the teacher declines a request nobody has answered", () => {
    expect(closeActionsFor("student", detail("requested"), NOW)).toEqual(["withdraw"]);
    expect(closeActionsFor("teacher", detail("requested"), NOW)).toEqual(["decline"]);
  });
  it("either side cancels a proposed or confirmed slot that lies ahead, not one that has passed", () => {
    for (const role of ["student", "teacher"] as const) {
      for (const state of ["countered", "confirmed"] as const) {
        expect(closeActionsFor(role, detail(state), NOW)).toEqual(["cancel"]);
        expect(closeActionsFor(role, detail(state, { startsAt: "2026-11-20T10:00:00.000Z" }), NOW)).toEqual([]);
      }
    }
  });
  it("the collaborator and a closed slot have no action", () => {
    for (const state of ["requested", "countered", "confirmed"] as const) expect(closeActionsFor("collaborator", detail(state), NOW)).toEqual([]);
    for (const state of ["withdrawn", "declined", "cancelled"] as const) {
      for (const role of ["student", "teacher"] as const) {
        expect(closeActionsFor(role, detail(state), NOW)).toEqual([]);
        expect(actionsFor(role, detail(state))).toEqual([]);
      }
    }
  });
  it("says the closed state by role and the time of the slot", () => {
    expect(statusText("teacher", detail("withdrawn"))).toBe("student je povukao zahtjev");
    expect(statusText("student", detail("declined"))).toBe("mentor je odbio zahtjev");
    expect(statusText("student", detail("cancelled"))).toBe("otkazano");
    expect(lineText(detail("cancelled"))).toMatch(/^Termin: /);
  });
  it("shows the topic or says there is none", () => {
    expect(topicText(detail("requested", { topic: "Izmišljena tema" }))).toBe("Tema: Izmišljena tema");
    expect(topicText(detail("requested"))).toBe("Tema nije upisana.");
  });
  it("tells who closed it, with the reason only when there is one", () => {
    const at = "2026-11-23T11:00:00.000Z";
    const byStudent = detail("cancelled", { closing: { by: "student", reason: "Izmišljeni razlog.", at } });
    expect(closingText("student", byStudent)).toMatch(/^Zatvorili ste .+\. Razlog: Izmišljeni razlog\.$/);
    expect(closingText("teacher", byStudent)).toMatch(/^Student je zatvorio /);
    expect(closingText("student", detail("declined", { closing: { by: "teacher", reason: null, at } }))).not.toContain("Razlog");
    expect(closingText("student", detail("requested"))).toBeNull();
  });
  it("keeps the known topic and preparation when an older route answers without them", () => {
    const known = detail("requested", { topic: "Metoda", preparation: { text: "Izmišljeno.", changedParagraphs: 1, resolvedComments: 0 } });
    const answered: ConsultationSlot = { id: "s1", startsAt: known.startsAt, proposedAt: known.proposedAt, state: "confirmed" };
    expect(asDetail(answered, known)).toEqual({ ...known, state: "confirmed" });
    expect(asDetail({ ...answered, topic: null }, known).topic).toBeNull();
    expect(asDetail(answered).topic).toBeNull();
  });
  it("a refused closing says the slot changed; the rest as for any write", () => {
    expect(closeFailure({ kind: "promijenjeno" })).toMatch(/više se ne može zatvoriti/);
    expect(closeFailure({ kind: "nepoznato" })).toMatch(/Nije poznato/);
  });
});
