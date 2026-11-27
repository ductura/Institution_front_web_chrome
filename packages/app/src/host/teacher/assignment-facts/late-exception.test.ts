import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HostContext } from "../../context";
import { lateDraft, readLateExceptions, recordLateException } from "./late-exception";
import { LateException } from "./LateException";
import { assignmentFactsMessages as text } from "./messages.hr";

const now = Date.parse("2027-02-01T10:00:00Z");
const ok = { studentId: "s1", reasonId: "justified", dueLocal: "2027-02-10T12:00" };

describe("exception for a late submission (NZ-5, variant B)", () => {
  it("builds a one-student exception draft with the Zagreb minute turned into an instant", () => {
    expect(lateDraft(ok, now)).toEqual({ ok: true, draft: { studentId: "s1", untilAt: "2027-02-10T11:00:00.000Z", reasonId: "justified" } });
  });

  it("asks for a reason from the closed list, a valid deadline and a deadline in the future", () => {
    expect(lateDraft({ ...ok, reasonId: "" }, now)).toEqual({ ok: false, error: text.late.needReason });
    expect(lateDraft({ ...ok, reasonId: "all" }, now)).toEqual({ ok: false, error: text.late.needReason });
    expect(lateDraft({ ...ok, dueLocal: "" }, now)).toEqual({ ok: false, error: text.late.needDue });
    expect(lateDraft({ ...ok, dueLocal: "2027-02-01T11:00" }, now)).toEqual({ ok: false, error: text.late.dueNotLater });
  });

  it("offers a button named after the student and keeps the dialog closed", () => {
    const host = { base: "app", page: { kind: "teacher" }, role: "teacher" } as never;
    const html = renderToStaticMarkup(createElement(HostContext.Provider, { value: host },
      createElement(LateException, { assignmentId: "a1", studentId: "s1", name: "Ana Izmišljena", onResult: () => undefined })));
    expect(html).toContain(`aria-label="${text.late.open} Ana Izmišljena"`);
    expect(html).not.toContain("<dialog open");
    expect(html).not.toMatch(/plagijat|varanje|sumnjiv/i);
  });
});

const SID = "3f1c2a10-5b7d-4e21-9a3c-0d1e2f3a4b5c";
const draft = { studentId: SID, untilAt: "2027-02-10T11:00:00.000Z", reasonId: "justified" } as const;
const stored = { id: "9b2d4c11-7a3e-4f05-8c6d-1e2f3a4b5c6d", studentId: SID, untilAt: draft.untilAt, reasonId: "justified", createdBy: "7c3e5d22-8b4f-4a16-9d7e-2f3a4b5c6d7e", createdAt: "2027-02-01T10:00:00.000Z" };
type Reply = { ok: true; status: number; body: unknown } | { ok: false; status: number; code: string };
const client = (reply: Reply | "throw") => {
  const calls: unknown[][] = [];
  const call = (async (...args: unknown[]) => { calls.push(args); if (reply === "throw") throw new Error("down"); return reply; }) as never;
  return { call, calls };
};

describe("late exception over teacher.late-exception.post (NZ-5, variant B)", () => {
  it("calls the late-exception route with the assignment and the body", async () => {
    const c = client({ ok: true, status: 201, body: { exception: stored } });
    expect(await recordLateException(c.call, "a1", draft)).toEqual({ kind: "zabiljezeno", exception: stored });
    expect(c.calls[0]).toEqual(["teacher.late-exception.post", { params: { assignmentId: "a1" }, query: undefined, body: draft }]);
  });
  it("is no success when the answer names another student or deadline, or is not 201 (B-6)", async () => {
    for (const body of [{ exception: { ...stored, studentId: "00000000-0000-4000-8000-000000000000" } }, { exception: { ...stored, untilAt: "2027-03-01T00:00:00.000Z" } }])
      expect(await recordLateException(client({ ok: true, status: 201, body }).call, "a1", draft)).toEqual({ kind: "nepoznato" });
    expect(await recordLateException(client({ ok: true, status: 200, body: { exception: stored } }).call, "a1", draft)).toEqual({ kind: "nepoznato" });
  });
  it("maps 401, 404 (another teacher's assignment), 422 and a broken connection", async () => {
    expect(await recordLateException(client({ ok: false, status: 401, code: "unauthorized" }).call, "a1", draft)).toEqual({ kind: "session-expired" });
    expect(await recordLateException(client({ ok: false, status: 404, code: "not_found" }).call, "a1", draft)).toEqual({ kind: "greska", code: "not_found" });
    expect(await recordLateException(client({ ok: false, status: 422, code: "invalid_input" }).call, "a1", draft)).toEqual({ kind: "greska", code: "invalid" });
    expect(await recordLateException(client({ ok: false, status: 503, code: "unavailable" }).call, "a1", draft)).toEqual({ kind: "nepoznato" });
    expect(await recordLateException(client("throw").call, "a1", draft)).toEqual({ kind: "nepoznato" });
  });
  it("reads the list, and a failed read is never an empty list", async () => {
    expect(await readLateExceptions(client({ ok: true, status: 200, body: { exceptions: [stored] } }).call, "a1")).toEqual({ kind: "ready", exceptions: [stored] });
    expect(await readLateExceptions(client({ ok: false, status: 503, code: "unavailable" }).call, "a1")).toEqual({ kind: "nepoznato" });
    expect(await readLateExceptions(client({ ok: false, status: 404, code: "not_found" }).call, "a1")).toEqual({ kind: "greska", code: "not_found" });
    expect(await readLateExceptions(client("throw").call, "a1")).toEqual({ kind: "nepoznato" });
  });
});
