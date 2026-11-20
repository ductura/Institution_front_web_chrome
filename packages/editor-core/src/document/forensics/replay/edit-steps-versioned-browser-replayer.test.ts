import { describe, expect, it } from "vitest";

import { revisionZeroDocumentV2, revisionZeroDocumentV3 } from "../../document/revision-zero";
import type { EvidenceEventV3 } from "../evidence-segment-v2";
import type { JcsJsonValue } from "../jcs";
import { removedRangeSha256WebCrypto } from "./edit-steps-v1-browser-replayer";
import { createBrowserAcademicReplayer } from "./edit-steps-versioned-browser-replayer";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const request = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const atom = { type: "footnote", text: "Izmišljena bilješka" };
const citation = { type: "citation", sourceId: id, locator: "12", via: "Izmišljeni, 1973", rq: request };
const crossReference = { type: "crossReference", targetId: id };
const zero = revisionZeroDocumentV3() as unknown as JcsJsonValue;
const event = (...steps: EvidenceEventV3["steps"]): EvidenceEventV3 => ({
  sequence: 1, source: "editor", steps, beforeDocumentHash: "", afterDocumentHash: "",
});

describe("academic edit steps browser replay", () => {
  it("keeps v3 atoms and their attributes when a mark spans them", async () => {
    const replay = createBrowserAcademicReplayer(3);
    const doc = await replay.apply(replay.load(zero), event(
      { stepType: "replace", from: 1, to: 1, slice: { content: [atom, citation, crossReference, { type: "text", text: "Riječ" }] } },
      { stepType: "addMark", from: 1, to: 9, mark: { type: "bold" } },
    ));
    expect(replay.toCanonical(doc)).toMatchObject({ schemaVersion: 3, nodes: [{ children: [
      atom, citation, crossReference, { type: "text", text: "Riječ", marks: ["bold"] },
    ] }] });
  });

  it("requires the hash of the old atom including its attributes", async () => {
    const replay = createBrowserAcademicReplayer(3);
    const doc = await replay.apply(replay.load(zero), event(
      { stepType: "replace", from: 1, to: 1, slice: { content: [atom] } },
    ));
    const change = { stepType: "replace", from: 1, to: 2, slice: { content: [{ ...atom, text: "Nova bilješka" }] } };
    await expect(replay.apply(doc, event({ ...change, structure: true }))).rejects.toThrow();
    await expect(replay.apply(doc, event({ ...change, removedSha256: "1".repeat(64) }))).rejects.toThrow("removed_range_hash");
    const removedSha256 = await removedRangeSha256WebCrypto(doc, 1, 2);
    expect(replay.toCanonical(await replay.apply(doc, event({ ...change, removedSha256 })))).toMatchObject({
      nodes: [{ children: [{ type: "footnote", text: "Nova bilješka" }] }],
    });
  });

  it("selects the format from the work's document version", async () => {
    const v2 = createBrowserAcademicReplayer(2);
    const v3 = createBrowserAcademicReplayer(3);
    const zeroV2 = revisionZeroDocumentV2() as unknown as JcsJsonValue;
    expect(() => v2.load(zero)).toThrow("invalid_document");
    expect(() => v3.load(zeroV2)).toThrow("invalid_document");
    await expect(v2.apply(v2.load(zeroV2), event({
      stepType: "replace", from: 1, to: 1, slice: { content: [atom] },
    }))).rejects.toThrow();
  });
});
