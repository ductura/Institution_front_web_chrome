// @vitest-environment jsdom
// ED-70: "Prilagodi panel" orders and hides the left parts and chooses how subchapters fold.
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { activeChapterOf, foldedBySubs, LeftPanel, visibleParts } from "@/components/editor/layout-prefs/LeftPanel";
import { PanelSettings } from "@/components/editor/layout-prefs/PanelSettings";
import { DEFAULT_PREFERENCES, type LayoutPreferences } from "@/components/editor/layout-prefs/preferences";
import { editorPanelLayoutsHr as t } from "@/lib/i18n/messages.hr";

vi.mock("@/components/editor/LocalDocument", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useLocalEditor: () => null,
}));

HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute("open", ""); };
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement | null = null;
afterEach(() => { host?.remove(); host = null; });

async function mount(node: ReactNode) {
  host = document.createElement("div");
  document.body.append(host);
  await act(async () => { createRoot(host!).render(node); });
  return host;
}

const groups = (el: HTMLElement) => [...el.querySelectorAll("summary")].map((s) => s.textContent);
const byLabel = (el: HTMLElement, label: string) => el.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
const byText = (el: HTMLElement, text: string) => [...el.querySelectorAll("button")].find((b) => b.textContent === text)!;

describe("ED-70: Donji dijelovi", () => {
  it("the left panel keeps Zahtjevi first and Povijest last, the parts between in the person's order", async () => {
    expect(visibleParts({})).toEqual(["figures", "stash", "progress", "deadlines", "thread"]);
    const parts = { order: ["thread", "figures", "stash", "progress", "deadlines"] as const, hideParts: ["stash" as const] };
    expect(visibleParts({ ...parts, order: [...parts.order] })).toEqual(["thread", "figures", "progress", "deadlines"]);
    const el = await mount(createElement(LeftPanel, {
      layout: "a", settings: null, onJump: () => undefined, parts: { ...parts, order: [...parts.order] },
      sections: { history: createElement("p", null, "povijest") },
    }));
    const s = t.leftSections;
    expect(groups(el)).toEqual([s.requirements, s.thread, s.figures, s.progress, s.deadlines, s.history]);
  });

  it("Prilagodi panel moves a part with its arrows, disabled at the ends, and hides it with its box", async () => {
    let value: LayoutPreferences["left"] = DEFAULT_PREFERENCES.left;
    const onChange = vi.fn((next: LayoutPreferences["left"]) => { value = next; });
    const el = await mount(createElement(PanelSettings, { side: "left", value, onChange }));
    await act(async () => { byText(el, t.customize.left).click(); });
    expect([...el.querySelectorAll("legend")].map((l) => l.textContent)).toEqual(expect.arrayContaining([t.subchapters, t.parts]));
    expect(byLabel(el, t.moveUp(t.leftSections.figures)).disabled).toBe(true);
    expect(byLabel(el, t.moveDown(t.leftSections.thread)).disabled).toBe(true);
    await act(async () => { byLabel(el, t.moveDown(t.leftSections.figures)).click(); });
    expect(value.order).toEqual(["stash", "figures", "progress", "deadlines", "thread"]);
    const box = [...el.querySelectorAll("label")].find((l) => l.textContent === t.leftSections.deadlines)?.querySelector("input");
    await act(async () => { box!.click(); });
    expect(value).toEqual({ layout: "a", mobile: "c", hideParts: ["deadlines"] });
    await act(async () => { byText(el, t.subModes.active).click(); });
    expect(value).toEqual({ layout: "a", mobile: "c", subs: "active" });
  });

  it("the right panel's settings have no left parts", async () => {
    const el = await mount(createElement(PanelSettings, { side: "right", value: DEFAULT_PREFERENCES.right, onChange: () => undefined }));
    await act(async () => { byLabel(el, t.customize.right).click(); });
    expect(el.textContent).not.toContain(t.parts);
    expect(el.textContent).not.toContain(t.subModes.active);
  });
});

describe("ED-70: Potpoglavlja", () => {
  const h = (id: string, level: number, pos: number) => ({ id, level, pos });
  const list = [h("a", 2, 0), h("a1", 3, 10), h("b", 2, 20), h("b1", 3, 30)];

  it("Rasklopljena folds none, Sklopljena all, Samo u aktivnom all but the chapter being written", () => {
    const active = activeChapterOf(list, list[3]);
    expect(active?.id).toBe("b");
    expect(activeChapterOf(list, undefined)).toBeUndefined();
    expect(list.filter((x) => foldedBySubs(undefined, x, active))).toEqual([]);
    expect(list.filter((x) => x.level === 2 && foldedBySubs("closed", x, active)).map((x) => x.id)).toEqual(["a", "b"]);
    expect(list.filter((x) => x.level === 2 && foldedBySubs("active", x, active)).map((x) => x.id)).toEqual(["a"]);
  });

  it("the texts are the prototype's", () => {
    expect(t.subModes).toEqual({ open: "Rasklopljena", closed: "Sklopljena", active: "Samo u aktivnom" });
    expect(t.parts).toBe("Donji dijelovi");
    expect(t.moveUp("Rokovi")).toBe("Pomakni gore: Rokovi");
    expect(`${t.moveDown("Rokovi")}${JSON.stringify(t.subModes)}`).not.toContain("·");
  });
});
