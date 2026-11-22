import { describe, expect, it } from "vitest";
import { FAKE_BLOCKS, FAKE_VERSIONS, fakeN11Port } from "./fake-port";
import { countWords, currentLine, defaultFrom, hasChanges, hasSubmission, loadComparison, loadVersions, olderChoices, optionLabel, submittedVersions } from "./model";

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
    expect(currentLine(a!)).toMatch(/^Predana verzija · .+ · verzija 2$/);
    expect(optionLabel(b!)).toMatch(/^Poslano na pregled · .+ · verzija 1$/);
  });
  it("counts added and removed words from the blocks", () => {
    expect(countWords(FAKE_BLOCKS)).toEqual({ added: 6, removed: 3 });
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
});
