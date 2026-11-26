// Contract v4 §2.2: the number of a numbered-list item is never stored. It is the
// item's position in a run of consecutive `orderedItem` blocks, from 1; any other
// block ends the run, so the next item starts at 1 again. The editor draws it and
// the export writes it from this one function, so the two always agree.

/** One number per block in order: "1." for an item, `null` for every other block. */
export function orderedListNumbers(blocks: readonly { type: string }[]): (string | null)[] {
  let position = 0;
  return blocks.map((block) => {
    if (block.type !== "orderedItem") {
      position = 0;
      return null;
    }
    position += 1;
    return `${position}.`;
  });
}
