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
  // NF-3 PR-8: a refusal is a panel of its own; "Pokušaj ponovno" waits for the text to be on the server.
  it("names the workspace and that the work is not submitted when refused, in a panel of its own", () => {
    const next = nextOf({ kind: "odbijeno", reason: "segment_unsigned" });
    expect(next).toMatchObject({ go: null, title: t.refusedTitle, offer: "retryWhenSaved", retry: false, alertAt: 0 });
    expect((next as unknown as { text: string[] }).text).toEqual([t.blocked.segment_unsigned, t.notSavedLine]);
    expect(t.notSavedLine).toContain("Rad nije predan.");
    for (const reason of ["record_discontinuous", "no_evidence"] as const) {
      expect(nextOf({ kind: "odbijeno", reason })).toMatchObject({ text: [t.blocked[reason], t.notSavedLine], retry: false });
    }
  });
  it("says 'zamjenski postupak' only when the server names one, and the request time only when it is known", () => {
    expect(nextOf({ kind: "nedovrseno" })).toMatchObject({ title: t.incompleteTitle, text: [t.incompleteMismatch, t.incompleteUnavailable], retry: false });
    const named = nextOf({ kind: "nedovrseno" }, { requestedAt: "2026-11-20T09:00:00.000000Z", alternative: true }) as unknown as { text: string[] };
    expect(named.text[1]).toContain(whenOf("2026-11-20T09:00:00.000000Z"));
    expect(named.text[2]).toBe(t.incompleteAlternative);
    expect(t.incompleteTitle).not.toContain("zamjenski");
  });
  it("a newer version on the server is its own panel with 'Učitaj ponovno'", () => {
    expect(nextOf({ kind: "greska", code: "stale_revision" })).toMatchObject({ title: t.refusedTitle, offer: "reload", retry: false, text: [t.errors.stale_revision, t.notSubmitted] });
  });
  it("an unknown outcome offers the check, is read again, and never says 'nije predano' (PR-9)", () => {
    const next = nextOf({ kind: "nepoznato" }) as unknown as { text: string[]; offer: string; recheck: boolean; retry: boolean };
    expect(next).toMatchObject({ offer: "check", recheck: true, retry: false });
    expect(next.text).toEqual([t.unknown, t.unknownAlert]);
    expect(next.text.join(" ")).not.toMatch(/nije predan/);
    const known = nextOf({ kind: "nepoznato" }, { requestedAt: "2026-11-20T09:00:00.000000Z", alternative: false }) as unknown as { text: string[] };
    expect(known.text[0]).toBe(t.unknownRequested.replace("{when}", whenOf("2026-11-20T09:00:00.000000Z")));
  });
  it("409 not_open after the deadline is the panel 'Predaja nije otvorena' with the deadline, without 'Predaj rad' (PR-17)", () => {
    const next = nextOf({ kind: "greska", code: "not_open" }, { requestedAt: null, alternative: false, timing: { kind: "late", dueAt: "2026-11-10T22:59:00.000Z" } }) as unknown as { title: string; text: string[]; offer: string; retry: boolean };
    expect(next).toMatchObject({ title: t.late.forbiddenTitle, offer: "back", retry: false });
    expect(next.text[0]).toContain("Rok je bio 10. 11. 2026. u 23:59.");
  });
  // Review #590, 1: before the deadline or during an extension the server's not_open says nothing of a deadline.
  it("409 not_open before the deadline, during an extension or with no known deadline is one neutral line", () => {
    for (const timing of [{ kind: "open" }, { kind: "extended", until: "2026-11-25T22:59:00.000Z" }] as const) {
      expect(nextOf({ kind: "greska", code: "not_open" }, { requestedAt: null, alternative: false, timing })).toMatchObject({ title: t.late.forbiddenTitle, text: [t.late.notOpen], retry: false });
    }
    expect(nextOf({ kind: "greska", code: "not_open" })).toMatchObject({ text: [t.late.notOpen] });
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
