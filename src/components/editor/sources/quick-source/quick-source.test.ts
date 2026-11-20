import type { SourceDraft } from "@ductura/ui";
import { describe, expect, it } from "vitest";

import { parseIdentifier } from "./identifier";
import { LookupUnavailable, lookupSource, type SourceLookup } from "./lookup";

describe("parseIdentifier", () => {
  it("normalises a DOI from a link or prefix", () => {
    expect(parseIdentifier("https://doi.org/10.1000/izmisljeno.2026")).toEqual({ kind: "doi", value: "10.1000/izmisljeno.2026" });
    expect(parseIdentifier(" doi: 10.1000/x.1 ")).toEqual({ kind: "doi", value: "10.1000/x.1" });
  });
  it("accepts ISBN-13 and ISBN-10 with hyphens and a check digit", () => {
    expect(parseIdentifier("978-3-16-148410-0")).toEqual({ kind: "isbn", value: "9783161484100" });
    expect(parseIdentifier("ISBN 0-306-40615-2")).toEqual({ kind: "isbn", value: "0306406152" });
    expect(parseIdentifier("0-8044-2957-X")).toEqual({ kind: "isbn", value: "080442957X" });
  });
  it("refuses a wrong check digit and other text", () => {
    expect(parseIdentifier("978-3-16-148410-1")).toBeNull();
    expect(parseIdentifier("10.1/x")).toBeNull();
    expect(parseIdentifier("")).toBeNull();
    expect(parseIdentifier("nešto drugo")).toBeNull();
  });
});

describe("lookupSource", () => {
  const draft: SourceDraft = { type: "web", authors: [], title: "Izmišljeni naslov", year: 2026, url: "https://example.invalid/", accessed: "2026-11-20" };
  it("is unavailable without a route and makes no request", async () => {
    expect(await lookupSource("10.1000/x.1")).toEqual({ state: "unavailable" });
  });
  it("rejects a bad identifier before asking", async () => {
    let calls = 0;
    const lookup: SourceLookup = async () => { calls += 1; return { status: "not_found" }; };
    expect(await lookupSource("x", lookup)).toEqual({ state: "invalid" });
    expect(calls).toBe(0);
  });
  it("maps found, not found and failures", async () => {
    expect(await lookupSource("10.1000/x.1", async () => ({ status: "found", draft }))).toEqual({ state: "found", draft });
    expect(await lookupSource("10.1000/x.1", async () => ({ status: "not_found" }))).toEqual({ state: "not_found" });
    expect(await lookupSource("10.1000/x.1", async () => { throw new Error("mreža"); })).toEqual({ state: "failed" });
    expect(await lookupSource("10.1000/x.1", async () => { throw new LookupUnavailable("x"); })).toEqual({ state: "unavailable" });
  });
});
