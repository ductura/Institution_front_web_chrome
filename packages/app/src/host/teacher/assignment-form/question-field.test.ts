// @vitest-environment jsdom
// NF-4 NZ-15: the question beside the declaration, wired to teacher.declaration-question.get/put.
import { describe, expect, it, vi } from "vitest";

import { DECLARATION_QUESTION_MAX_CHARS, checkQuestion, normalizeQuestion, readQuestion, saveQuestion } from "./QuestionField";

const ID = "11111111-1111-4111-8111-111111111111";
type C = Parameters<typeof readQuestion>[0];
const client = (answer: unknown) => vi.fn(async () => answer) as unknown as C & ReturnType<typeof vi.fn>;

describe("question text checks", () => {
  it("normalizes to NFC, trims and turns empty into null", () => {
    expect(normalizeQuestion("  é  ")).toBe("é");
    expect(normalizeQuestion("   ")).toBeNull();
  });
  it("counts code points and refuses control characters", () => {
    expect(checkQuestion("x".repeat(DECLARATION_QUESTION_MAX_CHARS))).toBeNull();
    expect(checkQuestion("x".repeat(DECLARATION_QUESTION_MAX_CHARS + 1))).toBe("tooLong");
    expect(checkQuestion("😀".repeat(DECLARATION_QUESTION_MAX_CHARS))).toBeNull();
    expect(checkQuestion("a\u0000b")).toBe("invalid");
    expect(checkQuestion("a\nb")).toBeNull();
  });
});

describe("readQuestion / saveQuestion", () => {
  it("reads the question and never takes a refusal for 'no question'", async () => {
    expect(await readQuestion(client({ ok: true, status: 200, body: { question: "Zašto?", changedAt: null } }), ID)).toEqual({ kind: "ready", question: "Zašto?" });
    expect(await readQuestion(client({ ok: false, status: 404 }), ID)).toEqual({ kind: "unavailable" });
    expect(await readQuestion(client({ ok: false, status: 401 }), ID)).toEqual({ kind: "signedOut" });
    const boom = vi.fn(async () => { throw new Error("x"); }) as unknown as C;
    expect(await readQuestion(boom, ID)).toEqual({ kind: "unavailable" });
  });
  it("sends the normalized question and counts as saved only when the answer repeats it", async () => {
    const ok = client({ ok: true, status: 200, body: { question: "Zašto?", changedAt: "2026-11-26T10:00:00.000Z" } });
    expect(await saveQuestion(ok, ID, "  Zašto? ")).toBe("saved");
    expect(ok).toHaveBeenCalledWith("teacher.declaration-question.put", { params: { assignmentId: ID }, query: undefined, body: { question: "Zašto?" } });
    expect(await saveQuestion(client({ ok: true, status: 200, body: { question: null, changedAt: null } }), ID, "Zašto?")).toBe("failed");
  });
  it("clears with an empty text, but skips sending for a new assignment without question", async () => {
    const ok = client({ ok: true, status: 200, body: { question: null, changedAt: null } });
    expect(await saveQuestion(ok, ID, "  ")).toBe("saved");
    const none = client({ ok: true });
    expect(await saveQuestion(none, ID, "", { skipEmpty: true })).toBe("none");
    expect(none).not.toHaveBeenCalled();
  });
  it("does not send an invalid text and maps refusals", async () => {
    const never = client({ ok: true });
    expect(await saveQuestion(never, ID, "x".repeat(501))).toBe("invalid");
    expect(never).not.toHaveBeenCalled();
    expect(await saveQuestion(client({ ok: false, status: 401 }), ID, "a")).toBe("signedOut");
    expect(await saveQuestion(client({ ok: false, status: 422 }), ID, "a")).toBe("invalid");
    expect(await saveQuestion(client({ ok: false, status: 404 }), ID, "a")).toBe("failed");
  });
});
