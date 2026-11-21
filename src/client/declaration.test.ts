// The declaration port's fake (WEB-1209): what the student may confirm and what the teacher
// then receives. Conversations the student did not attach never reach the teacher (D-41).
import { describe, expect, it } from "vitest";
import type { Attachment, StudentConversation } from "./declaration";
import { createFakeDeclaration, type FakeSubmission } from "./declaration-fake";

const required: StudentConversation = {
  conversationId: "c-required",
  title: "Razgovor 1 · Lektura",
  reason: "transfer",
  requiredBecause: "Odlomak 2 prenesen je u rad.",
  assistantName: "Asistent",
  throughSeq: 2,
  messagesSha256: "a".repeat(64),
  turns: [
    { seq: 1, author: "student", text: "Izmišljeno pitanje." },
    { seq: 2, author: "assistant", text: "Izmišljen odgovor." },
  ],
};

const optional: StudentConversation = {
  conversationId: "c-optional",
  title: "Tajni naslov koji nastavnik ne smije vidjeti",
  reason: "student_added",
  assistantName: "Asistent",
  throughSeq: 1,
  messagesSha256: "b".repeat(64),
  turns: [{ seq: 1, author: "student", text: "Izmišljena bilješka." }],
};

const submission: FakeSubmission = {
  assistantAllowed: true,
  uses: [{ purpose: "Lektura", provider: "Asistent", phase: "Pisanje" }],
  conversations: [required, optional],
  confirmedAt: "21. 11. 10:00",
};

const attach = (c: StudentConversation): Attachment => ({
  conversationId: c.conversationId,
  reason: c.reason,
  throughSeq: c.throughSeq,
  messagesSha256: c.messagesSha256,
});

describe("fake declaration", () => {
  it("shows the student every conversation and the teacher nothing before the confirmation", async () => {
    const port = createFakeDeclaration({ s1: submission });
    const read = await port.readStudent("s1");
    expect(read.kind === "ready" && read.conversations.map((c) => c.conversationId)).toEqual(["c-required", "c-optional"]);
    expect(await port.readTeacher("s1")).toEqual({ kind: "pending" });
  });

  it("refuses a confirmation that leaves out a required conversation", async () => {
    const port = createFakeDeclaration({ s1: submission });
    expect(await port.confirm("s1", [attach(optional)])).toEqual({ kind: "unavailable" });
    expect(await port.confirm("s1", [])).toEqual({ kind: "unavailable" });
    expect(await port.readTeacher("s1")).toEqual({ kind: "pending" });
  });

  it("refuses an attachment that claims a different reason or names an unknown conversation", async () => {
    const port = createFakeDeclaration({ s1: submission });
    expect(await port.confirm("s1", [attach(required), { ...attach(optional), reason: "transfer" }])).toEqual({ kind: "unavailable" });
    expect(await port.confirm("s1", [attach(required), { ...attach(optional), conversationId: "c-other" }])).toEqual({ kind: "unavailable" });
    expect(await port.confirm("s1", [attach(required), attach(required)])).toEqual({ kind: "unavailable" });
  });

  it("gives the teacher only the attached conversation, with no trace of the one left out (D-41)", async () => {
    const port = createFakeDeclaration({ s1: submission });
    expect(await port.confirm("s1", [attach(required)])).toEqual({ kind: "confirmed" });
    const teacher = await port.readTeacher("s1");
    expect(teacher.kind).toBe("ready");
    expect(teacher.kind === "ready" && teacher.conversations.map((c) => c.conversationId)).toEqual(["c-required"]);
    const wire = JSON.stringify(teacher);
    expect(wire).not.toContain(optional.conversationId);
    expect(wire).not.toContain(optional.title);
    expect(wire).not.toContain(optional.turns[0]!.text);
  });

  it("gives the teacher an optional conversation once the student picks it", async () => {
    const port = createFakeDeclaration({ s1: submission });
    await port.confirm("s1", [attach(required), attach(optional)]);
    const teacher = await port.readTeacher("s1");
    expect(teacher.kind === "ready" && teacher.conversations.map((c) => c.reason)).toEqual(["transfer", "student_added"]);
  });

  it("answers stale when a conversation moved on after the review, and accepts the new version", async () => {
    const port = createFakeDeclaration({ s1: submission });
    const reviewed = [attach(required)];
    port.touch("s1", "c-required", "c".repeat(64));
    expect(await port.confirm("s1", reviewed)).toEqual({ kind: "stale", conversationIds: ["c-required"] });
    expect(await port.readTeacher("s1")).toEqual({ kind: "pending" });

    const again = await port.readStudent("s1");
    const fresh = again.kind === "ready" ? again.conversations.find((c) => c.conversationId === "c-required")! : required;
    expect(fresh.throughSeq).toBe(3);
    expect(await port.confirm("s1", [attach(fresh)])).toEqual({ kind: "confirmed" });
  });

  it("shows the teacher turns only up to the confirmed version", async () => {
    const port = createFakeDeclaration({ s1: submission });
    await port.confirm("s1", [attach(required)]);
    port.touch("s1", "c-required", "d".repeat(64));
    const teacher = await port.readTeacher("s1");
    const c = teacher.kind === "ready" ? teacher.conversations[0]! : null;
    expect(c?.throughSeq).toBe(2);
    expect(c?.turns.map((t) => t.seq)).toEqual([1, 2]);
  });

  it("reports no use, a disabled assistant and an unknown submission", async () => {
    const port = createFakeDeclaration({
      none: { ...submission, uses: [], conversations: [] },
      off: { ...submission, assistantAllowed: false, conversations: [] },
    });
    expect(await port.readStudent("none")).toEqual({ kind: "no_use" });
    expect(await port.confirm("none", [])).toEqual({ kind: "confirmed" });
    expect(await port.readTeacher("none")).toEqual({ kind: "no_use", confirmedAt: "21. 11. 10:00" });
    expect(await port.readStudent("off")).toEqual({ kind: "ai_disabled" });
    expect(await port.readStudent("missing")).toEqual({ kind: "unavailable" });
    expect(await port.confirm("missing", [])).toEqual({ kind: "unavailable" });
    expect(await port.readTeacher("missing")).toEqual({ kind: "unavailable" });
  });
});
