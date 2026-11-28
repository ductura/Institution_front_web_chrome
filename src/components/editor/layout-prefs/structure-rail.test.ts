// @vitest-environment node
import { Editor } from "@tiptap/core";
import { describe, expect, it, vi } from "vitest";

import { createEditorExtensionsV2 } from "@/editor";

import { paletteActions } from "../commands/palette";
import { shortcutGroups } from "../commands/shortcuts";
import { requestStructureRail, STRUCTURE_RAIL_EVENT, togglesRail } from "./structure-rail";

/** ED-112: Ctrl+\ and the palette's "Struktura rada" show or hide the structure (prototype ACT.railToggle). */

const key = (event: Partial<KeyboardEvent>) => ({
  ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, defaultPrevented: false, isComposing: false, repeat: false,
  key: "", code: "",
  ...event,
});

describe("structure rail keys", () => {
  it("Ctrl+\\ and Cmd+\\ show or hide it", () => {
    expect(togglesRail(key({ key: "\\", code: "Backslash", ctrlKey: true }), false)).toBe(true);
    expect(togglesRail(key({ key: "\\", code: "Backslash", metaKey: true }), false)).toBe(true);
  });

  it("a Croatian keyboard reaches it both by AltGr+Q and by the key where \\ is on an English one", () => {
    // AltGr+Q types "\" and the browser reports Ctrl and Alt held.
    expect(togglesRail(key({ key: "\\", code: "KeyQ", ctrlKey: true, altKey: true }), false)).toBe(true);
    // The key right of the brackets types "ž" on a Croatian keyboard.
    expect(togglesRail(key({ key: "ž", code: "Backslash", ctrlKey: true }), false)).toBe(true);
    expect(togglesRail(key({ key: "ž", code: "Backslash", ctrlKey: true, altKey: true }), false)).toBe(false);
  });

  it("an open dialog, a taken key, composing, a held key and other chords are left alone", () => {
    const chord = key({ key: "\\", code: "Backslash", ctrlKey: true });
    expect(togglesRail(chord, true)).toBe(false);
    expect(togglesRail({ ...chord, defaultPrevented: true }, false)).toBe(false);
    expect(togglesRail({ ...chord, isComposing: true }, false)).toBe(false);
    expect(togglesRail({ ...chord, repeat: true }, false)).toBe(false);
    expect(togglesRail({ ...chord, shiftKey: true }, false)).toBe(false);
    expect(togglesRail(key({ key: "\\", code: "Backslash" }), false)).toBe(false);
    expect(togglesRail(key({ key: "q", code: "KeyQ", ctrlKey: true }), false)).toBe(false);
  });
});

describe("structure rail from the palette", () => {
  it("sends the request the layout listens for", () => {
    const target = new EventTarget();
    const heard = vi.fn();
    target.addEventListener(STRUCTURE_RAIL_EVENT, heard);
    requestStructureRail(target);
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("is enabled in the palette, also for a locked work, and listed with its keys", () => {
    const editor = new Editor({ element: null, extensions: createEditorExtensionsV2(), editable: false,
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Izmišljen tekst." }] }] } });
    const outline = paletteActions(editor as never, () => {}).find((action) => action.id === "outline");
    expect(outline?.disabled).toBe(false);
    expect(outline?.hint).toBe("Ctrl+\\");
    expect(shortcutGroups(false).flatMap(({ items }) => items.map((item) => item.keys))).toContain("Ctrl+\\");
    editor.destroy();
  });
});
