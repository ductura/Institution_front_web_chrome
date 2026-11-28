import { describe, expect, it } from "vitest";

import { ariaKeyShortcuts, displayKeys, SHORTCUTS, shortcutListGroups } from "./shortcut-definitions";

describe("editor shortcut definitions (WEB-1908)", () => {
  it("has unique command ids", () => {
    expect(new Set(SHORTCUTS.map((s) => s.id)).size).toBe(SHORTCUTS.length);
  });
  it("shows Ctrl on PC and Cmd on a Mac, with the Mac exception for redo", () => {
    const bold = SHORTCUTS.find((s) => s.id === "bold")!;
    const redo = SHORTCUTS.find((s) => s.id === "redo")!;
    expect(displayKeys(bold)).toBe("Ctrl+B");
    expect(displayKeys(bold, true)).toBe("Cmd+B");
    expect(displayKeys(redo)).toBe("Ctrl+Y");
    expect(displayKeys(redo, true)).toBe("Cmd+Shift+Z");
  });
  it("omits writing shortcuts for a locked work but keeps moving and view", () => {
    const ids = (editable: boolean) => shortcutListGroups(editable).flatMap((g) => g.items.map((i) => i.id));
    expect(ids(true)).toContain("bold");
    expect(ids(false)).not.toContain("bold");
    expect(ids(false)).toEqual(expect.arrayContaining(["palette", "find", "shortcuts", "close"]));
  });
  it("lists the shortcut list itself, reachable by keyboard", () => {
    expect(shortcutListGroups(false).flatMap((g) => g.items).find((i) => i.id === "shortcuts")?.keys).toContain("Ctrl+/");
  });
  it("gives aria-keyshortcuts from the same definition", () => {
    expect(ariaKeyShortcuts("undo")).toBe("Control+Z");
    expect(ariaKeyShortcuts("undo", true)).toBe("Meta+Z");
    expect(ariaKeyShortcuts("shortcuts")).toBe("Control+/");
    expect(ariaKeyShortcuts("nope")).toBeUndefined();
  });
  it("lists no key the editor does not answer yet: comment waits for its action, the numbered list for the v4 document (ED-03)", () => {
    // The keys of the prototype stay in toolbar-keys.ts; the list names them again once a handler is mounted.
    const all = [...shortcutListGroups(true), ...shortcutListGroups(false)].flatMap((g) => g.items);
    for (const id of ["comment", "numberedList"]) expect(all.find((i) => i.id === id)).toBeUndefined();
    expect(all.map((i) => i.keys)).not.toEqual(expect.arrayContaining(["Ctrl+Alt+M"]));
  });
  it("lists the outline key once the structure rail answers it, also for a locked work (ED-112)", () => {
    const outline = (editable: boolean) => shortcutListGroups(editable).flatMap((g) => g.items).find((i) => i.id === "outline");
    expect(outline(true)?.keys).toBe("Ctrl+\\");
    expect(outline(false)?.keys).toBe("Ctrl+\\");
    expect(shortcutListGroups(true, true).flatMap((g) => g.items).find((i) => i.id === "outline")?.keys).toBe("Cmd+\\");
    expect(ariaKeyShortcuts("outline")).toBe("Control+\\");
  });
  it("lists the sentence and chapter moves (ED-33) only while the work can be written", () => {
    const keysOf = (editable: boolean) => shortcutListGroups(editable).flatMap((g) => g.items).map((i) => i.keys);
    expect(keysOf(true)).toEqual(expect.arrayContaining(["Alt+↑ ili Alt+↓", "Alt+Shift+↑ ili Alt+Shift+↓"]));
    expect(keysOf(false)).not.toContain("Alt+↑ ili Alt+↓");
    expect(keysOf(false)).not.toContain("Alt+Shift+↑ ili Alt+Shift+↓");
  });
});