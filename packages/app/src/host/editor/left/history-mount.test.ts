// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LeftPanel, type LeftSections } from "@/components/editor/layout-prefs/LeftPanel";
import { editorPanelLayoutsHr } from "@/lib/i18n/messages.hr";

import { fakeTimeMachinePort } from "../../student/time-machine/fake-port";
import { restoreMessages } from "../../student/document-history/restore/messages.hr";
import { timeMachineMessages } from "../../student/time-machine/messages.hr";
import { HistorySection } from "./HistorySection";
import { leftSectionsFor } from "./LeftSectionsHost";

// The panel and the restore host read the open editor; here there is none, which is what they get
// before the sheet has loaded.
vi.mock("@/components/editor/LocalDocument", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useLocalEditor: () => null,
  useLocalSignedOut: () => false,
  useLocalUnconfirmed: () => ({ unconfirmed: false, now: () => false, edits: () => 0 }),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement | null = null;
afterEach(() => { host?.remove(); host = null; });

async function mount(node: ReactNode) {
  host = document.createElement("div");
  document.body.append(host);
  await act(async () => { createRoot(host!).render(node); });
  return host;
}

const historyLabel = editorPanelLayoutsHr.leftSections.history;
const groups = (el: HTMLElement) => [...el.querySelectorAll("summary")].map((s) => s.textContent);

describe("Povijest dokumenta in the left panel (PIL-D7-POVIJEST, mount)", () => {
  it("leftSectionsFor gives the history only with a document id", () => {
    expect(Object.keys(leftSectionsFor("rad-1"))).not.toContain("history");
    expect(Object.keys(leftSectionsFor("rad-1", ""))).not.toContain("history");
    const sections = leftSectionsFor("rad-1", "dok-1");
    expect(Object.keys(sections)).toContain("history");
    expect(Object.keys(sections)).toEqual(expect.arrayContaining(["requirements", "figures", "stash", "progress", "deadlines", "thread"]));
  });

  it("leftSections as a function of the work: the page's shape gives the history once the document is known", () => {
    // The shape packages/app/src/host/student/work.tsx passes to EditorPageWork.
    const leftSections = ({ documentId }: { documentId: string }): LeftSections => ({ ...leftSectionsFor("rad-1", documentId), chapter: createElement("p") });
    expect(leftSections({ documentId: "dok-1" }).history).toBeDefined();
    expect(leftSections({ documentId: "" }).history).toBeUndefined();
  });

  it("the panel shows the history group for a caller that gives it, and no empty group for one that does not", async () => {
    const without = await mount(createElement(LeftPanel, { layout: "a", sections: { progress: createElement("p", null, "Napredak") }, settings: null, onJump: () => undefined }));
    expect(groups(without)).not.toContain(historyLabel);
    expect(without.textContent).not.toContain(historyLabel);
    expect(without.textContent).toContain(editorPanelLayoutsHr.emptyGroup);
    host?.remove();
    const withHistory = await mount(createElement(LeftPanel, { layout: "a", sections: { history: createElement("p", null, "sadržaj povijesti") }, settings: null, onJump: () => undefined }));
    expect(groups(withHistory)).toContain(historyLabel);
    expect(withHistory.textContent).toContain("sadržaj povijesti");
  });

  it("HistorySection holds the versions, the restore and the comparison, all on the same port", async () => {
    const port = fakeTimeMachinePort();
    const versions = vi.spyOn(port, "versions");
    const el = await mount(createElement(HistorySection, { documentId: "dok-1", port }));
    expect(el.querySelector("[data-version-history]")).not.toBeNull();
    expect(el.querySelectorAll("[data-version-history] li button")).toHaveLength(3);
    // RestoreHost reads the list through the same port and, with an older version in it, offers the restore.
    expect(el.querySelector(`section[aria-label="${restoreMessages.title}"]`)).not.toBeNull();
    expect([...el.querySelectorAll("select option")].map((o) => o.textContent)).toContain(restoreMessages.choose);
    expect(el.textContent).toContain(timeMachineMessages.open);
    expect(versions).toHaveBeenCalledWith("dok-1");
    expect(versions.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("HistorySection offers no restore while the list cannot be read", async () => {
    const port = { ...fakeTimeMachinePort(), versions: async () => ({ kind: "unavailable" as const }) };
    const el = await mount(createElement(HistorySection, { documentId: "dok-1", port }));
    expect(el.querySelector(`section[aria-label="${restoreMessages.title}"]`)).toBeNull();
    expect(el.querySelector("[role=alert]")?.textContent).toBe(timeMachineMessages.unavailable);
  });
});
