// @vitest-environment jsdom
// ED-101: the bar's counters and "Prije slanja mentoru", as the prototype's toolbar2.js. Invented places only.
import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";

import { createEditorExtensionsV3 } from "../../../../../editor-core/src/editor/schema";
import { allPlaces, type MarkKind, type Place } from "../marks/marks-model";
import { counterButtons, countsOf, plural, sendRows, waiting } from "./counters";
import { jumpToNext } from "./ToolbarCounters";

const at = (kind: MarkKind, from: number): Place => ({ kind, level: 1, name: kind, from, to: from + 3 });

describe("bar counters (ED-101)", () => {
  const places = [at("hole", 1), at("hole", 9), at("cmt", 4), at("plain", 20), at("need", 30), at("cite", 40)];

  it("counts Za provjeru, open comments and citations typed as text, nothing else", () => {
    expect(countsOf(places)).toEqual({ cntHole: 2, cntCmt: 1, cntSrc: 1 });
    expect(waiting(countsOf(places))).toBe(4);
  });

  it("leaves a counter at zero off the bar", () => {
    const buttons = counterButtons({ cntHole: 0, cntCmt: 3, cntSrc: 0 });
    expect(buttons.map((b) => [b.id, b.count, b.label])).toEqual([["cntCmt", 3, "Otvoreni komentari"]]);
    expect(buttons[0]!.tip).toBe("Skok na sljedeći otvoreni komentar");
    expect(counterButtons({ cntHole: 0, cntCmt: 0, cntSrc: 0 })).toEqual([]);
  });

  it("lists what waits before sending, in Croatian plurals", () => {
    expect(sendRows({ cntHole: 1, cntCmt: 2, cntSrc: 5 })).toEqual([
      { id: "cntHole", text: "1 mjesto za provjeru", note: "idi na sljedeće" },
      { id: "cntCmt", text: "2 otvorena komentara", note: "idi na sljedeći" },
      { id: "cntSrc", text: "5 navoda bez izvora", note: "idi na sljedeći" },
    ]);
    expect(sendRows({ cntHole: 0, cntCmt: 0, cntSrc: 0 })).toEqual([]);
  });

  it("jumps to the next Za provjeru and wraps to the first", () => {
    const element = document.createElement("div");
    const e = new Editor({ element, extensions: createEditorExtensionsV3(), content: { type: "doc", content: [
      { type: "paragraph", content: [{ type: "text", text: "Prvo [?] pa drugo [?] kraj." }] }] } });
    const holes = countsOf(allPlaces(e.state.doc, [])).cntHole;
    expect(holes).toBe(2);
    e.commands.setTextSelection(1);
    expect(jumpToNext(e, "cntHole")).toBe(true);
    const first = e.state.selection.from;
    jumpToNext(e, "cntHole");
    expect(e.state.selection.from).toBeGreaterThan(first);
    jumpToNext(e, "cntHole");
    expect(e.state.selection.from).toBe(first);
    expect(jumpToNext(e, "cntSrc")).toBe(false);
    expect(jumpToNext(null, "cntHole")).toBe(false);
    e.destroy();
  });

  it.each([[1, 0], [21, 0], [11, 2], [2, 1], [24, 1], [12, 2], [14, 2], [5, 2], [0, 2]])("plural of %i is form %i", (n, form) => {
    expect(plural(n, ["a", "b", "c"])).toBe(["a", "b", "c"][form]);
  });
});
