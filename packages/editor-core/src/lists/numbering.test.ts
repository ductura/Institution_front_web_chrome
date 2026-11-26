// @vitest-environment node
import { describe, expect, it } from "vitest";

import { orderedListNumbers } from "./numbering";

const item = { type: "orderedItem" };
const para = { type: "paragraph" };

describe("orderedListNumbers (contract v4 §2.2)", () => {
  it("numbers a run of consecutive items from 1 by position", () => {
    expect(orderedListNumbers([item, item, item])).toEqual(["1.", "2.", "3."]);
  });

  it("restarts at 1 after any other block, which gets no number", () => {
    expect(orderedListNumbers([item, item, para, item])).toEqual(["1.", "2.", null, "1."]);
    expect(orderedListNumbers([item, { type: "bulletItem" }, item])).toEqual(["1.", null, "1."]);
    expect(orderedListNumbers([item, { type: "heading" }, item, item])).toEqual(["1.", null, "1.", "2."]);
  });

  it("has no levels: a stray level field does not nest", () => {
    expect(orderedListNumbers([{ type: "orderedItem", level: 3 } as { type: string }, { type: "orderedItem", level: 1 } as { type: string }])).toEqual(["1.", "2."]);
  });

  it("is empty for an empty document", () => {
    expect(orderedListNumbers([])).toEqual([]);
  });
});
