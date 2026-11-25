// @vitest-environment jsdom
// WEB-V16-ETAPE-STUDENT: the section's rules and behaviour. Every id and text is invented.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { StudentMilestone } from "../../../../../../src/client/milestone-submit";
import { stagesStudentHr as t } from "./messages.hr";
import { showDate, stagesRead } from "./model";

const submitMilestone = vi.fn();
const readStudentMilestones = vi.fn();
vi.mock("../../../../../../src/client/milestone-submit", async (original) => ({
  ...(await original<typeof import("../../../../../../src/client/milestone-submit")>()),
  submitMilestone: (...a: unknown[]) => submitMilestone(...a),
  readStudentMilestones: (...a: unknown[]) => readStudentMilestones(...a),
}));
const { section } = await import("./section");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ID1 = "aaaaaaaa-0000-4000-8000-000000000001";
const ID2 = "aaaaaaaa-0000-4000-8000-000000000002";
const m = (id: string, state: StudentMilestone["state"], extra: Partial<StudentMilestone> = {}): StudentMilestone => ({
  id, title: `Etapa ${id.slice(-1)}`, description: "", dueAt: "2027-02-01T00:00:00Z", state, everSubmitted: false,
  submittedRevisionId: null, submittedAt: null, revisionComment: null, revisionDueAt: null, revisionRequestedAt: null,
  approvedAt: null, approvalMessage: null, ...extra,
});
const ok = (milestones: StudentMilestone[]) => ({ ok: true, status: 200, body: { milestones } });

let root: Root | null = null;
afterEach(() => { act(() => root?.unmount()); root = null; document.body.innerHTML = ""; vi.clearAllMocks(); });
async function mountView(value: StudentMilestone[], reload = vi.fn()): Promise<HTMLElement> {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(h(section.View, { documentId: "izmisljeni-rad", role: "student", value, reload })); });
  return host;
}
const button = (host: HTMLElement) => [...host.querySelectorAll("button")].find((b) => b.textContent === t.submit)!;

describe("stagesRead", () => {
  it("404 hides the section, other failures are unavailable, never empty", () => {
    expect(stagesRead("student", { ok: false, status: 404 })).toEqual({ kind: "notFound" });
    for (const status of [0, 401, 500, 503]) expect(stagesRead("student", { ok: false, status })).toEqual({ kind: "unavailable" });
    expect(stagesRead("student", { ok: true, status: 200, body: {} })).toEqual({ kind: "unavailable" });
  });
  it("an empty list is empty, a list is ready, the mentor sees nothing", () => {
    expect(stagesRead("student", ok([]))).toEqual({ kind: "empty" });
    expect(stagesRead("student", ok([m(ID1, "approved")])).kind).toBe("ready");
    expect(stagesRead("mentor", ok([m(ID1, "approved")]))).toEqual({ kind: "notFound" });
  });
  it("section.read does not call the server for a mentor", async () => {
    expect(await section.read("d", "mentor")).toEqual({ kind: "notFound" });
    expect(readStudentMilestones).not.toHaveBeenCalled();
    readStudentMilestones.mockResolvedValueOnce({ ok: false, status: 404 });
    expect(await section.read("tuđi-rad", "student")).toEqual({ kind: "notFound" });
  });
});

describe("showDate", () => {
  it("is null for a missing or broken date", () => {
    expect(showDate(null)).toBeNull();
    expect(showDate("nije datum")).toBeNull();
    expect(showDate("2027-02-01T00:00:00Z")).toContain("2027");
  });
});

describe("StagesView", () => {
  it("shows each state; a returned stage shows the comment and new deadline; only open stages can be sent", async () => {
    const host = await mountView([
      m(ID1, "revision_requested", { revisionComment: "Dopunite uvod.", revisionDueAt: "2027-03-01T00:00:00Z" }),
      m(ID2, "submitted", { submittedAt: "2027-01-20T00:00:00Z" }),
    ]);
    expect(host.textContent).toContain(t.states.revision_requested);
    expect(host.textContent).toContain("Dopunite uvod.");
    expect(host.textContent).toContain(t.revisionDue);
    expect(host.textContent).toContain(t.states.submitted);
    expect(host.querySelectorAll("button")).toHaveLength(1);
  });

  it("an approved stage has no controls; the student gets no mentor controls", async () => {
    const host = await mountView([m(ID1, "approved", { approvedAt: "2027-01-25T00:00:00Z" })]);
    expect(host.querySelectorAll("button")).toHaveLength(0);
    expect(host.textContent).not.toMatch(/Odobri|Vrati na doradu/);
  });

  it("a double click sends one submit, and a saved answer reads again", async () => {
    let finish!: (v: unknown) => void;
    submitMilestone.mockReturnValueOnce(new Promise((r) => { finish = r; }));
    const reload = vi.fn();
    const host = await mountView([m(ID1, "not_submitted")], reload);
    await act(async () => { button(host).click(); button(host).click(); });
    expect(submitMilestone).toHaveBeenCalledTimes(1);
    expect(submitMilestone.mock.calls[0]!.slice(0, 2)).toEqual(["izmisljeni-rad", ID1]);
    await act(async () => { finish({ kind: "saved", milestone: m(ID1, "submitted") }); });
    expect(reload).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[role="status"]')?.textContent).toBe(t.saved);
  });

  it("409 is a message and a re-read; an unknown answer is a message and no re-read", async () => {
    const reload = vi.fn();
    const host = await mountView([m(ID1, "not_submitted")], reload);
    submitMilestone.mockResolvedValueOnce({ kind: "promijenjeno" });
    await act(async () => { button(host).click(); });
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(t.changed);
    expect(reload).toHaveBeenCalledTimes(1);
    submitMilestone.mockResolvedValueOnce({ kind: "nepoznato" });
    await act(async () => { button(host).click(); });
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(t.unknown);
    expect(reload).toHaveBeenCalledTimes(1);
    submitMilestone.mockResolvedValueOnce({ kind: "session-expired" });
    await act(async () => { button(host).click(); });
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(t.sessionExpired);
  });
});
