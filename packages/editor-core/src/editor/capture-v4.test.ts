// @vitest-environment node
import { Editor, getSchema } from "@tiptap/core";
import { EditorState, type Transaction } from "@tiptap/pm/state";
import { describe, expect, it } from "vitest";

import { EDIT_STEP_FORMAT_V4 } from "../document/document/edit-step";
import { REVISION_ZERO_V4_SHA256, revisionZeroDocumentV4 } from "../document/document/revision-zero";
import { verifyCanonicalEvidencePayloadV2 } from "../document/forensics/evidence-chain-v2";
import { replayEvidenceSegmentsV2 } from "../document/forensics/evidence-replay-v2";
import type { JcsJsonValue } from "../document/forensics/jcs";
import { createBrowserAcademicReplayer } from "../document/forensics/replay/edit-steps-versioned-browser-replayer";
import { EvidenceRecorder, changeOf } from "./capture";
import { canonicalToTiptapV4 } from "./interop-v4";
import { V4_CORE_EXTENSIONS } from "./extensions-v4";
import { createEditorExtensionsV4 } from "./schema";

const context = {
  documentId: "rad-izmisljeni", sessionId: "sesija-izmisljena", segmentId: "segment-izmisljeni",
  evidenceProfileId: "profil-izmisljeni", sequenceFrom: 1, predecessorSegmentHash: null,
};
const schema = getSchema(createEditorExtensionsV4());
const zero = revisionZeroDocumentV4();
const table = { rows: [["a", "b"], ["c", ""]], header: true, stripes: false, landscape: false, title: null, source: null, headerFill: null, cellFills: null, merges: null, nodeId: null };

/**
 * Every transaction is dispatched to a headless editor (so the identity plugin
 * names the new blocks, as in the app), recorded as an event of its own and
 * the segment replayed from revision zero. Every dispatched change must be an
 * event: a recorder that stops early would still replay what it kept.
 */
async function run(edit: (state: () => EditorState, record: (tr: Transaction) => void) => void) {
  const editor = new Editor({
    element: null,
    extensions: createEditorExtensionsV4(),
    enableCoreExtensions: V4_CORE_EXTENSIONS,
    content: canonicalToTiptapV4(zero),
  });
  editor.view.updateState(editor.state.reconfigure({ plugins: editor.extensionManager.plugins }));
  const recorder = new EvidenceRecorder(undefined, 4);
  let at = 0;
  let changes = 0;
  editor.on("transaction", ({ transaction, appendedTransactions }) => {
    const all: Transaction[] = [transaction, ...appendedTransactions];
    if (!all.some((tr) => tr.docChanged)) return;
    recorder.record(changeOf(all, "editor", at));
    changes += 1;
    at += 1000;
  });
  edit(() => editor.state, (tr) => editor.view.dispatch(tr));
  recorder.close();
  const built = (await recorder.takeSegment(context))!;
  expect({ events: built.eventCount, failure: (recorder as unknown as { failure: unknown }).failure }).toEqual({ events: changes, failure: null });
  const replayed = await replayEvidenceSegmentsV2(zero as unknown as JcsJsonValue, [built.segment], createBrowserAcademicReplayer(4));
  return { built, replayed };
}

