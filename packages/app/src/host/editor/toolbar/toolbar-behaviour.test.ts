import { describe, expect, it, vi } from "vitest";
import type { EditorToolbarGroup } from "@ductura/ui";

import { contextButton, placeFromFlags } from "./context-button";
import { textMenuEntries } from "./context-menu-model";
import { keyboardInset, MOBILE_MORE, QUICK_TOOLS, quickBarVisible } from "./quick-tools";
import { canStep, loadZoom, saveZoom, snapZoom, stepZoom, TEXT_ZOOMS, zoomToast, ZOOM_KEY } from "./text-size";
import { displayShortcut, showDelay, TOOL_DESCRIPTIONS, tipPlace, toolTip } from "./tool-tip";
import { keyAction } from "./toolbar-keys";
import { toolbarGroups, type ToolbarCommands, type ToolbarState } from "./toolbar-model";
import { arrangeToolbar, arrangedIds, customisableIds, loadPrefs, moveTool, PREFS_KEY, resetPrefs, sanitizePrefs, savePrefs, setLook, toggleTool } from "./toolbar-prefs";

const state: ToolbarState = { canUndo: true, canRedo: true, block: "paragraph", bold: false, italic: false, bulletList: false, numberedList: false, quote: false, editable: true };
const noop = () => undefined;
const run: ToolbarCommands = { undo: noop, redo: noop, setBlock: noop, toggleBold: noop, toggleItalic: noop, toggleBulletList: noop, toggleNumberedList: noop, toggleQuote: noop };
const groups: EditorToolbarGroup[] = toolbarGroups(state, run);
const key = (over: Partial<Parameters<typeof keyAction>[0]>) => keyAction({ key: "", altKey: false, shiftKey: false, ctrlKey: false, metaKey: false, ...over });

describe("toolbar preferences (S.tb)", () => {
  it("arranges only the tools outside the paragraph style, in toolbar order", () => {
    expect(customisableIds(groups)).toEqual(["undo", "redo", "bold", "italic", "bulletList", "numberedList", "quote"]);
  });
  it("keeps the stored order, drops unknown ids and adds new tools at the end", () => {
    const base = customisableIds(groups);
    expect(arrangedIds(base, { look: "icons", off: [], order: ["quote", "ghost", "bold"] })).toEqual(["quote", "bold", "undo", "redo", "italic", "bulletList", "numberedList"]);
  });
  it("sends tools set to Više, and those that do not fit the width, to the menu, and keeps the paragraph style", () => {
    const out = arrangeToolbar(groups, { look: "icons", off: ["italic"], order: [] }, ["redo"]);
    expect(out.more.map((a) => a.id)).toEqual(["redo", "italic"]);
    expect(out.groups.find((g) => g.id === "block")?.actions).toHaveLength(4);
    expect(out.groups.flatMap((g) => g.actions.map((a) => a.id))).not.toContain("italic");
  });
  it("drops a group whose tools all went to Više", () => {
    const out = arrangeToolbar(groups, { look: "icons", off: ["bold", "italic"], order: [] });
    expect(out.groups.map((g) => g.id)).not.toContain("text");
  });
  it("reorders tools inside their group and leaves the ends alone", () => {
    const base = customisableIds(groups);
    const moved = moveTool(base, sanitizePrefs(null), "italic", -1);
    const out = arrangeToolbar(groups, moved);
    expect(out.groups.find((g) => g.id === "text")?.actions.map((a) => a.id)).toEqual(["italic", "bold"]);
    expect(moveTool(base, sanitizePrefs(null), "undo", -1)).toEqual(sanitizePrefs(null));
    expect(moveTool(base, sanitizePrefs(null), "quote", 1)).toEqual(sanitizePrefs(null));
  });
  it("toggles a tool between the toolbar and Više, sets the look and resets", () => {
    const off = toggleTool(sanitizePrefs(null), "bold");
    expect(off.off).toEqual(["bold"]);
    expect(toggleTool(off, "bold").off).toEqual([]);
    expect(setLook(off, "words").look).toBe("words");
    expect(resetPrefs()).toEqual({ look: "icons", off: [], order: [] });
  });
  it("ignores a stored value that does not fit", () => {
    expect(sanitizePrefs({ look: "huge", off: [1, "bold", "bold"], order: "x" })).toEqual({ look: "icons", off: ["bold"], order: [] });
    expect(sanitizePrefs("x")).toEqual(resetPrefs());
    expect(loadPrefs({ getItem: () => "{not json" })).toEqual(resetPrefs());
  });
  it("saves and reads back; blocked storage does not throw", () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    savePrefs({ look: "both", off: ["quote"], order: ["bold"] }, storage);
    expect(mem.has(PREFS_KEY)).toBe(true);
    expect(loadPrefs(storage)).toEqual({ look: "both", off: ["quote"], order: ["bold"] });
    expect(() => savePrefs(resetPrefs(), { setItem: () => { throw new Error("quota"); } })).not.toThrow();
    expect(loadPrefs({ getItem: () => { throw new Error("blocked"); } })).toEqual(resetPrefs());
  });
});

