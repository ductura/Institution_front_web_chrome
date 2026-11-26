import { describe, expect, it } from "vitest";

import { buildSheet, checkField, MAX_TEXT, scaleValues } from "./model";
import type { Form } from "./read";

// Invented questionnaire "Izmišljeno istraživanje: navike kompostiranja".
const Q = {
  single: { id: "q1", order: 1, kind: "single", text: "Kompostirate li?", options: [{ code: "da", label: "Da" }, { code: "ne", label: "Ne" }], scale: null },
  multiple: { id: "q2", order: 2, kind: "multiple", text: "Što kompostirate?", options: [{ code: "voce", label: "Voće" }, { code: "lisce", label: "Lišće" }], scale: null },
  scale: { id: "q3", order: 3, kind: "scale", text: "Koliko je lako?", options: null, scale: { min: 1, max: 5 } },
  number: { id: "q4", order: 4, kind: "number", text: "Koliko kanti tjedno?", options: null, scale: null },
  text: { id: "q5", order: 5, kind: "text", text: "Komentar", options: null, scale: null },
} as const satisfies Record<string, Form["questions"][number]>;
const ALL = Object.values(Q);

describe("checkField", () => {
  it("treats an empty field as not answered", () => {
    for (const q of ALL) expect(checkField(q, q.kind === "multiple" ? [] : "")).toEqual({ ok: true, value: null });
    expect(checkField(Q.text, "   ")).toEqual({ ok: true, value: null });
  });
  it("accepts only a listed code for single and multiple, and refuses an invented one", () => {
    expect(checkField(Q.single, "da")).toEqual({ ok: true, value: "da" });
    expect(checkField(Q.single, "možda")).toEqual({ ok: false, error: "singleInvalid" });
    expect(checkField(Q.multiple, ["voce", "voce", "lisce"])).toEqual({ ok: true, value: ["voce", "lisce"] });
    expect(checkField(Q.multiple, ["voce", "meso"])).toEqual({ ok: false, error: "multipleInvalid" });
  });
  it("keeps a scale inside its bounds and sends a number, not a string", () => {
    expect(checkField(Q.scale, "5")).toEqual({ ok: true, value: 5 });
    expect(checkField(Q.scale, "6")).toEqual({ ok: false, error: "scaleInvalid" });
    expect(checkField(Q.scale, "0")).toEqual({ ok: false, error: "scaleInvalid" });
    expect(checkField(Q.scale, "2.5")).toEqual({ ok: false, error: "scaleInvalid" });
    expect(scaleValues(Q.scale)).toEqual([1, 2, 3, 4, 5]);
  });
  it("reads a number with a decimal comma and refuses text", () => {
    expect(checkField(Q.number, "2,5")).toEqual({ ok: true, value: 2.5 });
    expect(checkField(Q.number, "-3")).toEqual({ ok: true, value: -3 });
    expect(checkField(Q.number, "tri")).toEqual({ ok: false, error: "numberInvalid" });
    expect(checkField(Q.number, "1e5")).toEqual({ ok: false, error: "numberInvalid" });
  });
  it("bounds a text and refuses control characters", () => {
    expect(checkField(Q.text, "  Izmišljeni komentar. ")).toEqual({ ok: true, value: "Izmišljeni komentar." });
    expect(checkField(Q.text, "a".repeat(MAX_TEXT + 1))).toEqual({ ok: false, error: "textTooLong" });
    expect(checkField(Q.text, "a".repeat(MAX_TEXT)).ok).toBe(true);
    expect(checkField(Q.text, "a\u0000b")).toEqual({ ok: false, error: "textInvalid" });
  });
});

describe("buildSheet", () => {
  it("sends only the answered questions, in the order of the questions", () => {
    const r = buildSheet(ALL, { q3: "4", q1: "ne", q2: [], q4: "", q5: "" });
    expect(r).toEqual({ ok: true, answers: [{ questionId: "q1", value: "ne" }, { questionId: "q3", value: 4 }] });
  });
  it("refuses an empty sheet, because the server needs at least one answer", () => {
    expect(buildSheet(ALL, {})).toEqual({ ok: false, error: "none" });
  });
  it("names the first question whose answer the server would refuse", () => {
    expect(buildSheet(ALL, { q1: "da", q4: "x", q3: "9" })).toEqual({ ok: false, error: "scaleInvalid", questionId: "q3" });
  });
});
