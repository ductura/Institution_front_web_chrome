import { describe, expect, it } from "vitest";

import { fakeInterviewPort } from "./fake-port";
import { interviewMessages } from "./messages.hr";
import { attachNote, explanationError, orderedQuestions, sendExplanation } from "./model";

const ID = "3c9f0a1e-7b2d-4e5f-8a6b-1c2d3e4f5a60";
const file = (name: string, size = 10) => new File([new Uint8Array(size)], name);

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

  it("refuses a bad note and sends a good one", async () => {
    const port = fakeInterviewPort();
    expect((await attachNote(port, ID, file("a.exe"))).kind).toBe("invalid");
    expect((await attachNote(port, ID, file("a.txt", 0))).kind).toBe("invalid");
    expect((await attachNote(port, ID, file("a.txt", 3 * 1024 * 1024))).kind).toBe("invalid");
    expect((await attachNote(port, ID, file("biljeske.txt"))).kind).toBe("saved");
    expect(port.notes).toEqual(["biljeske.txt"]);
  });

  it("carries the fixed notice and no verdict wording", () => {
    expect(interviewMessages.notice).toBe("Razgovor nije optužba. Ductura ne procjenjuje autorstvo ni korištenje AI-ja.");
    const all = JSON.stringify(interviewMessages).toLowerCase();
    for (const word of ["ocjena", "sankcij", "sumnj", "varanj", "plagij"]) expect(all).not.toContain(word);
  });
});
