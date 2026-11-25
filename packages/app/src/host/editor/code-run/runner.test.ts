import { describe, expect, it } from "vitest";

import { countPassed, parseCodeTests, parseFrameAnswer, show, type CodeTest } from "./runner.ts";

const tests: CodeTest[] = [{ id: "t1", title: "Zbroj", input: [1, 2], expected: 3 }, { id: "t2", title: "Nula", input: [0, 0], expected: 0 }];

describe("parseCodeTests", () => {
  it("accepts the student's read and nothing else", () => {
    expect(parseCodeTests({ revisionNo: 1, language: "javascript", tests })).toEqual(tests);
    expect(parseCodeTests({ revisionNo: 1, language: "python", tests })).toBeNull();
    expect(parseCodeTests({ language: "javascript", tests: [{ id: "T 1", title: "x", input: 1, expected: 1 }] })).toBeNull();
    expect(parseCodeTests({ language: "javascript", tests: [{ id: "t1", title: "", input: 1, expected: 1 }] })).toBeNull();
    expect(parseCodeTests({ language: "javascript", tests: [{ id: "t1", title: "x", expected: 1 }] })).toBeNull();
    expect(parseCodeTests({ language: "javascript", tests: Array.from({ length: 11 }, (_, i) => ({ id: `t${i}`, title: "x", input: 1, expected: 1 })) })).toBeNull();
    expect(parseCodeTests(null)).toBeNull();
  });
});

describe("parseFrameAnswer", () => {
  const good = { type: "results", runId: "r1", results: [{ id: "t1", status: "passed" }, { id: "t2", status: "failed", actual: 1 }] };
  it("takes a well-formed answer of this run", () => {
    expect(parseFrameAnswer(good, "r1", tests)).toEqual({ kind: "results", results: [{ id: "t1", status: "passed" }, { id: "t2", status: "failed", actual: 1 }] });
    const out = parseFrameAnswer(good, "r1", tests);
    expect(out?.kind === "results" && countPassed(out.results)).toBe(1);
  });
  it("refuses another run, a wrong id, an unknown status or a wrong count", () => {
    expect(parseFrameAnswer(good, "r2", tests)).toBeNull();
    expect(parseFrameAnswer({ ...good, results: [{ id: "t2", status: "passed" }, { id: "t1", status: "passed" }] }, "r1", tests)).toBeNull();
    expect(parseFrameAnswer({ ...good, results: [{ id: "t1", status: "ok" }, { id: "t2", status: "passed" }] }, "r1", tests)).toBeNull();
    expect(parseFrameAnswer({ ...good, results: [{ id: "t1", status: "passed" }] }, "r1", tests)).toBeNull();
    expect(parseFrameAnswer("results", "r1", tests)).toBeNull();
  });
  it("reports a code without solve", () => {
    expect(parseFrameAnswer({ type: "results", runId: "r1", missingSolve: true, results: [] }, "r1", tests)).toEqual({ kind: "missing-solve" });
  });
});

describe("show", () => {
  it("cuts long values and survives what JSON cannot write", () => {
    expect(show([1, "a"])).toBe('[1,"a"]');
    expect(show("x".repeat(300), 10).endsWith("…")).toBe(true);
    const loop: Record<string, unknown> = {}; loop.self = loop;
    expect(typeof show(loop)).toBe("string");
  });
});
