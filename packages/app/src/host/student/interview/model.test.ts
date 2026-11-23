import { describe, expect, it } from "vitest";

import { fakeInterviewPort } from "./fake-port";
import { interviewMessages } from "./messages.hr";
import { afterNote, attachNote, explanationError, keepNotes, noteContentError, notesOpen, orderedQuestions, sendExplanation } from "./model";
import type { InterviewPort, InterviewRead } from "./port";

const ID = "3c9f0a1e-7b2d-4e5f-8a6b-1c2d3e4f5a60";
const file = (name: string, size = 10) => new File([new Uint8Array(size)], name);
const pdf = (name = "biljeske.pdf") => new File([new TextEncoder().encode("%PDF-1.7 izmišljeno")], name);

describe("student interview invitation (WEB-1531)", () => {
  it("shows general questions before paragraph questions", async () => {
    const read = await fakeInterviewPort().read(ID);
    if (read.kind !== "ready") throw new Error("unreachable");
    expect(orderedQuestions(read.questions).map((q) => q.id)).toEqual(["q0", "q1"]);
  });

  it("reports no invitation as its own state", async () => {
    expect((await fakeInterviewPort(false).read(ID)).kind).toBe("notInvited");
  });

  it("refuses an empty explanation before the port is called", async () => {
    const port = fakeInterviewPort();
    expect(explanationError("  ")).not.toBeNull();
    expect((await sendExplanation(port, ID, "q1", "  ")).kind).toBe("rejected");
    expect((await sendExplanation(port, ID, "q1", " Izmišljeno objašnjenje ")).kind).toBe("saved");
    expect(port.explained).toEqual(["Izmišljeno objašnjenje"]);
  });

  it("refuses a bad type, size, name or content before anything is sent, and sends a good one", async () => {
    const port = fakeInterviewPort();
    const refused = [
      file("a.exe"), file("a.md"), file("a.txt", 0), file("a.txt", 1024 * 1024 + 1), file(`${"a".repeat(197)}.txt`),
      file(" a.txt"), new File([new Uint8Array([0xc3, 0x28])], "neispravno.txt"), new File([new TextEncoder().encode("nije pdf")], "lazni.pdf"),
    ];
    for (const f of refused) expect({ name: f.name, kind: (await attachNote(port, ID, f)).kind }).toEqual({ name: f.name, kind: "invalid" });
    expect(port.notes).toEqual([]);
    expect((await attachNote(port, ID, file("a.txt", 1024 * 1024))).kind).toBe("saved");
    expect((await attachNote(port, ID, file("biljeske.txt"))).kind).toBe("saved");
    expect((await attachNote(port, ID, pdf())).kind).toBe("saved");
    expect(port.notes).toEqual(["a.txt", "biljeske.txt", "biljeske.pdf"]);
    expect(noteContentError("a.txt", new TextEncoder().encode("Izmišljene bilješke čćžšđ"))).toBeNull();
  });

  it("lists a note only once the server confirms it; 409 closes the action", async () => {
    const read = await fakeInterviewPort().read(ID);
    if (read.kind !== "ready") throw new Error("unreachable");
    expect(afterNote(read, { kind: "unavailable" })).toMatchObject({ saved: false, closed: false, message: interviewMessages.noteFailed, read });
    expect(afterNote(read, { kind: "rejected" }).message).toBe(interviewMessages.noteRejected);
    expect(afterNote(read, { kind: "saved" }).saved).toBe(false);
    expect(afterNote(read, { kind: "closed" })).toMatchObject({ closed: true, saved: false, message: interviewMessages.noteClosed });
    const saved = afterNote(read, { kind: "saved", note: { id: "n1", fileName: "biljeske.pdf" } });
    expect(saved).toMatchObject({ saved: true, message: interviewMessages.noteSaved });
    expect(saved.read.attachments).toEqual([{ id: "n1", fileName: "biljeske.pdf" }]);
    const again = keepNotes(saved.read, { ...read, attachments: [] });
    expect(again.kind === "ready" && again.attachments).toEqual([{ id: "n1", fileName: "biljeske.pdf" }]);
  });

  it("offers the note action only to an invited student before the talk is held", async () => {
    const port = fakeInterviewPort();
    const read = await port.read(ID) as Extract<InterviewRead, { kind: "ready" }>;
    expect(notesOpen(read, port)).toBe(true);
    expect(notesOpen({ ...read, heldAt: "2026-11-20" }, port)).toBe(false);
    const { attachNote: _none, ...withoutNotes } = port;
    expect(notesOpen(read, withoutNotes as InterviewPort)).toBe(false);
  });

  it("carries the fixed notice and no verdict wording", () => {
    expect(interviewMessages.notice).toBe("Razgovor nije optužba. Ductura ne procjenjuje autorstvo ni korištenje AI-ja.");
    const all = JSON.stringify(interviewMessages).toLowerCase();
    for (const word of ["ocjena", "sankcij", "sumnj", "varanj", "plagij"]) expect(all).not.toContain(word);
  });
});
