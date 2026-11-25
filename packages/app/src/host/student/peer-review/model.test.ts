import { describe, expect, it } from "vitest";

import { buildReview, checkText, grouped, inSentOrder, isUuid, MAX_TEXT, mayWrite } from "./model";

const RUBRICS = [{ key: "argument", label: "Argument" }, { key: "structure", label: "Struktura" }];

describe("checkText", () => {
  it("turns CRLF into a new line and treats blank as left empty", () => {
    expect(checkText("a\r\nb")).toEqual({ text: "a\nb", error: null });
    expect(checkText("  \n\t ")).toEqual({ text: null, error: null });
  });
  it("refuses what the contract refuses: length in code points, controls, bidi controls, lone surrogates", () => {
    expect(checkText("😀".repeat(MAX_TEXT)).error).toBeNull();
    expect(checkText("😀".repeat(MAX_TEXT + 1)).error).toBe("tooLong");
    expect(checkText("a\u0007b").error).toBe("badChars");
    expect(checkText("a‮b").error).toBe("badChars");
    expect(checkText("a\ud800b").error).toBe("badChars");
  });
});

describe("buildReview", () => {
  it("sends the filled rubrics in the rubrics' order and leaves a blank one out", () => {
    const built = buildReview(RUBRICS, { byRubric: { structure: "Jasna.", argument: "Slab." }, general: "" });
    expect(built).toEqual({ ok: true, body: { byRubric: [{ key: "argument", text: "Slab." }, { key: "structure", text: "Jasna." }] } });
    expect(buildReview(RUBRICS, { byRubric: { argument: "Dobro." }, general: "Sve u svemu." })).toMatchObject({ ok: true, body: { byRubric: [{ key: "argument" }], general: "Sve u svemu." } });
  });
  it("refuses an empty review and names the field of a refused text; the key of a stranger rubric is never sent", () => {
    expect(buildReview(RUBRICS, { byRubric: {}, general: "Samo opći." })).toMatchObject({ ok: false, error: "empty" });
    expect(buildReview(RUBRICS, { byRubric: { argument: "x".repeat(MAX_TEXT + 1) }, general: "" })).toEqual({ ok: false, error: "invalid", fields: { argument: "tooLong" } });
    expect(buildReview(RUBRICS, { byRubric: { argument: "ok", unknown: "tuđe" }, general: "" })).toMatchObject({ ok: true, body: { byRubric: [{ key: "argument", text: "ok" }] } });
  });
});

describe("the lists", () => {
  it("received reviews are in the order they were sent, never by their content", () => {
    const r = (id: string, at: string) => ({ reviewId: id, byRubric: [], general: null, submittedAt: at }) as never;
    expect(inSentOrder([r("b", "2026-12-02T10:00:00.000Z"), r("a", "2026-12-01T10:00:00.000Z")]).map((x) => x.reviewId)).toEqual(["a", "b"]);
  });
  it("consecutive list items become one list", () => {
    const blocks = [{ kind: "paragraph", text: "a" }, { kind: "list_item", text: "1" }, { kind: "list_item", text: "2" }, { kind: "quote", text: "q" }] as const;
    expect(grouped(blocks)).toEqual([{ kind: "block", block: blocks[0] }, { kind: "list", items: ["1", "2"] }, { kind: "block", block: blocks[3] }]);
  });
  it("a review may be written only while the round is open and the work is waiting", () => {
    const task = (state: "pending" | "submitted") => ({ taskId: "t", state, dueAt: "2026-12-01T10:00:00.000Z" });
    expect(mayWrite({ state: "open", tasks: [] }, task("pending"))).toBe(true);
    expect(mayWrite({ state: "open", tasks: [] }, task("submitted"))).toBe(false);
    expect(mayWrite({ state: "closed", tasks: [] }, task("pending"))).toBe(false);
  });
  it("recognises a uuid", () => {
    expect(isUuid("11111111-1111-4111-8111-111111111111")).toBe(true);
    expect(isUuid("../1")).toBe(false);
  });
});
