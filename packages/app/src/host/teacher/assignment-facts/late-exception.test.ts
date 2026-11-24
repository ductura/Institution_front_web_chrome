import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HostContext } from "../../context";
import { lateDraft } from "./late-exception";
import { LateException } from "./LateException";
import { assignmentFactsMessages as text } from "./messages.hr";

const now = Date.parse("2027-02-01T10:00:00Z");
const ok = { studentId: "s1", reasonId: "justified", dueLocal: "2027-02-10T12:00" };

describe("exception for a late submission (NZ-5, variant A)", () => {
  it("builds a one-student extension draft with the Zagreb minute turned into an instant", () => {
    expect(lateDraft(ok, now)).toEqual({ ok: true, draft: { scope: "one", studentId: "s1", dueAt: "2027-02-10T11:00:00.000Z", reasonId: "justified" } });
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
      createElement(LateException, { assignmentId: "a1", studentId: "s1", name: "Ana Izmišljena", onRecorded: () => undefined })));
    expect(html).toContain(`aria-label="${text.late.open} Ana Izmišljena"`);
    expect(html).not.toContain("<dialog open");
    expect(html).not.toMatch(/plagijat|varanje|sumnjiv/i);
  });
});
