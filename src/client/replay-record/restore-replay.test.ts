import type { Node as PmNode } from "@tiptap/pm/model";
import { describe, expect, it } from "vitest";

import { buildReplayPlayer } from "./replay-player";
import { buildRecord, jcsOf, recordSchema as schema, startNode as start, type RecordSegmentPlan } from "./replay-record.fixture";
import { createBrowserReplayStepsV1 } from "./replay-steps";

// WEB-1907 (P-D7): restoring an earlier revision is saved as a new change, so the replay shows it
// as its own step after the text it brings back, and every earlier step stays as it was.
const steps = createBrowserReplayStepsV1();
const typeAt = (pos: number, value: string) => ({ edit: (tr: Parameters<RecordSegmentPlan["events"][0]["edit"]>[0]) => tr.insert(pos, schema.text(value)) });
// The editor restores within the blocks the document already has: a new block may not bring an id
// of its own, so each changed block's text is replaced by the text it had (last block first, so earlier
// positions stay put).
const restoreText = (tr: Parameters<RecordSegmentPlan["events"][0]["edit"]>[0], earlier: PmNode) => {
  const blocks: { from: number; to: number; index: number }[] = [];
  tr.doc.forEach((node, offset, index) => {
    if (!node.content.eq(earlier.child(index).content)) blocks.push({ from: offset + 1, to: offset + node.nodeSize - 1, index });
  });
  for (const b of blocks.reverse()) tr.replaceWith(b.from, b.to, earlier.child(b.index).content);
};
const writing: RecordSegmentPlan[] = [
  { at: "10:00", events: [typeAt(17, "X")] },
  { at: "11:00", events: [typeAt(1, "Y"), typeAt(1, "Z")] },
];

describe("a restored revision in the replay (WEB-1907)", () => {
  it("is one more change, ending on the restored text, with the earlier changes intact", async () => {
    const earlier = buildRecord(start, writing).ends[0]!;
    const r = buildRecord(start, [
      ...writing,
      { at: "12:00", events: [{ edit: (tr) => restoreText(tr, earlier) }] },
    ]);
    const before = await buildReplayPlayer({ startDocument: jcsOf(start), segments: r.segments.slice(0, 2), head: { segmentHash: r.hashes[1]!, segmentCount: 2 }, resumeDocuments: {} }, steps);
    const player = await buildReplayPlayer({ startDocument: jcsOf(start), segments: r.segments, head: r.head, resumeDocuments: {} }, steps);
    if (!player.ok || !before.ok) throw new Error(`replay did not build: ${JSON.stringify([before, player])}`);

    expect(player.total).toBe(before.total + 1);
    expect(player.documentAt(player.total)).toStrictEqual(earlier.toJSON());
    expect(player.documentAt(player.total)).not.toStrictEqual(player.documentAt(player.total - 1));
    for (let i = 0; i <= before.total; i++) expect(player.documentAt(i)).toStrictEqual(before.documentAt(i));
    expect(player.documentAt(1)).toStrictEqual(earlier.toJSON());
  });
});
