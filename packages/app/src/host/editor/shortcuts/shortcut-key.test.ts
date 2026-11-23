import { describe, expect, it } from "vitest";

import { opensEditorShortcutList, type ListKeyEvent } from "./shortcut-key";

const base = { ctrlKey: false, metaKey: false, altKey: false, isComposing: false, defaultPrevented: false };
const on = (tagName: string, extra: Partial<ListKeyEvent> = {}, isContentEditable = false) =>
  opensEditorShortcutList({ ...base, key: "?", target: { tagName, isContentEditable } as unknown as EventTarget, ...extra });

describe("the key that opens the editor's shortcut list (PIL-D8-PRECACI)", () => {
  it("opens on ? outside a text field", () => {
    expect(on("BODY")).toBe(true);
    expect(on("BUTTON")).toBe(true);
    // Pressed again inside the open list it toggles it shut.
    expect(on("DIALOG")).toBe(true);
  });
  it("does not open on ? typed in the text, an input, a textarea or a select", () => {
    expect(on("DIV", {}, true)).toBe(false);
    expect(on("P", {}, true)).toBe(false);
    expect(on("INPUT")).toBe(false);
    expect(on("textarea")).toBe(false);
    expect(on("SELECT")).toBe(false);
  });
  it("leaves Ctrl/Cmd+/ to the editor commands, so one key never opens two lists", () => {
    expect(on("BODY", { key: "/", ctrlKey: true })).toBe(false);
    expect(on("BODY", { key: "/", metaKey: true })).toBe(false);
  });
  it("ignores other keys, composing, a taken key and Alt", () => {
    expect(on("BODY", { key: "/" })).toBe(false);
    expect(on("BODY", { isComposing: true })).toBe(false);
    expect(on("BODY", { defaultPrevented: true })).toBe(false);
    expect(on("BODY", { altKey: true })).toBe(false);
  });
});
