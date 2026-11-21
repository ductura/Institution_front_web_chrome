// @vitest-environment node
import { Editor } from "@tiptap/core";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_SHORTCUT_GROUPS } from "@ductura/ui";
import { createEditorExtensionsV2 } from "@/editor";

import { paletteActions } from "../commands/palette";
import { shortcutGroups } from "../commands/shortcuts";
import { FOCUS_MODE_EVENT, requestFocusMode, togglesFocus } from "./focus-mode";

/** WEB-1605 part 3: focus mode on with Ctrl+. or the palette, off with Ctrl+. or Esc (criterion 3). */

const key = (event: Partial<KeyboardEvent>) => ({
  ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, defaultPrevented: false, isComposing: false, repeat: false, key: "",
  ...event,
});

describe("focus mode keys", () => {
  it("Ctrl+. and Cmd+. turn it on and off", () => {
    expect(togglesFocus(key({ key: ".", ctrlKey: true }), false, false)).toBe(true);
    expect(togglesFocus(key({ key: ".", metaKey: true }), true, false)).toBe(true);
  });

  it("Esc gives the panels back, and does nothing outside focus mode", () => {
    expect(togglesFocus(key({ key: "Escape" }), true, false)).toBe(true);
    expect(togglesFocus(key({ key: "Escape" }), false, false)).toBe(false);
  });

  it("an open dialog, a taken key, composing and other chords are left alone", () => {
    const chord = key({ key: ".", ctrlKey: true });
    expect(togglesFocus(key({ key: "Escape" }), true, true)).toBe(false);
    expect(togglesFocus({ ...chord, defaultPrevented: true }, false, false)).toBe(false);
    expect(togglesFocus({ ...chord, isComposing: true }, false, false)).toBe(false);
    expect(togglesFocus({ ...chord, repeat: true }, false, false)).toBe(false);
    expect(togglesFocus({ ...chord, shiftKey: true }, false, false)).toBe(false);
    expect(togglesFocus({ ...chord, altKey: true }, false, false)).toBe(false);
    expect(togglesFocus(key({ key: "." }), false, false)).toBe(false);
  });
});

describe("focus mode from the palette", () => {
  it("the palette action sends the request the layout listens for", () => {
    const target = new EventTarget();
    const heard = vi.fn();
    target.addEventListener(FOCUS_MODE_EVENT, heard);
    requestFocusMode(target);
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("is enabled in the palette and listed with its keys, also for a locked work", () => {
    const editor = new Editor({ element: null, extensions: createEditorExtensionsV2(), editable: false,
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Izmišljen tekst." }] }] } });
    const focus = paletteActions(editor as never, () => {}).find((action) => action.id === "focus");
    expect(focus?.disabled).toBe(false);
    expect(DEFAULT_SHORTCUT_GROUPS.flatMap(({ items }) => items).some(({ keys }) => keys === "Ctrl+.")).toBe(true);
    expect(shortcutGroups(false).flatMap(({ items }) => items.map((item) => item.keys))).toContain("Ctrl+.");
  });
});
