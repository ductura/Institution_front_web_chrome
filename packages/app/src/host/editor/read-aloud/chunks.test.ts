import { describe, expect, it } from "vitest";

import { MAX_CHUNK, splitIntoChunks } from "./chunks";

// WEB-V20-NAGLAS-JEZGRA: invented text only.
describe("splitIntoChunks", () => {
  it("splits by sentence and keeps offsets into the source", () => {
    const source = "Prva rečenica. Druga rečenica! Treća?";
    const chunks = splitIntoChunks(source);
    expect(chunks.map((c) => c.text)).toEqual(["Prva rečenica.", "Druga rečenica!", "Treća?"]);
    for (const c of chunks) expect(source.slice(c.start, c.end)).toBe(c.text);
  });

  it("never exceeds 200 characters, cutting long sentences at commas or spaces", () => {
    const long = `${Array.from({ length: 60 }, (_, i) => `riječ${i}`).join(" ")}.`;
    const chunks = splitIntoChunks(long);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.text.length).toBeLessThanOrEqual(MAX_CHUNK);
    expect(chunks.map((c) => c.text).join(" ")).toBe(long);
  });

  it("hard-cuts text without any separator", () => {
    const chunks = splitIntoChunks("a".repeat(450));
    expect(chunks.map((c) => c.text.length)).toEqual([200, 200, 50]);
  });

  it("returns nothing for empty or blank text", () => {
    expect(splitIntoChunks("")).toEqual([]);
    expect(splitIntoChunks("  \n\t ")).toEqual([]);
  });

  it("treats paragraph breaks as boundaries and does not split on abbreviations without a space after", () => {
    expect(splitIntoChunks("Prvi odlomak\n\nDrugi odlomak").map((c) => c.text)).toEqual(["Prvi odlomak", "Drugi odlomak"]);
    expect(splitIntoChunks("Vrijednost 3.5 je mala.").map((c) => c.text)).toEqual(["Vrijednost 3.5 je mala."]);
  });

  it("scans long punctuation runs in linear time", () => {
    const started = performance.now();
    const chunks = splitIntoChunks(`${".".repeat(50000)}a`);
    expect(performance.now() - started).toBeLessThan(500);
    expect(chunks.every((c) => c.text.length <= MAX_CHUNK)).toBe(true);
  });
});