describe("capture and replay of a v4 work", () => {
  it("text, marks with attributes, a code block, an inline formula", async () => {
    const { built, replayed } = await run((state, record) => {
      record(state().tr.insertText("Izmišljeni tekst", 1));
      record(state().tr.addMark(1, 6, state().schema.marks.highlight!.create({ color: "#f2d24b" })));
      record(state().tr.addMark(7, 10, state().schema.marks.lang!.create({ lang: "en" })));
      record(state().tr.addMark(7, 10, state().schema.marks.sup!.create()));
      record(state().tr.insert(17, state().schema.nodes.inlineFormula!.create({ tex: "x^{2}" })));
    });
    expect(built.segment.initialDocumentHash).toBe(REVISION_ZERO_V4_SHA256);
    expect(built.segment.captureContext.transactionFormat).toBe(EDIT_STEP_FORMAT_V4);
    expect(await verifyCanonicalEvidencePayloadV2(built.bytes, EDIT_STEP_FORMAT_V4)).toMatchObject({ ok: true });
    expect(replayed).toEqual({ ok: true, canonicalDocument: new TextDecoder().decode(built.document), documentSha256: built.segment.finalDocumentHash });
  });

  it("an atom block in, one field of it changed, then removed", async () => {
    const { built, replayed } = await run((state, record) => {
      record(state().tr.insert(state().doc.content.size, state().schema.nodes.table!.create(table)));
      record(state().tr.setNodeMarkup(state().doc.content.size - 1, undefined, { ...table, rows: [["a", "B"], ["c", ""]] }));
      record(state().tr.delete(state().doc.content.size - 1, state().doc.content.size));
    });
    const steps = built.segment.events.flatMap((event) => event.steps) as { stepType: string; slice?: { content: { type: string; nodeId?: string }[] }; removedSha256?: string }[];
    const replace = steps.find((step) => step.removedSha256 !== undefined);
    expect(replace?.slice?.content[0]).toMatchObject({ type: "table", nodeId: expect.stringMatching(/^[0-9a-f-]{36}$/u) });
    expect(steps.filter((step) => step.removedSha256 !== undefined)).toHaveLength(2);
    expect(replayed).toMatchObject({ ok: true, canonicalDocument: new TextDecoder().decode(built.document) });
  });

  it("paragraphs wrapped in a box, split inside it, lifted out again", async () => {
    const { replayed, built } = await run((state, record) => {
      record(state().tr.insertText("Prvi", 1));
      record(state().tr.split(5));
      record(state().tr.insertText("Drugi", 7));
      const box = state().schema.nodes.box!.create({ kind: "theorem", nodeId: null });
      record(state().tr.wrap(state().doc.resolve(1).blockRange(state().doc.resolve(8))!, [{ type: state().schema.nodes.box!, attrs: box.attrs }]));
      record(state().tr.split(4));
      record(state().tr.insertText("Treći", 6));
      const $in = state().doc.resolve(2);
      record(state().tr.lift($in.blockRange(state().doc.resolve(state().doc.content.size - 2))!, 0));
    });
    const kinds = built.segment.events.flatMap((event) => event.steps).map((step) => (step as { stepType: string }).stepType);
    expect(kinds.filter((kind) => kind === "replaceAround")).toHaveLength(2);
    expect(replayed).toMatchObject({ ok: true, canonicalDocument: new TextDecoder().decode(built.document) });
  });

  it("a cover set whole, changed, and removed", async () => {
    const { replayed, built } = await run((state, record) => {
      record(state().tr.setDocAttribute("cover", { place: "Zagreb" }));
      record(state().tr.setDocAttribute("cover", { date: "studeni 2026.", place: "Zagreb" }));
      record(state().tr.setDocAttribute("cover", null));
    });
    const steps = built.segment.events.flatMap((event) => event.steps);
    expect(steps).toMatchObject([
      { stepType: "coverSet", cover: { place: "Zagreb" } },
      { stepType: "coverSet", cover: { date: "studeni 2026.", place: "Zagreb" }, removedSha256: expect.any(String) },
      { stepType: "coverSet", removedSha256: expect.any(String) },
    ]);
    expect(replayed).toMatchObject({ ok: true });
  });

  it("refuses a replay whose cover hash is wrong", async () => {
    const { built } = await run((state, record) => {
      record(state().tr.setDocAttribute("cover", { place: "Zagreb" }));
      record(state().tr.setDocAttribute("cover", { place: "Split" }));
    });
    const segment = structuredClone(built.segment);
    (segment.events[1]!.steps[0] as { removedSha256: string }).removedSha256 = "1".repeat(64);
    const replayed = await replayEvidenceSegmentsV2(zero as unknown as JcsJsonValue, [segment], createBrowserAcademicReplayer(4));
    expect(replayed.ok).toBe(false);
  });
});
