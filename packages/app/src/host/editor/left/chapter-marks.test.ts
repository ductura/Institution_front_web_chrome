// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { foldable, visibleHeadings } from "@/components/editor/layout-prefs/LeftPanel";
import { editorPanelLayoutsHr } from "@/lib/i18n/messages.hr";

import { notesKey } from "../assist/work-notes";
import { ChapterMarks, chapterMarks } from "./ChapterMarks";
import { storageKey } from "./left-model";
import { leftHr } from "./messages.hr";
import { announceDeviceChange } from "./use-left";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement | null = null;
afterEach(() => { host?.remove(); host = null; localStorage.clear(); });

async function mount(node: ReactNode) {
  host = document.createElement("div");
  document.body.append(host);
  await act(async () => { createRoot(host!).render(node); });
  return host;
}

const h = (id: string, level: number) => ({ id, level });

describe("ED-37 (P2-6, dio 4): the chapter row", () => {
  it("the marks are the state the student set, else the one the words give, and the open tasks", () => {
    expect(chapterMarks(undefined, 0, 0)).toEqual({ state: "draft", fix: 0 });
    expect(chapterMarks(undefined, 120, 2)).toEqual({ state: "working", fix: 2 });
    expect(chapterMarks("done", 0, -1)).toEqual({ state: "done", fix: 0 });
  });

  it("only a chapter with subchapters folds, and folding hides its subchapters only", () => {
    const list = [h("t", 1), h("a", 2), h("a1", 3), h("a2", 3), h("b", 2), h("c", 2), h("c1", 3)];
    expect([...foldable(list)].map((x) => x.id)).toEqual(["a", "c"]);
    expect(visibleHeadings(list, (x) => x.id === "a").map((x) => x.id)).toEqual(["t", "a", "b", "c", "c1"]);
    expect(visibleHeadings(list, () => true).map((x) => x.id)).toEqual(["t", "a", "b", "c"]);
    expect(visibleHeadings(list, () => false)).toHaveLength(list.length);
    expect(editorPanelLayoutsHr.foldChapter("Uvod")).toContain("Uvod");
  });

  it("the dot and the open tasks follow what the chapter sheet writes, without a reload", async () => {
    const el = await mount(createElement(ChapterMarks, { workId: "rad-1", headingId: "h1", words: 50 }));
    const dot = () => el.querySelector("[data-state]");
    expect(dot()?.getAttribute("data-state")).toBe("working");
    expect(dot()?.getAttribute("aria-label")).toBe(leftHr.chapter.stateOf(leftHr.chapter.states.working));
    expect(el.textContent).not.toContain(leftHr.chapter.toFix(1));

    await act(async () => {
      localStorage.setItem(storageKey("states", "rad-1"), JSON.stringify({ h1: "done" }));
      announceDeviceChange(storageKey("states", "rad-1"));
      localStorage.setItem(notesKey("rad-1"), JSON.stringify({ todos: { h1: [{ id: "t1", text: "izvor", done: false }, { id: "t2", text: "x", done: true }] } }));
      announceDeviceChange(notesKey("rad-1"));
    });
    expect(dot()?.getAttribute("data-state")).toBe("done");
    expect(el.textContent).toContain(leftHr.chapter.toFix(1));
  });

  it("another work's change leaves the row as it is", async () => {
    const el = await mount(createElement(ChapterMarks, { workId: "rad-1", headingId: "h1", words: 0 }));
    await act(async () => {
      localStorage.setItem(storageKey("states", "rad-2"), JSON.stringify({ h1: "done" }));
      announceDeviceChange(storageKey("states", "rad-2"));
    });
    expect(el.querySelector("[data-state]")?.getAttribute("data-state")).toBe("draft");
  });
});
