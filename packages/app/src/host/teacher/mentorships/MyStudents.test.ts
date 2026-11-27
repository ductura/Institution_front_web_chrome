// @vitest-environment jsdom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import type { MentoredWork } from "../../../../../../src/components/teacher/mentored-works-read";
import { overviewText as t } from "./messages.hr";
import { MyStudents } from "./MyStudents";
import type { OverviewCall } from "./overview-read";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Invented people and works only. "Today" is 1. 12. 2026. at noon, Zagreb.
const NOW = Date.parse("2026-12-01T11:00:00.000Z");
const work = (n: number, family: string, extra: Partial<MentoredWork> = {}): MentoredWork => ({
  mentorshipId: `00000000-0000-4000-8000-00000000000${n}`, assignmentId: "00000000-0000-4000-8000-000000000100", documentId: `izmisljeni-rad-${n}`,
  student: { givenName: "Student", familyName: family }, title: `Izmišljeni rad ${n}`, workType: "bachelor_thesis", workState: "in_progress", ...extra,
});
const milestone = (state: string) => ({
  id: "00000000-0000-4000-8000-0000000000e1", title: "Nacrt", description: "", dueAt: "2026-11-28T12:00:00.000Z", state, everSubmitted: state !== "not_submitted",
  submittedRevisionId: null, submittedAt: null, revisionComment: null, revisionDueAt: null, revisionRequestedAt: null, approvedAt: null, approvalMessage: null,
});
const WORKS = [work(1, "A"), work(2, "B"), work(3, "C", { workState: "submitted", workType: "master_thesis" })];

let root: Root | null = null;
let calls = 0;
function server(fail: (documentId: string) => boolean): () => OverviewCall {
  return () => async (op, input) => {
    calls++;
    if (fail(input.params.documentId)) return { ok: false, status: 503, code: "unavailable" };
    if (op === "work.consultation-slots.get") return { ok: true, status: 200, body: { slots: [] } };
    return { ok: true, status: 200, body: { milestones: [milestone(input.params.documentId === "izmisljeni-rad-2" ? "submitted" : "not_submitted")] } };
  };
}
async function show(call: () => OverviewCall, works = WORKS) {
  const host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(h(MyStudents, { works, call, base: "/aplikacija", now: () => NOW })); });
  return host;
}
const cells = (host: HTMLElement) => [...host.querySelectorAll("tbody tr")].map((tr) => [...tr.children].map((c) => c.textContent));

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  calls = 0;
  document.body.innerHTML = "";
});

describe("Moji studenti card (MK-11)", () => {
  it("is a captioned table with the student as row header, 'čeka Vas' first", async () => {
    const host = await show(server(() => false));
    expect(host.querySelector("h2")?.textContent).toBe(t.title);
    expect(host.querySelector("caption")?.textContent).toBe(t.caption);
    expect([...host.querySelectorAll("thead th")].map((th) => [th.textContent, th.getAttribute("scope")]))
      .toEqual([[t.colWork, "col"], [t.colStage, "col"], [t.colState, "col"]]);
    expect([...host.querySelectorAll("tbody th")].every((th) => th.getAttribute("scope") === "row")).toBe(true);
    expect(cells(host)).toEqual([
      ["Student BZavršni rad „Izmišljeni rad 2”", "Nacrt", "čeka Vas: etapa „Nacrt” je na pregledu"],
      ["Student AZavršni rad „Izmišljeni rad 1”", "Nacrt", "kod studenta, rok je bio prije 3 dana"],
      ["Student CDiplomski rad „Izmišljeni rad 3”", t.stageFinal, t.submitted],
    ]);
    expect(host.querySelector("tbody a")?.getAttribute("href")).toBe("/aplikacija/nastavnik/rad/izmisljeni-rad-2");
  });

  it("filters by work type and says when a type has no works", async () => {
    const host = await show(server(() => false));
    const select = host.querySelector("select")!;
    await act(async () => { select.value = "master_thesis"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(cells(host).map((row) => row[0])).toEqual(["Student CDiplomski rad „Izmišljeni rad 3”"]);
    await act(async () => { select.value = "doctoral_thesis"; select.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(host.querySelector("tbody")?.textContent).toBe(t.emptyFilter);
  });

  it("when every read fails it says so with a retry, never an empty table", async () => {
    const host = await show(server(() => true));
    expect(host.querySelector('[role="alert"]')?.textContent).toBe(t.unavailable);
    expect(host.querySelector("table")).toBeNull();
    const before = calls;
    await act(async () => { [...host.querySelectorAll("button")].find((b) => b.textContent === t.retry)!.click(); });
    expect(calls).toBeGreaterThan(before);
  });

  it("when some reads fail those rows say 'not available' and the rest stays", async () => {
    const host = await show(server((d) => d === "izmisljeni-rad-1"));
    expect(host.querySelector('[role="status"]')?.textContent).toContain(t.partly);
    expect(cells(host).at(-1)).toEqual(["Student AZavršni rad „Izmišljeni rad 1”", t.stageUnknown, t.unknown]);
  });

  it("shows nothing when there are no works (the page says so above)", async () => {
    const host = await show(server(() => false), []);
    expect(host.textContent).toBe("");
  });
});
