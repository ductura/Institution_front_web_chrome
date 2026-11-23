import { describe, expect, it } from "vitest";

import { extendedDueOf, nextOf, submitStageOf, wordCount, whenOf } from "./model";
import { submitText as t } from "./messages.hr";

const NOW = Date.parse("2026-11-20T10:00:00Z");

describe("submitStageOf (C-15)", () => {
  it("is submitted first, then the extended deadline decides", () => {
    expect(submitStageOf("submitted", "2026-11-01T10:00:00Z", null, NOW)).toEqual({ kind: "submitted" });
    expect(submitStageOf("in_progress", "2026-11-19T10:00:00Z", null, NOW)).toEqual({ kind: "closed", dueAt: "2026-11-19T10:00:00Z" });
    expect(submitStageOf("in_progress", "2026-11-19T10:00:00Z", "2026-11-25T22:59:00Z", NOW)).toEqual({ kind: "extended", until: "2026-11-25T22:59:00Z" });
    expect(submitStageOf("in_progress", "2026-11-10T10:00:00Z", "2026-11-15T22:59:00Z", NOW)).toEqual({ kind: "closed", dueAt: "2026-11-15T22:59:00Z" });
    expect(submitStageOf("in_progress", "2026-11-25T10:00:00Z", null, NOW)).toEqual({ kind: "open" });
    expect(submitStageOf("in_progress", "nije datum", null, NOW)).toEqual({ kind: "unavailable" });
  });
  it("reads the extension out of the assignments body", () => {
    const body = { courses: [{ assignments: [{ id: "AAA", extendedDueAt: "2026-11-25T22:59:00Z" }, { id: "bbb" }] }] };
    expect(extendedDueOf(body, "aaa")).toBe("2026-11-25T22:59:00Z");
    expect(extendedDueOf(body, "bbb")).toBeNull();
    expect(extendedDueOf(null, "aaa")).toBeNull();
  });
});

describe("nextOf", () => {
  it("names the workspace and that the work is not submitted when refused", () => {
    const next = nextOf({ kind: "odbijeno", reason: "segment_unsigned" });
    expect(next).toMatchObject({ go: null, offer: "workspace", retry: true });
    expect((next as unknown as { text: string[] }).text[0]).toContain("Rad nije predan.");
  });
  it("says 'zamjenski postupak' only when the server names one", () => {
    expect(nextOf({ kind: "nedovrseno" })).toMatchObject({ title: t.incompleteTitle, text: [t.incompleteUnavailable] });
    const named = nextOf({ kind: "nedovrseno" }, { requestedAt: "2026-11-20T09:00:00.000000Z", alternative: true }) as unknown as { text: string[] };
    expect(named.text[0]).toContain("zamjenskim postupkom");
    expect(named.text[0]).toContain(whenOf("2026-11-20T09:00:00.000000Z"));
  });
  it("an unknown outcome offers the check and never says 'nije predano'", () => {
    const next = nextOf({ kind: "nepoznato" }) as unknown as { text: string[]; offer: string };
    expect(next.offer).toBe("check");
    expect(next.text.join(" ")).not.toMatch(/nije predan/);
  });
  it("a state from the server leads to the receipt, the waiting line or the notice", () => {
    expect(nextOf({ kind: "check", state: { kind: "none" } })).toMatchObject({ retry: true });
    expect(nextOf({ kind: "greska", code: "not_acknowledged" })).toEqual({ go: "notice" });
    expect(nextOf({ kind: "check", state: { kind: "session-expired" } })).toEqual({ go: "signIn" });
  });
});

describe("wordCount", () => {
  it("counts words over blocks", () => {
    expect(wordCount([{ type: "paragraph", children: [{ text: "Jedan dva  tri", marks: [] }] }, { type: "heading", level: 1, children: [{ text: "Četiri", marks: [] }] }])).toBe(4);
  });
});

describe("forbidden terms", () => {
  it("the words of step 4 hold none", async () => {
    const { findForbiddenTerms } = await import("../../../../../../../scripts/forbidden-terms/terms.ts");
    const all = JSON.stringify(t);
    expect(findForbiddenTerms(all)).toEqual([]);
  });
});

// PIL-K-IZJAVA-VRATA: 409 declaration_required is a warning that leads to step 2, the work not submitted.
describe("nextOf izjava", () => {
  it("is a warning with the way to the declaration, and the student may submit again after confirming", () => {
    expect(nextOf({ kind: "izjava" })).toEqual({ go: null, title: t.declarationRequiredTitle, text: [t.declarationRequired], offer: "declaration", retry: true });
  });
});
