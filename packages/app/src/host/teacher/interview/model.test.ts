import { describe, expect, it } from "vitest";

import { fakeTeacherPort, FAKE_PREPARATION } from "./fake-port";
import { interviewMessages } from "./messages.hr";
import { appointmentLine, dateHr, failureMessage, isInvited, momentHr, orderedQuestions, paragraphLabel, paragraphRefOf, pdfBytes, questionError, zagrebToIso } from "./model";

const ID = "3c9f0a1e-7b2d-4e5f-8a6b-1c2d3e4f5a60";

describe("teacher interview preparation (WEB-1530)", () => {
  it("orders general questions before paragraph questions", () => {
    const q = (id: string, paragraphRef: string | null) => ({ id, paragraphRef, questionText: "x", createdAt: "2026-11-22T09:00:00.000Z", mine: true });
    expect(orderedQuestions([q("a", "p-1"), q("b", null)]).map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("refuses an empty question", () => {
    expect(questionError("  ")).not.toBeNull();
    expect(questionError("Pitanje?")).toBeNull();
  });

  it("invites once and shows the invitation", async () => {
    const port = fakeTeacherPort();
    expect(isInvited(FAKE_PREPARATION)).toBe(false);
    const out = await port.invite(ID);
    expect(out.kind === "ok" && isInvited(out.value)).toBe(true);
  });

  it("adds and removes a question", async () => {
    const port = fakeTeacherPort();
    await port.addQuestion(ID, { paragraphRef: null, questionText: "Opće pitanje" });
    const read = await port.read(ID);
    if (read.kind !== "ok") throw new Error("unreachable");
    expect(read.value.questions).toHaveLength(2);
    await port.removeQuestion(ID, read.value.questions[1]!.id);
    expect(port.calls.length).toBe(2);
  });

  it("converts Zagreb wall time to the UTC instant", () => {
    expect(zagrebToIso("2026-11-24", "10:30")).toBe("2026-11-24T09:30:00.000Z");
    expect(zagrebToIso("2026-07-01", "10:30")).toBe("2026-07-01T08:30:00.000Z");
    expect(zagrebToIso("", "10:30")).toBeNull();
  });

  it("decodes the PDF bytes", () => {
    expect(Array.from(pdfBytes({ pdfBase64: "JVBERi0=" }))).toEqual([37, 80, 68, 70, 45]);
  });

  it("describes the appointment and failures", () => {
    expect(appointmentLine(FAKE_PREPARATION)).toBe(interviewMessages.appointmentNone);
    expect(appointmentLine({ ...FAKE_PREPARATION, appointment: { place: "Soba 12", at: "2026-11-24T09:30:00.000Z" } })).toContain("Soba 12");
    expect(failureMessage({ kind: "conflict" })).toBe(interviewMessages.conflict);
    expect(failureMessage({ kind: "signedOut" })).toBeNull();
  });

  it("shows moments with the full month name and no separator dot (N-14)", () => {
    expect(momentHr("2026-11-24T09:30:00.000Z")).toBe("24. studenoga 2026. u 10:30");
    expect(momentHr("2026-12-08T22:59:00.000Z")).toBe("8. prosinca 2026. u 23:59");
    expect(dateHr("2026-11-12")).toBe("12. studenoga 2026.");
    expect(appointmentLine({ ...FAKE_PREPARATION, appointment: { place: "Soba 12", at: "2026-11-24T09:30:00.000Z" } }))
      .toBe("Termin: Soba 12, 24. studenoga 2026. u 10:30");
    expect(JSON.stringify([momentHr("2026-11-24T09:30:00.000Z"), interviewMessages.appointmentFree("a", "b")])).not.toContain("·");
  });

  it("names a paragraph by its number and accepts only a number", () => {
    expect(paragraphLabel("3")).toBe("Odlomak 3");
    expect(paragraphLabel(null)).toBe(interviewMessages.generalParagraph);
    expect(paragraphRefOf("")).toEqual({ ok: true, value: null });
    expect(paragraphRefOf(" 07 ")).toEqual({ ok: true, value: "7" });
    for (const bad of ["p-3", "0", "-1", "1.5", "12345"]) expect(paragraphRefOf(bad)).toEqual({ ok: false });
  });

  it("speaks to the teacher with Vi and keeps the retry key", () => {
    expect(interviewMessages.questionEmpty).toBe("Napišite pitanje.");
    expect(interviewMessages.appointmentFieldsEmpty).toBe("Upišite mjesto i vrijeme.");
    expect(interviewMessages.heldEmpty).toBe("Odaberite datum razgovora.");
    expect(interviewMessages.failed).toBe("Radnja nije uspjela. Pokušajte ponovno.");
    expect(interviewMessages.retry).toBe("Pokušaj ponovno");
    expect(interviewMessages.confirmTitle).toBe("Poslati studentu poziv?");
  });

  it("carries the fixed notice, the outcome note and no verdict wording", () => {
    expect(interviewMessages.notice).toBe("Ovo je priprema za razgovor, ne optužba ni disciplinski postupak.");
    expect(interviewMessages.outcomeNote).toBe("Ishod razgovora se ne upisuje ovdje.");
    const all = JSON.stringify(interviewMessages).toLowerCase();
    for (const word of ["prijevar", "plagijat", "sumnj", "kazn", "ocjen"]) expect(all).not.toContain(word);
  });
});
