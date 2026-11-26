// ED-30 (P2-1a): which tool folds into "Više" next, and when the bar counts as wrapped.
import { describe, expect, it } from "vitest";

import { nextToFold, wrapsToSecondRow } from "./toolbar-fit";

describe("nextToFold", () => {
  const bar = ["undo", "redo", "bold", "italic", "bulletList", "quote"];

  it("folds the least needed tool first, as the prototype's fit()", () => {
    expect(nextToFold(bar, [])).toBe("redo");
    expect(nextToFold(bar, ["redo"])).toBe("quote");
    expect(nextToFold(bar, ["redo", "quote"])).toBe("bulletList");
    expect(nextToFold(bar, ["redo", "quote", "bulletList"])).toBe("italic");
  });

  it("keeps undo to the last", () => {
    expect(nextToFold(bar, ["redo", "quote", "bulletList", "italic", "bold"])).toBe("undo");
  });

  it("has nothing left once every tool is folded", () => {
    expect(nextToFold(bar, bar)).toBeNull();
    expect(nextToFold([], [])).toBeNull();
  });

  it("gives a tool it does not know a middle weight", () => {
    expect(nextToFold(["undo", "newTool"], [])).toBe("newTool");
    expect(nextToFold(["redo", "newTool"], [])).toBe("redo");
  });
});

describe("wrapsToSecondRow", () => {
  it("is one row while the tops agree within a rounding", () => {
    expect(wrapsToSecondRow([6, 6, 7, 6])).toBe(false);
    expect(wrapsToSecondRow([])).toBe(false);
  });

  it("is wrapped once a box sits lower than the first", () => {
    expect(wrapsToSecondRow([6, 6, 40])).toBe(true);
  });
});
