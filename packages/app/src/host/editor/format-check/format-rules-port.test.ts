import { describe, expect, it } from "vitest";

import { readFormatRules, rulesOf } from "./format-rules-port";

const BODY = { wordMin: null, wordMax: 3000, minSources: 3, requiredSections: ["Uvod"], citationStyle: "fpzg", font: null, size: null, spacing: null };

describe("readFormatRules", () => {
  it("reads the rules and refuses a body that is not the contract's", async () => {
    expect(await readFormatRules("a-1", async () => ({ ok: true, body: BODY }))).toEqual({ kind: "ready", rules: BODY });
    for (const bad of [{}, null, { ...BODY, citationStyle: "apa" }, { ...BODY, minSources: -1 }, { ...BODY, requiredSections: [""] }, { ...BODY, wordMax: 0 }]) {
      expect(rulesOf(bad)).toBeNull();
      expect(await readFormatRules("a-1", async () => ({ ok: true, body: bad }))).toEqual({ kind: "unavailable" });
    }
  });
  it("tells another's assignment (404), a ended session (401) and a failure apart", async () => {
    expect(await readFormatRules("tuđe", async () => ({ ok: false, status: 404 }))).toEqual({ kind: "notFound" });
    expect(await readFormatRules("a-1", async () => ({ ok: false, status: 401 }))).toEqual({ kind: "signIn" });
    expect(await readFormatRules("a-1", async () => ({ ok: false, status: 503 }))).toEqual({ kind: "unavailable" });
    expect(await readFormatRules("a-1", async () => { throw new Error("mrežna greška"); })).toEqual({ kind: "unavailable" });
  });
});
