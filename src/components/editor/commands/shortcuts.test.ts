import { describe, expect, it } from "vitest";

import { editorShortcut, shortcutGroups } from "./shortcuts";

const key = (event: Partial<KeyboardEvent>) => editorShortcut(event as KeyboardEvent);

describe("editor shortcuts", () => {
  it("opens the palette and the list on both platforms", () => {
    expect(key({ key: "k", ctrlKey: true })).toBe("palette");
    expect(key({ key: "K", metaKey: true })).toBe("palette");
    expect(key({ key: "/", metaKey: true })).toBe("shortcuts");
    expect(key({ key: "f", ctrlKey: true })).toBe("find");
    expect(key({ key: "F10", altKey: true })).toBe("toolbar");
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
});
