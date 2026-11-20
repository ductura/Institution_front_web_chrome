import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ContextMenu } from "./ContextMenu";
import { enabledIndexes, isMenuKey, menuFocusTarget, menuOpensFor, placeMenu, type MenuEntry } from "./menu-logic";

const entries: MenuEntry[] = [
  { kind: "heading", label: "Označeni tekst" },
  { kind: "item", id: "comment", label: "Komentar", hint: "Ctrl+Alt+M" },
  { kind: "item", id: "cut", label: "Izreži", disabled: true },
  { kind: "item", id: "copy", label: "Kopiraj", hint: "Ctrl+C" },
];

describe("context menu rules (UI-6C)", () => {
  it("lists only enabled items as focusable", () => {
    expect(enabledIndexes(entries)).toEqual([1, 3]);
  });

  it("moves with the arrows over enabled items, wrapping, and jumps with Home and End", () => {
    expect(menuFocusTarget(entries, 1, "ArrowDown")).toBe(3);
    expect(menuFocusTarget(entries, 3, "ArrowDown")).toBe(1);
    expect(menuFocusTarget(entries, 1, "ArrowUp")).toBe(3);
    expect(menuFocusTarget(entries, -1, "ArrowDown")).toBe(1);
    expect(menuFocusTarget(entries, -1, "ArrowUp")).toBe(3);
    expect(menuFocusTarget(entries, 3, "Home")).toBe(1);
    expect(menuFocusTarget(entries, 1, "End")).toBe(3);
    expect(menuFocusTarget(entries, 1, "a")).toBeNull();
  });

  it("has nowhere to go when everything is disabled", () => {
    expect(menuFocusTarget([{ kind: "item", id: "x", label: "X", disabled: true }], -1, "ArrowDown")).toBeNull();
  });

  it("opens for the mouse and the keyboard, not for Shift+right click or touch", () => {
    expect(menuOpensFor({ shiftKey: false, pointerType: "mouse" }, false)).toBe(true);
    expect(menuOpensFor({ shiftKey: true, pointerType: "mouse" }, false)).toBe(false);
    expect(menuOpensFor({ shiftKey: false, pointerType: "touch" }, false)).toBe(false);
    expect(menuOpensFor({ shiftKey: true }, true)).toBe(true);
  });

  it("recognises Shift+F10 and the menu key", () => {
    expect(isMenuKey({ key: "F10", shiftKey: true })).toBe(true);
    expect(isMenuKey({ key: "F10", shiftKey: false })).toBe(false);
    expect(isMenuKey({ key: "ContextMenu", shiftKey: false })).toBe(true);
  });

  it("keeps the menu on screen: flips at the edges and clamps", () => {
    const view = { width: 800, height: 600 };
    const size = { width: 220, height: 300 };
    expect(placeMenu({ x: 100, y: 100 }, size, view)).toEqual({ x: 100, y: 100 });
    expect(placeMenu({ x: 700, y: 500 }, size, view)).toEqual({ x: 480, y: 200 });
    expect(placeMenu({ x: 10, y: 10 }, { width: 900, height: 700 }, view)).toEqual({ x: 8, y: 8 });
  });
});

describe("ContextMenu markup", () => {
  const render = (anchor: { x: number; y: number } | null) =>
    renderToStaticMarkup(<ContextMenu anchor={anchor} entries={entries} label="Izbornik" onSelect={() => undefined} onClose={() => undefined} />);

  it("renders nothing while closed", () => {
    expect(render(null)).toBe("");
  });

  it("is a named menu; a disabled item is shown with aria-disabled and the hint beside the label", () => {
    const html = render({ x: 10, y: 20 });
    expect(html).toContain('role="menu"');
    expect(html).toContain('aria-label="Izbornik"');
    expect(html.match(/role="menuitem"/g)).toHaveLength(3);
    expect(html).toMatch(/aria-disabled="true"[^>]*><span>Izreži/);
    expect(html).toContain("Ctrl+C");
  });
});
