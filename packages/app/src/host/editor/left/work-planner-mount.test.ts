// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { leftSectionsFor, Progress } from "./LeftSectionsHost";

// F4-PM2-R19 (mount): the work planner shows in the student's Napredak panel. Invented chapters only.
const live = vi.hoisted(() => ({
  snap: { headings: [{ id: "p1", pos: 1, number: "1", title: "Uvod" }], words: [100], total: 100, figures: [], current: 0, selected: "" },
  targets: new Map<string, { min: number | null; max: number | null }>([["p1", { min: 400, max: null }]]),
}));
vi.mock("./use-left", async (original) => ({ ...(await original<Record<string, unknown>>()), useWorkSnapshot: () => live.snap }));
vi.mock("@/components/editor/LocalDocument", async (original) => ({ ...(await original<Record<string, unknown>>()), useLocalEditor: () => null }));
vi.mock("../../../../../../src/components/editor/LocalDocument.tsx", async (original) => ({ ...(await original<Record<string, unknown>>()), useLocalEditor: () => null }));
vi.mock("../chapter-length/use-chapter-targets", () => ({ useChapterTargets: () => live.targets }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement | null = null;
afterEach(() => { host?.remove(); host = null; });

async function mount(node: ReturnType<typeof createElement>) {
  host = document.createElement("div");
  document.body.append(host);
  await act(async () => { createRoot(host!).render(node); });
  return host;
}
const planner = (el: HTMLElement) => el.querySelector("[data-work-planner]");

describe("WorkPlanner in Napredak (PM2-R19)", () => {
  it("shows a plan to the student when there is a minimum and a deadline", async () => {
    const now = new Date(2099, 11, 10, 12);
    const el = await mount(createElement(Progress, { dueAt: "2099-12-12T10:00:00Z", now }));
    expect(planner(el)?.getAttribute("data-work-planner")).toBe("plan");
    expect(planner(el)?.textContent).toContain("300");
  });

  it("says honestly that there is no plan without a deadline", async () => {
    const el = await mount(createElement(Progress, { dueAt: null }));
    expect(planner(el)?.getAttribute("data-work-planner")).toBe("noDeadline");
  });

  it("marks a passed deadline as late and an unreadable one as no deadline", async () => {
    const now = new Date(2099, 11, 20, 12);
    const late = await mount(createElement(Progress, { dueAt: "2099-12-12T10:00:00Z", now }));
    expect(planner(late)?.getAttribute("data-work-planner")).toBe("late");
    host?.remove();
    const bad = await mount(createElement(Progress, { dueAt: "nije-datum" }));
    expect(planner(bad)?.getAttribute("data-work-planner")).toBe("noDeadline");
  });

  it("shows the no-goals state when no chapter has a target", async () => {
    live.targets = new Map();
    const el = await mount(createElement(Progress, { dueAt: "2099-12-12T10:00:00Z" }));
    expect(planner(el)?.getAttribute("data-work-planner")).toBe("noGoals");
    live.targets = new Map([["p1", { min: 400, max: null }]]);
  });

  it("is reached through the panel's progress section", async () => {
    const el = await mount(createElement("div", null, leftSectionsFor("rad-1", undefined, "2099-12-12T10:00:00Z").progress));
    expect(planner(el)).not.toBeNull();
  });
});
