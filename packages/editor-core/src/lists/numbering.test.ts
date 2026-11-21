// @vitest-environment node
import { describe, expect, it } from "vitest";

import { numberedListNumbers } from "./numbering";

const item = (level: number) => ({ type: "numberedItem", level });
const para = { type: "paragraph" };

describe("numberedListNumbers (WEB-1608)", () => {
  it("numbers a nested list 1., 1.1., 1.2., 2., 2.1.", () => {
    expect(numberedListNumbers([item(1), item(2), item(2), item(1), item(2)])).toEqual(["1.", "1.1.", "1.2.", "2.", "2.1."]);
  });

  it("goes to three levels and back", () => {
    expect(numberedListNumbers([item(1), item(2), item(3), item(3), item(2), item(1)])).toEqual([
      "1.", "1.1.", "1.1.1.", "1.1.2.", "1.2.", "2.",
    ]);
  });

  it("restarts after any other block and gives it no number", () => {
    expect(numberedListNumbers([item(1), item(1), para, item(1)])).toEqual(["1.", "2.", null, "1."]);
    expect(numberedListNumbers([item(1), { type: "bulletItem" }, item(1)])).toEqual(["1.", null, "1."]);
  });

  it("never skips a level: a deeper first item counts as one level deeper", () => {
    expect(numberedListNumbers([item(3), item(3), item(3)])).toEqual(["1.", "1.1.", "1.1.1."]);
    expect(numberedListNumbers([item(1), item(3)])).toEqual(["1.", "1.1."]);
  });

  it("clamps a wrong level into 1..3 and reads a missing one as 1", () => {
    expect(numberedListNumbers([item(0), { type: "numberedItem" }, item(9)])).toEqual(["1.", "2.", "2.1."]);
  });

  it("is empty for an empty document", () => {
    expect(numberedListNumbers([])).toEqual([]);
  });
});
