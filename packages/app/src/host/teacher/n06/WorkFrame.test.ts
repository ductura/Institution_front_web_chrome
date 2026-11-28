// @vitest-environment jsdom
import { act, createElement as h, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HostContext } from "../../context";
import type { Facts } from "./model";
import { workFrameMessages as text } from "./messages.hr";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const facts: Facts = { studentName: "Student A", assignmentId: "a1", state: "nije_predano", previousId: null, nextId: null, receipt: null };
const courses = vi.hoisted(() => ({ read: vi.fn() }));
const frame = vi.hoisted(() => ({ facts: null as unknown }));

vi.mock("./read", () => ({ readFrame: async () => ({ kind: "ready", facts: frame.facts }) }));
vi.mock("@/client/api", () => ({ createApi: () => () => Promise.reject(new Error("unused")) }));
// F4-NAS-R12: the deadline (NAS-R05) and the title come from one teacher.courses.get read (readContext).
vi.mock("../work/review/read", () => ({ readContext: courses.read }));
vi.mock("../revision", () => ({
  RevisionSection: ({ children }: { children: (r: { action: null; banner: null; dialog: null }) => ReactNode }) =>
    children({ action: null, banner: null, dialog: null }),
}));
vi.mock("../n07/WorkPage", () => ({ WorkPage: ({ children }: { children: ReactNode }) => h("div", null, children) }));

import WorkFrame from "./WorkFrame";

let root: Root | null = null;
let el: HTMLElement | null = null;

async function show(dueAt: string | null, state: Facts["state"] = "nije_predano") {
  frame.facts = { ...facts, state };
  courses.read.mockResolvedValue(dueAt === null ? null : { course: "Kolegij", title: "Izmišljeni seminar", workType: "seminar_paper", dueAt });
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
  await act(async () => {
    root!.render(
      h(HostContext.Provider, { value: { base: "" } as never },
        h(WorkFrame, { documentId: "d1", gaps: [], text: h("p", null, "tekst"), aside: h("p", null, "bočno") })),
    );
  });
  return el;
}

afterEach(() => { act(() => root?.unmount()); el?.remove(); root = null; el = null; vi.clearAllMocks(); });

describe("WorkFrame deadline (NAS-R05)", () => {
  it("shows the not-submitted banner and the extension link once the course deadline has passed", async () => {
    const view = await show("2020-01-01T10:00:00.000Z");
    expect(view.textContent).toContain(text.notSubmittedBanner);
    expect(view.querySelector(`a[href*="/nastavnik/zadatak/a1/produljenje"]`)).not.toBeNull();
  });
  it("shows no banner before the deadline", async () => {
    expect((await show("2999-01-01T10:00:00.000Z")).textContent).not.toContain(text.notSubmittedBanner);
  });
  it("shows no banner when the course list is unavailable", async () => {
    expect((await show(null)).textContent).not.toContain(text.notSubmittedBanner);
  });
});

describe("WorkFrame heading (F4-NAS-R12)", () => {
  it("names the student, the kind of work and the assignment's title from the course list", async () => {
    const view = await show("2999-01-01T10:00:00.000Z");
    expect(view.querySelector("h1")?.textContent).toBe("Student A, Seminarski rad „Izmišljeni seminar”");
    expect(courses.read).toHaveBeenCalledTimes(1);
    expect(courses.read).toHaveBeenCalledWith("a1");
  });
  it("keeps the plain kind and no title when the course list does not name the assignment", async () => {
    expect((await show(null)).querySelector("h1")?.textContent).toBe(`Student A, ${text.workKind}`);
  });
  it("shows no not-submitted banner for a submitted work even after the deadline", async () => {
    const view = await show("2020-01-01T10:00:00.000Z", "predano");
    expect(view.querySelector("h1")?.textContent).toContain("„Izmišljeni seminar”");
    expect(view.textContent).not.toContain(text.notSubmittedBanner);
  });
});
