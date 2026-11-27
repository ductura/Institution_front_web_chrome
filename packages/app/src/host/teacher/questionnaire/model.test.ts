import { describe, expect, it } from "vitest";

import { answersOf, bodyOf, codeOf, draftOf, emptyDraft, nextState, optionsOf, takesManualEntry, type Question, type Questionnaire } from "./model";

const Q = (n: number) => `c0000000-0000-4000-8000-00000000010${n}`;
const valid = { title: "Izmišljeno istraživanje: navike kompostiranja", questions: [{ kind: "single" as const, text: "Kompostirate li?", options: "Da\nNe", scaleMin: "1", scaleMax: "5" }] };

describe("bodyOf", () => {
  it("builds the contract body: option codes from labels, no options on a text question", () => {
    const r = bodyOf({ title: "  Naslov ", questions: [
      valid.questions[0]!,
      { kind: "text", text: "Što biste promijenili?", options: "ostalo", scaleMin: "1", scaleMax: "5" },
      { kind: "scale", text: "Koliko ste zadovoljni?", options: "", scaleMin: "1", scaleMax: "5" },
    ] });
    expect(r).toEqual({ ok: true, value: { title: "Naslov", questions: [
      { kind: "single", text: "Kompostirate li?", options: [{ code: "da", label: "Da" }, { code: "ne", label: "Ne" }] },
      { kind: "text", text: "Što biste promijenili?" },
      { kind: "scale", text: "Koliko ste zadovoljni?", scale: { min: 1, max: 5 } },
    ] } });
  });

  it("refuses bad and edge input and names the question", () => {
    expect(bodyOf(emptyDraft())).toEqual({ ok: false, problem: "title", index: null });
    expect(bodyOf({ ...valid, title: "x".repeat(401) })).toMatchObject({ problem: "title" });
    expect(bodyOf({ ...valid, questions: [] })).toEqual({ ok: false, problem: "count", index: null });
    expect(bodyOf({ ...valid, questions: Array.from({ length: 41 }, () => valid.questions[0]!) })).toMatchObject({ problem: "count" });
    expect(bodyOf({ ...valid, questions: [{ ...valid.questions[0]!, text: "   " }] })).toEqual({ ok: false, problem: "text", index: 0 });
    expect(bodyOf({ ...valid, questions: [valid.questions[0]!, { ...valid.questions[0]!, options: "samo jedan" }] })).toEqual({ ok: false, problem: "options", index: 1 });
    expect(bodyOf({ ...valid, questions: [{ ...valid.questions[0]!, options: "Da\nda" }] })).toMatchObject({ problem: "options" });
    for (const [min, max] of [["5", "5"], ["6", "5"], ["0", "11"], ["a", "5"], ["", "5"], ["-1", "5"], ["1.5", "5"]]) {
      expect(bodyOf({ ...valid, questions: [{ kind: "scale", text: "t", options: "", scaleMin: min!, scaleMax: max! }] })).toEqual({ ok: false, problem: "scale", index: 0 });
    }
  });
});

describe("option codes", () => {
  it("are slugs that match the contract's pattern and stay unique", () => {
    expect(codeOf("Što je to?")).toBe("sto-je-to");
    expect(codeOf("Đakovo")).toBe("dakovo");
    expect(codeOf("???")).toBe("odgovor");
    expect(codeOf("a".repeat(60))).toHaveLength(40);
    expect(optionsOf("Šuma\nšuma")).toBeNull(); // the same label up to case is refused
    expect(optionsOf("Šuma\nSuma!\nsuma?")!.map((o) => o.code)).toEqual(["suma", "suma-2", "suma-3"]);
    const distinct = optionsOf("Šuma\nSuma!")!;
    expect(distinct.map((o) => o.code)).toEqual(["suma", "suma-2"]);
    for (const o of distinct) expect(o.code).toMatch(/^[a-z0-9][a-z0-9-]{0,39}$/);
  });
  it("needs 2 to 20 labels of at most 240 characters", () => {
    expect(optionsOf("a")).toBeNull();
    expect(optionsOf(Array.from({ length: 21 }, (_, i) => `o${i}`).join("\n"))).toBeNull();
    expect(optionsOf(`a\n${"b".repeat(241)}`)).toBeNull();
    expect(optionsOf(Array.from({ length: 20 }, (_, i) => `o${i}`).join("\n"))).toHaveLength(20);
  });
});

