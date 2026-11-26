import { describe, expect, it, vi } from "vitest";

import { readException, withLateReads } from "./exception";
import { submitText as t } from "./messages.hr";
import { dialogLateLine, exceptionFrom, forbiddenLines, isLate, lateLine, timingOf, timingTag, withLateRule } from "./timing";

// WEB-NUZ-PREDAJA-2 (NF-3 PR-7, PR-17, Daniel's answer 3). Invented deadlines only.
const NOW = Date.parse("2026-11-20T10:00:00.000Z");
const DUE = "2026-11-12T22:59:00.000Z";
const UNTIL = "2026-11-25T22:59:00.000Z";
const ext = (scope: "one" | "all", dueAt: string, createdAt: string): Record<string, string> =>
  ({ id: "00000000-0000-4000-8000-000000000001", scope, previousDueAt: DUE, dueAt, reasonId: "justified", createdAt });

describe("withLateRule and withLateReads (F4-PRE-R01)", () => {
  const late = { kind: "late", dueAt: DUE } as const;
  const exc = (untilAt: string) => ({ id: "00000000-0000-4000-8000-000000000002", kind: "exception", untilAt, reasonId: "justified", createdAt: "2026-11-13T09:00:00.000Z" });

  it("says a closed submission before the click, and an open exception is the deadline that counts", () => {
    expect(withLateRule(late, false, { exceptions: [] }, NOW)).toEqual({ kind: "forbidden", dueAt: DUE });
    expect(withLateRule(late, false, { exceptions: [exc("2026-11-15T10:00:00.000Z")] }, NOW)).toEqual({ kind: "forbidden", dueAt: DUE });
    expect(withLateRule(late, false, { exceptions: [exc("2026-11-15T10:00:00.000Z"), exc(UNTIL)] }, NOW)).toEqual({ kind: "exception", dueAt: DUE, until: UNTIL });
    expect(withLateRule(late, true, null, NOW)).toEqual({ kind: "late", dueAt: DUE, allowed: true });
  });

  it("leaves the timing as it was when a read failed or the timing is not late", () => {
    expect(withLateRule(late, null, { exceptions: [] }, NOW)).toBe(late);
    expect(withLateRule(late, false, null, NOW)).toBe(late);
    expect(withLateRule(late, false, { odd: true }, NOW)).toBe(late);
    expect(withLateRule({ kind: "open" }, false, { exceptions: [] }, NOW)).toEqual({ kind: "open" });
  });

  it("words: the closed line before the click, no dialog, no late mark, and the 409 panel names the deadline", () => {
    const closed = { kind: "forbidden", dueAt: DUE } as const;
    expect(lateLine(closed)).toBe(t.late.forbidden.replace("{due}", "12. 11. 2026. u 23:59"));
    expect(isLate(closed)).toBe(false);
    expect(dialogLateLine(closed)).toBeNull();
    expect(forbiddenLines(closed)).toEqual([t.late.forbidden.replace("{due}", "12. 11. 2026. u 23:59"), t.late.forbiddenMeta]);
    expect(lateLine({ kind: "late", dueAt: DUE, allowed: true })).toBe(t.late.pastAllowed.replace("{due}", "12. 11. 2026. u 23:59"));
  });

  it("reads both routes only for a late timing, and a failed read leaves it", async () => {
    const rule = vi.fn(async () => ({ ok: true, body: { lateSubmissionAllowed: false } }));
    const exceptions = vi.fn(async () => ({ ok: true, body: { exceptions: [] } }));
    expect(await withLateReads(late, "a1", NOW, { rule, exceptions })).toEqual({ kind: "forbidden", dueAt: DUE });
    expect(rule).toHaveBeenCalledWith("a1");
    expect(await withLateReads({ kind: "open" }, "a1", NOW, { rule, exceptions })).toEqual({ kind: "open" });
    expect(rule).toHaveBeenCalledTimes(1);
    expect(await withLateReads(late, "a1", NOW, { rule: async () => ({ ok: false }), exceptions })).toBe(late);
    expect(await withLateReads(late, "a1", NOW, { rule, exceptions: async () => { throw new Error("offline"); } })).toBe(late);
  });
});

