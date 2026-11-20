// WEB-1113 (N-13): the notes and the page over invented data.
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { DeadlineExtension } from "@/client/deadline-extensions";
import { messagesHr } from "@/lib/i18n/messages.hr";

import { findForbiddenTerms } from "../../../../scripts/forbidden-terms/terms.ts";
import DeadlineExtensions from "./DeadlineExtensions";
import { coversReceivedSubmission, extensionNote, withRecorded } from "./deadline-extensions-logic";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const t = messagesHr.deadlineExtensions;
const A = "2d8b3e4a-6c7f-4a01-9c3d-4e5f6a7b8c01";
const S1 = "2d8b3e4a-6c7f-4a01-9c3d-4e5f6a7b8c02";
const S2 = "2d8b3e4a-6c7f-4a01-9c3d-4e5f6a7b8c03";
const students = [{ studentId: S1, name: "Izmišljena Prva", submitted: true }, { studentId: S2, name: null, submitted: false }];
const ext = (over: Partial<DeadlineExtension> = {}): DeadlineExtension => ({
  extensionId: "2d8b3e4a-6c7f-4a01-9c3d-4e5f6a7b8c10", scope: "student", studentId: S2, studentName: "Izmišljena Druga",
  previousDueAt: "2026-12-14T22:59:00Z", dueAt: "2026-12-20T22:59:00Z", reasonId: "technical", recordedAt: "2026-12-10T09:00:00Z", ...over,
});
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const props = { assignmentId: A, here: "/x", backHref: "/nastavnik/kolegiji" };

describe("extensionNote", () => {
  const one = { scope: "student", studentId: S1, dueAt: "2026-12-20T22:59:00.000Z", reasonId: "justified" } as const;
  const all = { scope: "all", dueAt: "2026-12-20T22:59:00.000Z", reasonId: "justified" } as const;
  const done = (unchanged: boolean) => ({ kind: "zabiljezeno", extension: ext(), existingSubmissionsUnchanged: unchanged }) as const;

  it("tells that a received submission stays unchanged when the extension covers one", () => {
    expect(coversReceivedSubmission(one, students)).toBe(true);
    expect(coversReceivedSubmission({ ...one, studentId: S2 }, students)).toBe(false);
    expect(coversReceivedSubmission(all, students)).toBe(true);
    expect(extensionNote(done(true), one, students)?.text).toContain(t.submissionReceived);
    expect(extensionNote(done(true), { ...one, studentId: S2 }, students)?.text).not.toContain(t.submissionReceived);
  });

  it("is an alert, not a success, when the server says a submission changed", () => {
    expect(extensionNote(done(false), one, students)).toEqual({ tone: "alert", text: t.submissionChanged, recorded: true });
  });

  it("never says recorded on an error or an unknown outcome", () => {
    for (const o of [{ kind: "nepoznato" }, { kind: "greska", code: "invalid" }] as const) {
      const n = extensionNote(o, one, students);
      expect(n?.tone).toBe("alert");
      expect(n?.recorded).toBe(false);
    }
    expect(extensionNote({ kind: "session-expired" }, one, students)).toBeNull();
  });
});

describe("withRecorded", () => {
  it("keeps newest first and does not list one twice", () => {
    const older = ext({ extensionId: "2d8b3e4a-6c7f-4a01-9c3d-4e5f6a7b8c11", recordedAt: "2026-12-01T09:00:00Z" });
    expect(withRecorded([older], ext()).map((e) => e.recordedAt)).toEqual(["2026-12-10T09:00:00Z", "2026-12-01T09:00:00Z"]);
    expect(withRecorded([ext()], ext())).toHaveLength(1);
  });
});

describe("DeadlineExtensions page", () => {
  it("shows the saved extensions after a reload, with both deadlines and the reason", () => {
    const html = renderToStaticMarkup(h(DeadlineExtensions, { ...props, read: { kind: "ready", extensions: [ext()] }, students }));
    const s = text(html);
    expect(s).toContain("Izmišljena Druga");
    expect(s).toContain("Tehnička poteškoća");
    expect(s).toContain("20. prosinca 2026. u 23:59");
    expect(s).toContain("14. prosinca 2026. u 23:59");
  });

  it("says none only for an empty list and unavailable for a failed read", () => {
    expect(text(renderToStaticMarkup(h(DeadlineExtensions, { ...props, read: { kind: "ready", extensions: [] }, students })))).toContain(t.empty);
    const bad = text(renderToStaticMarkup(h(DeadlineExtensions, { ...props, read: { kind: "unavailable" }, students })));
    expect(bad).toContain(t.unavailable);
    expect(bad).not.toContain(t.empty);
  });

  it("offers the student field for one student, and only 'all' without a roster", () => {
    expect(text(renderToStaticMarkup(h(DeadlineExtensions, { ...props, read: { kind: "ready", extensions: [] }, students })))).toContain("Izmišljena Prva");
    const none = renderToStaticMarkup(h(DeadlineExtensions, { ...props, read: { kind: "ready", extensions: [] }, students: [] }));
    expect(text(none)).toContain(t.studentsUnavailable);
    expect(none).not.toContain(t.studentPlaceholder);
  });

  it("uses no forbidden term", () => {
    expect(findForbiddenTerms(JSON.stringify(t))).toEqual([]);
  });
});