describe("tool tip", () => {
  it("names the tool, its shortcut and one sentence", () => {
    expect(toolTip("bold", "Podebljano", "Ctrl+B")).toEqual({ name: "Podebljano", shortcut: "Ctrl+B", description: "Podebljava označeni tekst." });
    expect(toolTip("x", "  ")).toBeNull();
    expect(toolTip("unknown", "Nešto")?.description).toBeNull();
  });
  it("describes every tool of the toolbar", () => {
    for (const id of [...customisableIds(groups), "paragraph", "heading1", "heading2", "heading3", "more", "blockStyle"]) expect(TOOL_DESCRIPTIONS[id], id).toBeTruthy();
  });
  it("turns aria-keyshortcuts into the display form", () => {
    expect(displayShortcut("Control+B")).toBe("Ctrl+B");
    expect(displayShortcut("Meta+Z")).toBe("Cmd+Z");
    expect(displayShortcut(undefined)).toBeNull();
  });
  it("waits 380 ms (60 when warm) for a mouse, nothing for the keyboard, 450 ms for a touch", () => {
    expect([showDelay("mouse", false), showDelay("mouse", true), showDelay("keyboard", false), showDelay("touch", false)]).toEqual([380, 60, 0, 450]);
  });
  it("is centred below the button, 8 px away and kept inside the screen", () => {
    expect(tipPlace({ left: 100, width: 40, bottom: 50 }, { width: 100 }, { width: 800 })).toEqual({ left: 70, top: 58 });
    expect(tipPlace({ left: 0, width: 20, bottom: 50 }, { width: 100 }, { width: 800 }).left).toBe(8);
    expect(tipPlace({ left: 790, width: 20, bottom: 50 }, { width: 100 }, { width: 800 }).left).toBe(692);
  });
});

describe("context button", () => {
  it("is hidden for plain text, for the title of the work and for a work that cannot be written in", () => {
    expect(contextButton({ kind: "text" }, true)).toBeNull();
    expect(contextButton({ kind: "heading", level: 1 }, true)).toBeNull();
    expect(contextButton({ kind: "citation" }, false)).toBeNull();
  });
  it("offers what the place has: citation, table, image, heading, quote, list, variant", () => {
    const ids = (p: Parameters<typeof contextButton>[0]) => contextButton(p, true)?.items.map((i) => i.id);
    expect(ids({ kind: "citation" })).toEqual(["citation.open", "citation.remove"]);
    expect(contextButton({ kind: "table" }, true)?.label).toBe("Tablica");
    expect(contextButton({ kind: "image" }, true)?.label).toBe("Slika");
    expect(ids({ kind: "quote" })).toEqual(["quote.back", "quote.cite"]);
    expect(ids({ kind: "list" })).toEqual(["list.leave"]);
    expect(ids({ kind: "variant" })).toEqual(["variant.keep", "variant.ask"]);
  });
  it("marks the level of a heading and gives the move shortcuts", () => {
    const m = contextButton({ kind: "heading", level: 3 }, true)!;
    expect(m.items.find((i) => i.id === "heading.level3")?.checked).toBe(true);
    expect(m.items.find((i) => i.id === "heading.level2")?.checked).toBe(false);
    expect(m.items.find((i) => i.id === "heading.up")?.hint).toBe("Alt+Shift+↑");
  });
  it("takes the most specific place from the flags", () => {
    expect(placeFromFlags({ list: true, quote: true })).toEqual({ kind: "quote" });
    expect(placeFromFlags({ citation: true, headingLevel: 2 })).toEqual({ kind: "citation" });
    expect(placeFromFlags({ headingLevel: 5 })).toEqual({ kind: "heading", level: 3 });
    expect(placeFromFlags({})).toEqual({ kind: "text" });
  });
});

