import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../scripts/forbidden-terms/terms";
import ReturnForRevisionDialog from "./ReturnForRevisionDialog";
import { returnForRevisionHr } from "./messages.hr";
import { buildReturn, returnForRevision } from "./return-for-revision";

const base = { documentId: "dok-1", instruction: "Dopunite poglavlje o kompostu.", due: "", today: "2026-11-20" };

describe("buildReturn", () => {
  it("refuses an empty instruction", () => {
    expect(buildReturn({ ...base, instruction: "  " })).toEqual({ ok: false, error: "empty" });
  });
  it("refuses a too long instruction", () => {
    expect(buildReturn({ ...base, instruction: "a".repeat(2001) })).toEqual({ ok: false, error: "tooLong" });
  });
  it("sends no deadline when none is chosen", () => {
    expect(buildReturn(base)).toEqual({ ok: true, body: { documentId: "dok-1", instruction: base.instruction, dueAt: null } });
  });
  it("makes the end of the chosen day in Zagreb time", () => {
    const r = buildReturn({ ...base, due: "2026-11-30" });
    expect(r.ok && r.body.dueAt).toBe("2026-11-30T22:59:00.000Z");
  });
  it("refuses a day in the past", () => {
    expect(buildReturn({ ...base, due: "2026-11-19" })).toEqual({ ok: false, error: "pastDue" });
  });
});

describe("returnForRevision", () => {
  const body = { documentId: "dok-1", instruction: "x", dueAt: null };
  it.each([[200, "ok"], [401, "signedOut"], [403, "forbidden"], [409, "conflict"], [500, "unavailable"], [null, "unavailable"]] as const)(
    "status %s is %s", async (status, outcome) => {
      expect(await returnForRevision(body, async () => status)).toBe(outcome);
    });
  it("sends nothing after the session ended", async () => {
    let called = false;
    expect(await returnForRevision(body, async () => { called = true; return 200; }, () => false)).toBe("signedOut");
    expect(called).toBe(false);
  });
});

describe("ReturnForRevisionDialog", () => {
  it("renders the labels and has no forbidden terms", () => {
    const html = renderToStaticMarkup(createElement(ReturnForRevisionDialog, {
      documentId: "dok-1", today: "2026-11-20", open: true, post: async () => 200, onClose: () => {}, onSent: () => {},
    }));
    expect(html).toContain(returnForRevisionHr.instructionLabel);
    expect(findForbiddenTerms(Object.values(returnForRevisionHr).filter((v) => typeof v === "string").join("\n"))).toEqual([]);
  });
});