const questionnaire: Questionnaire = {
  id: Q(0), courseId: Q(9), title: "T", state: "draft",
  questions: [
    { id: Q(2), order: 2, kind: "scale", text: "Ljestvica", options: null, scale: { min: 1, max: 5 } },
    { id: Q(1), order: 1, kind: "multiple", text: "Više", options: [{ code: "a", label: "Alfa" }, { code: "b", label: "Beta" }], scale: null },
  ],
};

describe("draftOf", () => {
  it("restores the form in order and survives a round trip to the body", () => {
    const draft = draftOf(questionnaire);
    expect(draft.questions.map((q) => q.kind)).toEqual(["multiple", "scale"]);
    expect(bodyOf(draft)).toMatchObject({ ok: true, value: { questions: [{ options: [{ code: "alfa" }, { code: "beta" }] }, { scale: { min: 1, max: 5 } }] } });
  });
});

describe("answersOf (a paper sheet)", () => {
  const qs: readonly Question[] = [...questionnaire.questions, { id: Q(3), order: 3, kind: "number", text: "Broj", options: null, scale: null }, { id: Q(4), order: 4, kind: "text", text: "Tekst", options: null, scale: null }, { id: Q(5), order: 5, kind: "single", text: "Jedan", options: [{ code: "x", label: "X" }, { code: "y", label: "Y" }], scale: null }];
  it("sends only the answered questions, typed", () => {
    expect(answersOf(qs, { [Q(1)]: ["a", "b"], [Q(2)]: "4", [Q(3)]: "2.5", [Q(4)]: " ok ", [Q(5)]: "y" })).toEqual({ ok: true, answers: [
      { questionId: Q(2), value: 4 }, { questionId: Q(1), value: ["a", "b"] }, { questionId: Q(3), value: 2.5 }, { questionId: Q(4), value: "ok" }, { questionId: Q(5), value: "y" },
    ].sort((l, r) => qs.findIndex((q) => q.id === l.questionId) - qs.findIndex((q) => q.id === r.questionId)) });
  });
  it("needs at least one answer and names every value that does not fit", () => {
    expect(answersOf(qs, {})).toEqual({ ok: false, reason: "none", bad: [] });
    expect(answersOf(qs, { [Q(4)]: "   ", [Q(1)]: [] })).toMatchObject({ reason: "none" });
    expect(answersOf(qs, { [Q(2)]: "6", [Q(1)]: ["zzz"], [Q(5)]: "nema", [Q(3)]: "abc" })).toEqual({ ok: false, reason: "value", bad: expect.arrayContaining([Q(2), Q(1), Q(5), Q(3)]) });
    expect(answersOf(qs, { [Q(2)]: "2.5" })).toMatchObject({ reason: "value" });
    expect(answersOf(qs, { [Q(1)]: ["a", "a"] })).toMatchObject({ reason: "value" });
    expect(answersOf(qs, { [Q(4)]: "x".repeat(2001) })).toMatchObject({ reason: "value" });
    expect(answersOf(qs, { [Q(3)]: "Infinity" })).toMatchObject({ reason: "value" });
  });
});

describe("states", () => {
  it("are one-way and a draft takes no sheet", () => {
    expect([nextState("draft"), nextState("open"), nextState("closed")]).toEqual(["open", "closed", null]);
    expect([takesManualEntry("draft"), takesManualEntry("open"), takesManualEntry("closed")]).toEqual([false, true, true]);
  });
});

// WEB-DIZ-B-V18: dates are written for people (A4), with the full month name.
import { longDay } from "./Questionnaires";
describe("longDay (V18 A4)", () => {
  it("writes the full month and keeps what it cannot read", () => {
    expect(longDay("2026-11-12")).toBe("12. studenoga 2026.");
    expect(longDay("2026-12-08")).toBe("8. prosinca 2026.");
    expect(longDay("nije datum")).toBe("nije datum");
    expect(longDay("2026-13-45")).toBe("2026-13-45");
  });
});