describe("text size", () => {
  it("has five steps from 90 to 150 percent and moves one step, stopping at the ends", () => {
    expect(TEXT_ZOOMS).toEqual([0.9, 1, 1.15, 1.3, 1.5]);
    expect(stepZoom(1, 1)).toBe(1.15);
    expect(stepZoom(1, -1)).toBe(0.9);
    expect(stepZoom(0.9, -1)).toBe(0.9);
    expect(canStep(1.5, 1)).toBe(false);
    expect(canStep(1, 1)).toBe(true);
  });
  it("snaps any value to a step", () => {
    expect(snapZoom(1.2)).toBe(1.15);
    expect(snapZoom("abc")).toBe(1);
    expect(snapZoom(99)).toBe(1.5);
  });
  it("says the size on the screen and that export and print are unchanged", () => {
    expect(zoomToast(1.15)).toBe("Tekst na zaslonu: 115 %. Izvoz i ispis ostaju po pravilima fakulteta.");
  });
  it("keeps the size in this browser", () => {
    const setItem = vi.fn();
    saveZoom(1.3, { setItem });
    expect(setItem).toHaveBeenCalledWith(ZOOM_KEY, "1.3");
    expect(loadZoom({ getItem: () => "1.5" })).toBe(1.5);
    expect(loadZoom({ getItem: () => { throw new Error("blocked"); } })).toBe(1);
  });
});

describe("quick tools on a phone", () => {
  it("shows only at 640 px or less, in a work that can be written in, with the focus in the text and no dialog", () => {
    const base = { width: 600, editable: true, focused: true, dialogOpen: false };
    expect(quickBarVisible(base)).toBe(true);
    expect(quickBarVisible({ ...base, width: 641 })).toBe(false);
    expect(quickBarVisible({ ...base, editable: false })).toBe(false);
    expect(quickBarVisible({ ...base, focused: false })).toBe(false);
    expect(quickBarVisible({ ...base, dialogOpen: true })).toBe(false);
  });
  it("has the five tools and the phone's Više with everything in one place", () => {
    expect(QUICK_TOOLS.map((q) => q.label)).toEqual(["Poništi", "Navod", "Komentar", "Za provjeru", "Više"]);
    expect(MOBILE_MORE.map((m) => m.label)).toEqual(["Umetni", "Uredi", "Posebni znak", "Ponovi", "Podebljano", "Kurziv", "Naredbe"]);
  });
  it("measures the keyboard from the visual viewport", () => {
    expect(keyboardInset(800, { height: 500, offsetTop: 0 })).toBe(300);
    expect(keyboardInset(800, null)).toBe(0);
    expect(keyboardInset(800, { height: 900, offsetTop: 0 })).toBe(0);
  });
});

describe("right-click menu", () => {
  const ctx = { role: "student" as const, editable: true, hasSelection: true, canComment: true };
  const ids = (e: ReturnType<typeof textMenuEntries>) => e?.flatMap((x) => (x.kind === "item" ? [x.id] : []));
  it("has no menu for a locked work", () => {
    expect(textMenuEntries({ ...ctx, editable: false })).toBeNull();
  });
  it("offers a student with a selection the comment, the shape and the moves", () => {
    expect(ids(textMenuEntries(ctx))).toEqual(["comment", "citeAfter", "bold", "italic", "toQuote", "toFootnote", "stash", "cut", "copy"]);
  });
  it("offers a student without a selection only what is at that place", () => {
    expect(ids(textMenuEntries({ ...ctx, hasSelection: false }))).toEqual(["hole", "cite"]);
  });
  it("lets a collaborator only comment, and only on a selection", () => {
    const entries = textMenuEntries({ ...ctx, role: "collaborator" });
    expect(ids(entries)).toEqual(["comment"]);
    const none = textMenuEntries({ ...ctx, role: "collaborator", hasSelection: false })!;
    expect(none.find((e) => e.kind === "item")).toMatchObject({ id: "comment", disabled: true });
  });
  it("gives the teacher the review menu", () => {
    expect(ids(textMenuEntries({ ...ctx, role: "teacher" }))).toEqual(["comment", "note", "confirm"]);
  });
});

describe("moving shortcuts", () => {
  it("tells Alt+arrows, Alt+Shift+arrows and Ctrl/Cmd+Alt+M apart", () => {
    expect(key({ key: "ArrowUp", altKey: true })).toBe("sentenceUp");
    expect(key({ key: "ArrowDown", altKey: true })).toBe("sentenceDown");
    expect(key({ key: "ArrowUp", altKey: true, shiftKey: true })).toBe("chapterUp");
    expect(key({ key: "ArrowDown", altKey: true, ctrlKey: true })).toBe("chapterDown");
    expect(key({ key: "m", altKey: true, ctrlKey: true })).toBe("comment");
    expect(keyAction({ key: "M", altKey: true, shiftKey: false, ctrlKey: false, metaKey: true }, true)).toBe("comment");
    expect(key({ key: "m", altKey: true })).toBeNull();
    expect(key({ key: "ArrowUp" })).toBeNull();
  });
});
