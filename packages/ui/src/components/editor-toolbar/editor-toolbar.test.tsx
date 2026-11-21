// @vitest-environment jsdom
import axe from "axe-core";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorOutline } from "./EditorOutline";
import { EditorProgress } from "./EditorProgress";
import { EditorToolbar, type EditorToolbarGroup } from "./EditorToolbar";
import { bodyWordCount, progressOf, rangeText } from "./editor-toolbar-logic";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;
const mount = (node: React.ReactNode) => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root!.render(node));
  return host;
};
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; });
const key = (target: Element, k: string) => act(() => { target.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })); });
const violations = async (el: Element) => (await axe.run(el, { rules: { region: { enabled: false }, "color-contrast": { enabled: false } } })).violations.map((v) => v.id);

const groups = (spy = vi.fn()): EditorToolbarGroup[] => [
  { id: "history", label: "Povijest izmjena", actions: [
    { id: "undo", label: "Poništi", icon: "undo", onSelect: spy, shortcut: "Control+Z" },
    { id: "redo", label: "Ponovi", icon: "redo", onSelect: () => undefined },
  ] },
  { id: "text", label: "Tekst", actions: [{ id: "bold", label: "Podebljano", icon: "bold", pressed: true, onSelect: () => undefined }] },
];

describe("EditorToolbar", () => {
  it("is a named toolbar with one tab stop, named buttons and no axe violations", async () => {
    const el = mount(<EditorToolbar groups={groups()} />);
    const bar = el.querySelector('[role="toolbar"]')!;
    expect(bar.getAttribute("aria-label")).toBe("Alati za oblikovanje");
    const buttons = [...bar.querySelectorAll("button")];
    expect(buttons.map((b) => b.tabIndex)).toEqual([0, -1, -1]);
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual(["Poništi", "Ponovi", "Podebljano"]);
    expect(buttons[2]!.getAttribute("aria-pressed")).toBe("true");
    expect(buttons[0]!.getAttribute("aria-keyshortcuts")).toBe("Control+Z");
    expect(await violations(el)).toEqual([]);
  });

  it("moves across groups with the arrows, Home and End, and selects", () => {
    const spy = vi.fn();
    const el = mount(<EditorToolbar groups={groups(spy)} />);
    const bar = el.querySelector('[role="toolbar"]')!;
    const buttons = el.querySelectorAll("button");
    buttons[0]!.focus();
    key(bar, "ArrowRight"); expect(document.activeElement).toBe(buttons[1]);
    key(bar, "ArrowRight"); expect(document.activeElement).toBe(buttons[2]);
    key(bar, "ArrowRight"); expect(document.activeElement).toBe(buttons[0]);
    key(bar, "End"); expect(document.activeElement).toBe(buttons[2]);
    key(bar, "Home"); expect(document.activeElement).toBe(buttons[0]);
    act(() => buttons[0]!.click());
    expect(spy).toHaveBeenCalledOnce();
  });

  it("keeps the narrow-width rule: words are hidden, not removed, and a secondary group is marked", () => {
    const el = mount(<EditorToolbar groups={[{ ...groups()[0]!, secondary: true }]} />);
    expect(el.querySelector("[data-secondary]")).not.toBeNull();
    expect(el.querySelector("button")!.textContent).toBe("Poništi");
  });
});

describe("EditorToolbar with disabled buttons", () => {
  const withDisabled = (): EditorToolbarGroup[] => [
    { id: "h", label: "Povijest izmjena", actions: [
      { id: "undo", label: "Poništi", icon: "undo", disabled: true, onSelect: () => undefined },
      { id: "redo", label: "Ponovi", icon: "redo", onSelect: () => undefined },
      { id: "x", label: "Kurziv", icon: "italic", disabled: true, onSelect: () => undefined },
      { id: "bold", label: "Podebljano", icon: "bold", onSelect: () => undefined },
    ] },
  ];
  it("puts the tab stop on the first enabled button and arrows skip disabled ones", () => {
    const el = mount(<EditorToolbar groups={withDisabled()} />);
    const buttons = el.querySelectorAll("button");
    expect([...buttons].map((b) => b.tabIndex)).toEqual([-1, 0, -1, -1]);
    buttons[1]!.focus();
    key(el.querySelector('[role="toolbar"]')!, "ArrowRight");
    expect(document.activeElement).toBe(buttons[3]);
    key(el.querySelector('[role="toolbar"]')!, "ArrowRight");
    expect(document.activeElement).toBe(buttons[1]);
  });
});

describe("EditorOutline", () => {
  it("lists headings, marks the current one and reports the click", async () => {
    const spy = vi.fn();
    const el = mount(<EditorOutline currentId="b" onSelect={spy} entries={[
      { id: "a", number: "1", title: "Uvod", level: 1 }, { id: "b", number: "1.1", title: "", level: 2 },
    ]} />);
    const links = el.querySelectorAll("button");
    expect(links[1]!.getAttribute("aria-current")).toBe("location");
    expect(links[1]!.textContent).toContain("Bez naslova");
    act(() => links[0]!.click());
    expect(spy).toHaveBeenCalledWith("a");
    expect(await violations(el)).toEqual([]);
  });
  it("says so when there are no headings", () => {
    expect(mount(<EditorOutline entries={[]} onSelect={() => undefined} />).textContent).toBe("Nema naslova.");
  });
});

describe("EditorProgress", () => {
  it("shows words against the range, with a named progressbar", async () => {
    const el = mount(<EditorProgress words={210} range={{ min: 2000, max: 2500 }} />);
    expect(el.textContent).toContain("210 / 2 000–2 500 riječi");
    expect(el.textContent).toContain("Ispod opsega");
    const bar = el.querySelector('[role="progressbar"]')!;
    expect(bar.getAttribute("aria-valuenow")).toBe("210");
    expect(bar.getAttribute("aria-valuemax")).toBe("2000");
    expect(await violations(el)).toEqual([]);
  });
  it("without a range shows the count and no bar", () => {
    const el = mount(<EditorProgress words={12} range={null} />);
    expect(el.querySelector('[role="progressbar"]')).toBeNull();
    expect(el.textContent).toContain("12 riječi");
  });
});

describe("progress logic", () => {
  it("counts body words and leaves footnotes out", () => {
    expect(bodyWordCount([
      { kind: "paragraph", text: "Izmišljeni vrt raste." }, { kind: "footnote", text: "Izmišljena fusnota uz vrt" },
      { kind: "heading", text: "  Uvod " }, { kind: "paragraph", text: "" },
    ])).toBe(4);
  });
  it("classifies against the range", () => {
    expect(progressOf(100, { min: 200, max: 300 })).toMatchObject({ status: "below", fraction: 0.5 });
    expect(progressOf(250, { min: 200, max: 300 }).status).toBe("within");
    expect(progressOf(301, { min: 200, max: 300 })).toMatchObject({ status: "above", fraction: 1 });
    expect(progressOf(50, { min: null, max: 100 })).toMatchObject({ status: "within", fraction: 0.5, target: 100 });
    expect(progressOf(5, null).status).toBe("noRange");
    expect(progressOf(-3, null).words).toBe(0);
  });
  it("formats the range", () => {
    expect(rangeText({ min: 2000, max: 2500 })).toBe("2 000–2 500");
    expect(rangeText({ min: 2000, max: null })).toBe("od 2 000");
    expect(rangeText({ min: null, max: 800 })).toBe("do 800");
    expect(rangeText(null)).toBe("");
  });
});
