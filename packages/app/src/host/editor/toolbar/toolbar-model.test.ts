import { describe, expect, it, vi } from "vitest";

import { currentHeadingId, outlineEntries, progressWords, toolbarGroups, type ToolbarCommands, type ToolbarState } from "./toolbar-model";

const state: ToolbarState = { canUndo: true, canRedo: false, block: "heading2", bold: true, italic: false, bulletList: false, numberedList: false, quote: false, editable: true };
const run = (): ToolbarCommands => ({
  undo: vi.fn(), redo: vi.fn(), setBlock: vi.fn(), toggleBold: vi.fn(), toggleItalic: vi.fn(), toggleBulletList: vi.fn(), toggleNumberedList: vi.fn(), toggleQuote: vi.fn(),
});

describe("toolbarGroups", () => {
  it("carries every action of E§3.6 with names, in toolbar order", () => {
    const ids = toolbarGroups(state, run()).flatMap((g) => g.actions.map((a) => a.id));
    expect(ids).toEqual(["undo", "redo", "paragraph", "heading1", "heading2", "heading3", "bold", "italic", "bulletList", "numberedList", "quote"]);
  });
  it("follows the selection: pressed, and undo/redo only when there is something to undo", () => {
    const all = toolbarGroups(state, run()).flatMap((g) => g.actions);
    const get = (id: string) => all.find((a) => a.id === id)!;
    expect(get("heading2").pressed).toBe(true);
    expect(get("paragraph").pressed).toBe(false);
    expect(get("bold").pressed).toBe(true);
    expect(get("undo").disabled).toBe(false);
    expect(get("redo").disabled).toBe(true);
  });
  it("is fully disabled while the work is not editable", () => {
    const all = toolbarGroups({ ...state, editable: false }, run()).flatMap((g) => g.actions);
    expect(all.every((a) => a.disabled)).toBe(true);
  });
  it("calls the editor command of the button", () => {
    const commands = run();
    const all = toolbarGroups(state, commands).flatMap((g) => g.actions);
    all.find((a) => a.id === "heading3")!.onSelect();
    all.find((a) => a.id === "quote")!.onSelect();
    expect(commands.setBlock).toHaveBeenCalledWith("heading3");
    expect(commands.toggleQuote).toHaveBeenCalledOnce();
  });
});

describe("outline", () => {
  it("numbers headings by level and resets the deeper counters", () => {
    const entries = outlineEntries([
      { id: "a", level: 1, title: "Uvod" }, { id: "b", level: 2, title: "Cilj" }, { id: "c", level: 2, title: "Metoda" },
      { id: "d", level: 3, title: "Uzorak" }, { id: "e", level: 1, title: "Rasprava" }, { id: "f", level: 2, title: "Prvo" },
    ]);
    expect(entries.map((e) => e.number)).toEqual(["1", "1.1", "1.2", "1.2.1", "2", "2.1"]);
  });
  it("finds the heading that holds the cursor", () => {
    const heads = [{ id: "a", pos: 0 }, { id: "b", pos: 50 }];
    expect(currentHeadingId(heads, 10)).toBe("a");
    expect(currentHeadingId(heads, 50)).toBe("b");
    expect(currentHeadingId(heads, -1)).toBeNull();
  });
});

describe("progressWords", () => {
  it("counts the body without footnotes", () => {
    expect(progressWords([{ kind: "paragraph", text: "jedan dva tri" }, { kind: "footnote", text: "a b c d" }])).toBe(3);
  });
});
