// WEB-NF6-RUNDA (MK-9): the place kept with "Poruka sebi". Invented block ids only.
import { describe, expect, it } from "vitest";

import { NODE_ID_ATTRIBUTE } from "../../../../../editor-core/src/editor/interop.ts";
import { placeOf, positionOf, type PlaceEditor } from "./own-place";

const ID_A = "00000000-0000-4000-8000-0000000000a1";
const ID_B = "00000000-0000-4000-8000-0000000000b2";
const block = (id: string | null, size: number) => ({ attrs: id === null ? {} : { [NODE_ID_ATTRIBUTE]: id }, isTextblock: true, content: { size } });
const doc = { descendants(fn: (n: ReturnType<typeof block>, pos: number) => boolean | void) { fn(block(ID_A, 10), 0); fn(block(ID_B, 4), 12); } };
const editorAt = (parent: ReturnType<typeof block>, parentOffset: number): PlaceEditor => ({ state: { doc, selection: { $from: { parent, parentOffset } } } });

describe("own place", () => {
  it("reads the block and offset of the cursor", () => {
    expect(placeOf(editorAt(block(ID_B, 4), 3))).toEqual({ nodeId: ID_B, offset: 3 });
    expect(placeOf(editorAt(block(null, 4), 3))).toBeNull();
  });
  it("finds the kept place, clamped to its block, and nothing when the block is gone", () => {
    expect(positionOf(doc, { nodeId: ID_B, offset: 2 })).toBe(15);
    expect(positionOf(doc, { nodeId: ID_B, offset: 40 })).toBe(17);
    expect(positionOf(doc, { nodeId: "00000000-0000-4000-8000-0000000000c3", offset: 0 })).toBeNull();
  });
});