describe("timingOf", () => {
  it("is late after the deadline that counts, and an exception only for the student's own extension after the deadline", () => {
    expect(timingOf({ kind: "closed", dueAt: DUE }, DUE, null, NOW)).toEqual({ kind: "late", dueAt: DUE });
    expect(timingOf({ kind: "extended", until: UNTIL }, DUE, true, NOW)).toEqual({ kind: "exception", dueAt: DUE, until: UNTIL });
    expect(timingOf({ kind: "extended", until: UNTIL }, DUE, false, NOW)).toEqual({ kind: "extended", until: UNTIL });
    // An unreadable history leaves the ordinary extension.
    expect(timingOf({ kind: "extended", until: UNTIL }, DUE, null, NOW)).toEqual({ kind: "extended", until: UNTIL });
    // The deadline has not passed yet: an extension, never an exception.
    expect(timingOf({ kind: "extended", until: UNTIL }, "2026-11-21T22:59:00.000Z", true, NOW)).toEqual({ kind: "extended", until: UNTIL });
    expect(timingOf({ kind: "open" }, DUE, null, NOW)).toEqual({ kind: "open" });
  });

  it("asks for the second confirmation only when the submission will be marked late", () => {
    expect(isLate({ kind: "late", dueAt: DUE })).toBe(true);
    expect(isLate({ kind: "exception", dueAt: DUE, until: UNTIL })).toBe(true);
    expect(isLate({ kind: "extended", until: UNTIL })).toBe(false);
    expect(isLate({ kind: "open" })).toBe(false);
  });

  it("says both kinds of late submission and the tag of the exception", () => {
    expect(lateLine({ kind: "late", dueAt: DUE })).toBe(t.late.past.replace("{due}", "12. 11. 2026. u 23:59"));
    expect(lateLine({ kind: "exception", dueAt: DUE, until: UNTIL })).toContain("iznimno odobrio kasnu predaju do 25. 11. 2026. u 23:59");
    expect(lateLine({ kind: "open" })).toBeNull();
    expect(timingTag({ kind: "exception", dueAt: DUE, until: UNTIL })).toBe("Iznimka do 25. 11. 2026.");
    expect(timingTag({ kind: "extended", until: UNTIL })).toBe("Rok produljen do 25. 11. 2026.");
    expect(dialogLateLine({ kind: "late", dueAt: DUE })).toBe(t.dialogLate);
    expect(dialogLateLine({ kind: "exception", dueAt: DUE, until: UNTIL })).toContain("do 25. 11. 2026. u 23:59");
  });

  it("names no penalty or consequence beyond the mark (PRODUCT §5)", () => {
    const all = JSON.stringify(t.late) + t.dialogLate + t.lateConfirm;
    expect(all).not.toMatch(/kazn|bodov|ocjen|sankcij/iu);
  });

  // Review #590, 1: 409 not_open is not tied to the deadline; the deadline is named only once it has passed.
  it("the panel of a submission not open names the deadline only after the deadline that counts", () => {
    expect(forbiddenLines({ kind: "late", dueAt: DUE })).toEqual([t.late.forbidden.replace("{due}", "12. 11. 2026. u 23:59"), t.late.forbiddenMeta]);
    for (const timing of [{ kind: "open" }, { kind: "extended", until: UNTIL }, { kind: "exception", dueAt: DUE, until: UNTIL }, { kind: "unavailable" }] as const) {
      expect(forbiddenLines(timing), timing.kind).toEqual([t.late.notOpen]);
    }
    expect(t.late.notOpen).not.toMatch(/rok|više/iu);
  });
});

describe("exceptionFrom (student.deadline-history.get)", () => {
  it("is the student's own exception only when the newest extension is scope one and ends at the extended deadline", () => {
    expect(exceptionFrom({ extensions: [ext("one", UNTIL, "2026-11-15T10:00:00.000Z")] }, UNTIL, DUE)).toBe(true);
    expect(exceptionFrom({ extensions: [ext("all", UNTIL, "2026-11-15T10:00:00.000Z")] }, UNTIL, DUE)).toBe(false);
    expect(exceptionFrom({ extensions: [ext("one", "2026-11-24T22:59:00.000Z", "2026-11-15T10:00:00.000Z")] }, UNTIL, DUE)).toBe(false);
    // The newest one decides: a later extension for all is not this student's exception.
    expect(exceptionFrom({ extensions: [ext("one", UNTIL, "2026-11-15T10:00:00.000Z"), ext("all", UNTIL, "2026-11-16T10:00:00.000Z")] }, UNTIL, DUE)).toBe(false);
    expect(exceptionFrom({ extensions: [] }, UNTIL, DUE)).toBe(false);
    expect(exceptionFrom({ nothing: true }, UNTIL, DUE)).toBeNull();
    expect(exceptionFrom(null, UNTIL, DUE)).toBeNull();
  });

  // Review #590, 2: an extension granted before the deadline is an ordinary extension, not a late submission.
  it("is no exception when the student's own extension was granted before the assignment's deadline", () => {
    expect(exceptionFrom({ extensions: [ext("one", UNTIL, "2026-11-10T10:00:00.000Z")] }, UNTIL, DUE)).toBe(false);
    expect(exceptionFrom({ extensions: [ext("one", UNTIL, DUE)] }, UNTIL, DUE)).toBe(false);
  });

  it("is read only when the deadline has passed and a later one holds; a failed read is null", async () => {
    let calls = 0;
    const ok = async () => { calls += 1; return { ok: true, body: { extensions: [ext("one", UNTIL, "2026-11-15T10:00:00.000Z")] } }; };
    expect(await readException("a", DUE, UNTIL, NOW, ok)).toBe(true);
    expect(await readException("a", "2026-11-21T22:59:00.000Z", UNTIL, NOW, ok)).toBe(false);
    expect(await readException("a", DUE, null, NOW, ok)).toBe(false);
    expect(calls).toBe(1);
    expect(await readException("a", DUE, UNTIL, NOW, async () => ({ ok: false }))).toBeNull();
    expect(await readException("a", DUE, UNTIL, NOW, async () => { throw new Error("prekid"); })).toBeNull();
  });
});
