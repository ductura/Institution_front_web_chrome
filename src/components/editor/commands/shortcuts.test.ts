import { describe, expect, it } from "vitest";

import { requestShortcutList, SHORTCUT_LIST_EVENT, shortcutListGroups } from "./shortcut-definitions";
import { editorShortcut, shortcutGroups } from "./shortcuts";

const key = (event: Partial<KeyboardEvent>) => editorShortcut(event as KeyboardEvent);

describe("editor shortcuts", () => {
  it("opens the palette and the list on both platforms", () => {
    expect(key({ key: "k", ctrlKey: true })).toBe("palette");
    expect(key({ key: "K", metaKey: true })).toBe("palette");
    expect(key({ key: "/", metaKey: true })).toBe("shortcuts");
    expect(key({ key: "F10", altKey: true })).toBe("toolbar");
  });

  it("opens find and replace with Ctrl+F, also for a locked work", () => {
    expect(key({ key: "f", ctrlKey: true })).toBe("find");
    expect(key({ key: "F", metaKey: true })).toBe("find");
    expect(key({ key: "f", ctrlKey: true, shiftKey: true })).toBeNull();
    expect(shortcutGroups(false).flatMap(({ items }) => items.map((item) => item.keys))).toContain("Ctrl+F");
  });

  it("leaves composing, taken and different chords to their owner", () => {
    const chord = { key: "k", ctrlKey: true };
    expect(key({ ...chord, isComposing: true })).toBeNull();
    expect(key({ ...chord, defaultPrevented: true })).toBeNull();
    expect(key({ ...chord, shiftKey: true })).toBeNull();
    expect(key({ ...chord, altKey: true })).toBeNull();
    expect(key({ ...chord, repeat: true })).toBeNull();
  });

  it("omits writing keys for a locked work", () => {
    const keys = (editable: boolean) => shortcutGroups(editable).flatMap(({ items }) => items.map((item) => item.keys));
    expect(keys(true)).toContain("Ctrl+B");
    expect(keys(false)).not.toContain("Ctrl+B");
    expect(keys(false)).toContain("Ctrl+K");
  });

  it("draws the same list as the host: one definition, the same groups and rows (ED-03)", () => {
    for (const editable of [true, false]) {
      expect(shortcutGroups(editable)).toEqual(shortcutListGroups(editable).map(({ title, items }) =>
        ({ title, items: items.map(({ label, keys }) => ({ label, keys })) })));
    }
    expect(shortcutGroups(true).map(({ title }) => title)).toEqual(["Pisanje", "Kretanje i uređivanje", "Prikaz"]);
  });

  it("asks the page's one list to open, and says whether a host took it (ED-03)", () => {
    const page = new EventTarget();
    expect(requestShortcutList(page)).toBe(false);
    page.addEventListener(SHORTCUT_LIST_EVENT, (event) => event.preventDefault());
    expect(requestShortcutList(page)).toBe(true);
  });
});