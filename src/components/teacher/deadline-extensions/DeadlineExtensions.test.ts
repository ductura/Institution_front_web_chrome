import { describe, expect, it } from "vitest";

import { messagesHr } from "../../../lib/i18n/messages.hr.ts";
import { findForbiddenTerms } from "../../../../scripts/forbidden-terms/terms.ts";

import { extensionNote, extensionsHref, reasonOptions } from "./DeadlineExtensions.tsx";

const t = messagesHr.deadlineExtensions;
const EXT = {
  id: "00000000-0000-4000-8000-0000000000f1", scope: "one", studentId: "00000000-0000-4000-8000-0000000000e1",
  previousDueAt: "2026-12-20T22:59:00.000Z", dueAt: "2026-12-27T22:59:00.000Z", reasonId: "justified",
  createdBy: "00000000-0000-4000-8000-0000000000c1", createdAt: "2026-11-21T09:15:00.000Z",
} as const;

describe("DeadlineExtensions (WEB-1113)", () => {
  it("says recorded only for a recorded extension, and the earlier submission when there was one", () => {
    expect(extensionNote({ kind: "zabiljezeno", extension: EXT, existingSubmissionsUnchanged: false }))
      .toEqual({ tone: "status", lines: [t.recorded] });
    expect(extensionNote({ kind: "zabiljezeno", extension: EXT, existingSubmissionsUnchanged: true }))
      .toEqual({ tone: "status", lines: [t.recorded, t.earlierSubmission] });
  });

  it("never says recorded for a refusal or an unknown outcome (B-6)", () => {
    expect(extensionNote({ kind: "greska", code: "invalid" })).toEqual({ tone: "alert", lines: [t.invalid] });
    expect(extensionNote({ kind: "greska", code: "not_found" })).toEqual({ tone: "alert", lines: [t.notFound] });
    expect(extensionNote({ kind: "nepoznato" })).toEqual({ tone: "alert", lines: [t.unknown] });
    expect(extensionNote({ kind: "session-expired" })).toBeNull();
  });

  it("offers the reason for all students only for all students (N-13)", () => {
    expect(reasonOptions("one").map((o) => o.value)).toEqual(["justified", "technical", "agreement"]);
    expect(reasonOptions("all").map((o) => o.value)).toEqual(["justified", "technical", "agreement", "all"]);
  });

  it("links the page of an assignment", () => {
    expect(extensionsHref("00000000-0000-4000-8000-0000000000a1"))
      .toBe("/nastavnik/zadatak/00000000-0000-4000-8000-0000000000a1/produljenje");
  });

  it("uses no forbidden term (PRODUCT §5)", () => {
    const all = (v: unknown): string[] => (typeof v === "string" ? [v] : Object.values(v as object).flatMap(all));
    expect(findForbiddenTerms(all(t).join("\n"))).toEqual([]);
  });
});
