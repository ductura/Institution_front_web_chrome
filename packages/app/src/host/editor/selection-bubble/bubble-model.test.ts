import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";
import { bubbleActions, bubblePlace } from "./bubble-model";
import { selectionBubbleHr } from "./messages.hr";

const base = { editable: true, text: "označeno", inQuote: false, footnote: true };

describe("bubbleActions", () => {
  it("offers the prototype's buttons in its order", () => {
    expect(bubbleActions(base)).toEqual(["comment", "cite", "toQuote", "toFootnote", "stash"]);
  });
  it("stays hidden for a read-only work or under three characters", () => {
    expect(bubbleActions({ ...base, editable: false })).toBeNull();
    expect(bubbleActions({ ...base, text: " ab  " })).toBeNull();
  });
  it("leaves out what would do nothing there", () => {
    expect(bubbleActions({ ...base, inQuote: true, footnote: false })).toEqual(["comment", "cite", "stash"]);
  });
});

describe("bubblePlace", () => {
  const view = { width: 1200, height: 800 };
  it("stands 44 px above the selection, centred on it", () => {
    expect(bubblePlace({ left: 400, top: 300, width: 100, bottom: 320 }, 200, view)).toEqual({ left: 350, top: 256 });
  });
  it("goes below near the top or on a narrow screen", () => {
    expect(bubblePlace({ left: 400, top: 80, width: 100, bottom: 100 }, 200, view).top).toBe(110);
    expect(bubblePlace({ left: 100, top: 300, width: 100, bottom: 320 }, 200, { width: 600, height: 800 }).top).toBe(330);
  });
  it("never leaves the screen", () => {
    expect(bubblePlace({ left: 0, top: 300, width: 10, bottom: 320 }, 200, view).left).toBe(8);
    expect(bubblePlace({ left: 1190, top: 300, width: 10, bottom: 320 }, 200, view).left).toBe(992);
  });
});

describe("selection bubble text", () => {
  it("has no forbidden terms", () => {
    expect(findForbiddenTerms(JSON.stringify(selectionBubbleHr))).toEqual([]);
  });
});
