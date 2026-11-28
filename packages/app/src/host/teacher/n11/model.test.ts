import { describe, expect, it } from "vitest";
import { FAKE_BLOCKS, FAKE_VERSIONS, fakeN11Port } from "./fake-port";
import { countWords, currentLine, defaultFrom, diffRows, hasChanges, hasSubmission, loadComparison, loadVersions, olderChoices, optionLabel, submittedVersions, wordDiff } from "./model";

describe("N-11 model", () => {
  it("offers only submitted versions, newest first, previous by default", () => {
    const s = submittedVersions(FAKE_VERSIONS);
    expect(s.map((v) => v.revision)).toEqual([2, 1]);
    expect(olderChoices(s).map((v) => v.revision)).toEqual([1]);
    expect(defaultFrom(s)).toBe(1);
    expect(defaultFrom(s.slice(0, 1))).toBeNull();
    expect(defaultFrom([])).toBeNull();
  });
  it("labels the versions as in the prototype", () => {
    const [a, b] = submittedVersions(FAKE_VERSIONS);
    expect(currentLine(a!)).toMatch(/^Predana verzija, .+, verzija 2$/);
    expect(optionLabel(b!)).toMatch(/^Poslano na pregled, .+, verzija 1$/);
  });
  it("counts added and removed words from the blocks", () => {
    expect(countWords(FAKE_BLOCKS)).toEqual({ added: 4, removed: 1 });
    expect(hasChanges(FAKE_BLOCKS)).toBe(true);
    expect(hasChanges(FAKE_BLOCKS.filter((b) => b.change === "unchanged"))).toBe(false);
  });
  it("shows the entry only with a submission", () => {
    expect(hasSubmission(FAKE_VERSIONS)).toBe(true);
    expect(hasSubmission(FAKE_VERSIONS.filter((v) => v.kind === "checkpoint"))).toBe(false);
  });
  it("turns a failing or invalid read into unavailable", async () => {
    const boom = { versions: async () => { throw new Error("x"); }, compare: async () => { throw new Error("x"); } };
    expect(await loadVersions(boom, "d")).toEqual({ kind: "unavailable" });
    expect(await loadComparison(boom, "d", 1, 2)).toEqual({ kind: "unavailable" });
    expect(await loadComparison(fakeN11Port(), "d", 2, 2)).toEqual({ kind: "unavailable" });
    expect(await loadComparison(fakeN11Port(), "d", 1, 2)).toMatchObject({ kind: "ready" });
  });
  it("compares an edited paragraph word by word", () => {
    expect(wordDiff("Stari uvodni odlomak.", "Novi uvodni odlomak s dvije rečenice.")).toEqual([
      { kind: "removed", text: "Stari" }, { kind: "added", text: "Novi" }, { kind: "same", text: " uvodni odlomak" },
      { kind: "added", text: " s dvije rečenice" }, { kind: "same", text: "." },
    ]);
    expect(diffRows(FAKE_BLOCKS).map((r) => r.change)).toEqual(["unchanged", "changed", "unchanged"]);
  });
  it("keeps unpaired and mismatched blocks whole, and falls back above the size bound", () => {
    const removed = { kind: "paragraph", change: "removed", text: "a b" } as const;
    const addedQuote = { kind: "quote", change: "added", text: "a c" } as const;
    expect(diffRows([removed, addedQuote]).map((r) => r.change)).toEqual(["removed", "added"]);
    expect(diffRows([{ ...removed, kind: "quote" }, addedQuote]).map((r) => r.change)).toEqual(["changed"]);
    const long = "riječ ".repeat(2100);
    expect(wordDiff(long, long + "x")).toBeNull();
    expect(countWords([{ ...removed, text: long }, { ...addedQuote, kind: "paragraph", text: "x" }])).toEqual({ added: 1, removed: 2100 });
  });
});
