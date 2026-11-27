import { Editor } from "@tiptap/core";
import { EditorState, TextSelection, type Transaction } from "@tiptap/pm/state";
import { describe, expect, it, vi } from "vitest";

import { createEditorExtensions, NODE_ID_ATTRIBUTE, tiptapToCanonical } from "@/editor";
import type { OriginRecordAnswer, OriginSegment, OriginSegmentsPort, OriginStoredAnswer } from "@/client/origin-segments";

import { OriginReporter } from "./origin-reporter";
import { canonicalTextBlocks, originOfSource } from "./origin-tracker";

/**
 * PM1-R01 (F4-PM1-R01): after a confirmed revision the sheet sends its ranges
 * of origin. Invented texts and ids only.
 */

const DOCUMENT = "demo-rad-podrijetlo";
const A = "aaaaaaaa-0000-4000-8000-aaaaaaaaaaaa";
const B = "bbbbbbbb-0000-4000-8000-bbbbbbbbbbbb";
const TEXT_A = "Izmišljeni uvod.";
const TEXT_B = "Drugi odlomak.";

type Change = readonly Transaction[];

/**
 * A sheet with every plugin of the editor (block identity included), driven
 * through `applyTransaction`, so each change hands over the transactions the
 * editor's `transaction` event would: the one dispatched and those appended.
 */
function sheet(texts: Record<string, string> = { [A]: TEXT_A, [B]: TEXT_B }) {
  const editor = new Editor({
    element: null,
    extensions: createEditorExtensions(),
    content: { type: "doc", content: Object.entries(texts).map(([id, text]) => ({ type: "paragraph", attrs: { [NODE_ID_ATTRIBUTE]: id }, content: [{ type: "text", text }] })) },
  });
  let state = EditorState.create({ schema: editor.schema, doc: editor.state.doc, plugins: editor.extensionManager.plugins });
  /** Applies the transaction `build` makes and hands back every transaction of that change. */
  const change = (build: (current: EditorState) => Transaction): Change => {
    const result = state.applyTransaction(build(state));
    state = result.state;
    return result.transactions;
  };
  const endOf = (id: string): number => {
    let at = -1;
    state.doc.descendants((node, pos) => { if (node.attrs[NODE_ID_ATTRIBUTE] === id) at = pos + node.nodeSize - 1; return false; });
    return at;
  };
  const insertAt = (at: number, text: string): Change => change((current) => current.tr.insertText(text, at));
  const confirmedDoc = (): unknown => {
    const result = tiptapToCanonical(state.doc.toJSON() as Parameters<typeof tiptapToCanonical>[0]);
    if (!result.ok) throw new Error("test document is not canonical");
    return result.doc;
  };
  return { change, endOf, insertAt, confirmedDoc, state: () => state };
}

function fakePort(stored: OriginStoredAnswer = { kind: "ready", revision: null, segments: [] }, answer: OriginRecordAnswer = { kind: "recorded", revision: 1, recorded: 1 }) {
  const record = vi.fn(async (_documentId: string, _revision: number, _segments: readonly OriginSegment[]) => answer);
  const port: OriginSegmentsPort = { record, stored: vi.fn(async () => stored) };
  return { port, record };
}

const points = (text: string) => Array.from(text).length;

describe("originOfSource", () => {
  it("names typed and pasted text from the evidence source and guesses nothing else", () => {
    expect(originOfSource("editor")).toBe("typed");
    expect(originOfSource("keyless-input")).toBe("typed");
    expect(originOfSource("paste")).toBe("pasted_unknown");
    expect(originOfSource("drop")).toBe("pasted_unknown");
    expect(originOfSource("import")).toBe("imported_file");
    expect(originOfSource("ai-transfer")).toBe("assistant_inserted");
    for (const none of ["unattributed", "system-replacement", "citation-form", "cut", null]) expect(originOfSource(none)).toBeNull();
  });
});

describe("OriginReporter (PM1-R01)", () => {
  it("sends the typed and the pasted range of a confirmed revision, in code points of its block", async () => {
    const s = sheet();
    const { port, record } = fakePort();
    const reporter = new OriginReporter(port, DOCUMENT);
    reporter.note(s.insertAt(s.endOf(A), " Tipkano 😊"), "editor");
    reporter.note(s.insertAt(s.endOf(A), " Zalijepljeno"), "paste");
    await reporter.confirmed(5, s.confirmedDoc());
    expect(record).toHaveBeenCalledTimes(1);
    const typedEnd = points(TEXT_A) + points(" Tipkano 😊");
    expect(record.mock.calls[0]).toEqual([DOCUMENT, 5, [
      { blockId: A, start: points(TEXT_A), end: typedEnd, kind: "typed" },
      { blockId: A, start: typedEnd, end: typedEnd + points(" Zalijepljeno"), kind: "pasted_unknown" },
    ]]);
  });

  it("follows the text when it moves: an insert earlier in the block shifts the pasted range", async () => {
    const s = sheet();
    const { port, record } = fakePort();
    const reporter = new OriginReporter(port, DOCUMENT);
    reporter.note(s.insertAt(s.endOf(B), " ZZ"), "paste");
    reporter.note(s.insertAt(s.endOf(B) - points(TEXT_B) - 3, "Novo "), "editor");
    await reporter.confirmed(2, s.confirmedDoc());
    expect(record.mock.calls[0]![2]).toEqual([
      { blockId: B, start: 0, end: 5, kind: "typed" },
      { blockId: B, start: 5 + points(TEXT_B), end: 5 + points(TEXT_B) + 3, kind: "pasted_unknown" },
    ]);
  });

  it("an insert without a named source (undo, toolbar, find and replace) is unmarked and splits the range it lands in", async () => {
    const s = sheet();
    const { port, record } = fakePort();
    const reporter = new OriginReporter(port, DOCUMENT);
    const start = s.endOf(A);
    reporter.note(s.insertAt(start, "abcdef"), "paste");
    reporter.note(s.insertAt(start + 3, "XY"), "unattributed");
    await reporter.confirmed(3, s.confirmedDoc());
    const base = points(TEXT_A);
    expect(record.mock.calls[0]![2]).toEqual([
      { blockId: A, start: base, end: base + 3, kind: "pasted_unknown" },
      { blockId: A, start: base + 5, end: base + 8, kind: "pasted_unknown" },
    ]);
  });

  it("typing over pasted text takes the kind of the typing", async () => {
    const s = sheet();
    const { port, record } = fakePort();
    const reporter = new OriginReporter(port, DOCUMENT);
    const start = s.endOf(A);
    reporter.note(s.insertAt(start, "abcd"), "paste");
    reporter.note(s.change((current) => current.tr.setSelection(TextSelection.create(current.doc, start, start + 4)).insertText("q")), "editor");
    await reporter.confirmed(4, s.confirmedDoc());
    expect(record.mock.calls[0]![2]).toEqual([{ blockId: A, start: points(TEXT_A), end: points(TEXT_A) + 1, kind: "typed" }]);
  });

  it("leaves out a block whose text differs from the confirmed revision (typed into after it)", async () => {
    const s = sheet();
    const { port, record } = fakePort();
    const reporter = new OriginReporter(port, DOCUMENT);
    reporter.note(s.insertAt(s.endOf(A), " jedan"), "editor");
    reporter.note(s.insertAt(s.endOf(B), " dva"), "paste");
    const confirmed = s.confirmedDoc();
    reporter.note(s.insertAt(s.endOf(A), " poslije"), "editor");
    await reporter.confirmed(6, confirmed);
    expect(record.mock.calls[0]![2]).toEqual([{ blockId: B, start: points(TEXT_B), end: points(TEXT_B) + 4, kind: "pasted_unknown" }]);
  });

  it("marks a new paragraph under its minted id", async () => {
    const s = sheet();
    const { port, record } = fakePort();
    const reporter = new OriginReporter(port, DOCUMENT);
    const split = s.change((current) => current.tr.split(s.endOf(B)));
    expect(split.length).toBeGreaterThan(1); // the identity plugin appended the new block's id
    reporter.note(split, "editor");
    reporter.note(s.insertAt(s.endOf(B) + 2, "Nov odlomak"), "editor");
    await reporter.confirmed(7, s.confirmedDoc());
    const segments = record.mock.calls[0]![2];
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ start: 0, end: points("Nov odlomak"), kind: "typed" });
    expect(segments[0]!.blockId).not.toBe(A);
    expect(segments[0]!.blockId).not.toBe(B);
    expect(canonicalTextBlocks(s.confirmedDoc()).get(segments[0]!.blockId)).toBe("Nov odlomak");
  });

  it("sends a revision once, never an older one, and nothing without a change since the load", async () => {
    const s = sheet();
    const { port, record } = fakePort();
    const reporter = new OriginReporter(port, DOCUMENT);
    await expect(reporter.confirmed(1, s.confirmedDoc())).resolves.toBeNull();
    reporter.note(s.insertAt(s.endOf(A), "x"), "editor");
    await reporter.confirmed(4, s.confirmedDoc());
    await expect(reporter.confirmed(4, s.confirmedDoc())).resolves.toBeNull();
    await expect(reporter.confirmed(3, s.confirmedDoc())).resolves.toBeNull();
    expect(record).toHaveBeenCalledTimes(1);
  });

  it("a revision the server already has (409) is not sent again; a failure is tried with the next revision", async () => {
    const s = sheet();
    const already = fakePort(undefined, { kind: "already" });
    const reporter = new OriginReporter(already.port, DOCUMENT);
    reporter.note(s.insertAt(s.endOf(A), "x"), "editor");
    await reporter.confirmed(2, s.confirmedDoc());
    await reporter.confirmed(2, s.confirmedDoc());
    expect(already.record).toHaveBeenCalledTimes(1);

    const down = fakePort(undefined, { kind: "unavailable" });
    const again = new OriginReporter(down.port, DOCUMENT);
    again.note(s.insertAt(s.endOf(A), "y"), "editor");
    await again.confirmed(3, s.confirmedDoc());
    await again.confirmed(4, s.confirmedDoc());
    expect(down.record.mock.calls.map((call) => call[1])).toEqual([3, 4]);
  });

  it("starts from the server's ranges of the loaded revision, on blocks whose text is still that text", async () => {
    const s = sheet();
    const loaded = s.confirmedDoc();
    const stored: OriginStoredAnswer = { kind: "ready", revision: 8, segments: [
      { blockId: A, start: 0, end: 10, kind: "pasted_known" },
      { blockId: B, start: 0, end: 5, kind: "imported_file" },
    ] };
    const { port, record } = fakePort(stored);
    const reporter = new OriginReporter(port, DOCUMENT);
    await reporter.seed(8, loaded);
    await expect(reporter.confirmed(8, loaded)).resolves.toBeNull();
    reporter.note(s.insertAt(s.endOf(B), " više"), "editor");
    await reporter.confirmed(9, s.confirmedDoc());
    expect(record.mock.calls[0]![2]).toEqual([
      { blockId: A, start: 0, end: 10, kind: "pasted_known" },
      { blockId: B, start: 0, end: 5, kind: "imported_file" },
      { blockId: B, start: points(TEXT_B), end: points(TEXT_B) + 5, kind: "typed" },
    ]);
  });

  it("ignores the server's ranges of another revision, or of a load that owed rows", async () => {
    const s = sheet();
    const stored: OriginStoredAnswer = { kind: "ready", revision: 8, segments: [{ blockId: A, start: 0, end: 10, kind: "pasted_known" }] };
    for (const loadedAt of [7, null]) {
      const { port, record } = fakePort(stored);
      const reporter = new OriginReporter(port, DOCUMENT);
      await reporter.seed(loadedAt, s.confirmedDoc());
      reporter.note(s.insertAt(s.endOf(B), "!"), "editor");
      await reporter.confirmed(9, s.confirmedDoc());
      expect(record.mock.calls[0]![2]).toEqual([{ blockId: B, start: points(s.state().doc.child(1).textContent) - 1, end: points(s.state().doc.child(1).textContent), kind: "typed" }]);
    }
  });

  it("keeps the server's ranges when they arrive after the student started typing (Codex c.4716836076)", async () => {
    const s = sheet();
    const loaded = s.confirmedDoc();
    let answer: (value: OriginStoredAnswer) => void = () => {};
    const record = vi.fn(async (_documentId: string, _revision: number, _segments: readonly OriginSegment[]): Promise<OriginRecordAnswer> => ({ kind: "recorded", revision: 9, recorded: 3 }));
    const port: OriginSegmentsPort = { record, stored: () => new Promise((resolve) => { answer = resolve; }) };
    const reporter = new OriginReporter(port, DOCUMENT);
    const seeding = reporter.seed(8, loaded);
    // Typed in front of the stored range before the read answers: the range moves with its text.
    reporter.note(s.insertAt(1, "Novo "), "editor");
    reporter.note(s.insertAt(s.endOf(B), " više"), "editor");
    const sent = reporter.confirmed(9, s.confirmedDoc());
    answer({ kind: "ready", revision: 8, segments: [{ blockId: A, start: 0, end: 10, kind: "pasted_known" }, { blockId: B, start: 0, end: 5, kind: "imported_file" }] });
    await seeding;
    await sent;
    expect(record.mock.calls[0]![2]).toEqual([
      { blockId: A, start: 0, end: 5, kind: "typed" },
      { blockId: A, start: 5, end: 15, kind: "pasted_known" },
      { blockId: B, start: 0, end: 5, kind: "imported_file" },
      { blockId: B, start: points(TEXT_B), end: points(TEXT_B) + 5, kind: "typed" },
    ]);
  });

  it("sends a confirmed revision with its ranges as they were at the confirmation, not after later typing (Codex c.4716836083)", async () => {
    const s = sheet();
    let release: () => void = () => {};
    const record = vi.fn(async (_documentId: string, revision: number, _segments: readonly OriginSegment[]): Promise<OriginRecordAnswer> => {
      if (revision === 2) await new Promise<void>((resolve) => { release = resolve; });
      return { kind: "recorded", revision, recorded: 1 };
    });
    const reporter = new OriginReporter({ record, stored: vi.fn(async () => ({ kind: "unavailable" }) as const) }, DOCUMENT);
    const start = s.endOf(A);
    reporter.note(s.insertAt(start, "a"), "editor");
    const first = reporter.confirmed(2, s.confirmedDoc());
    reporter.note(s.insertAt(start + 1, "xyz"), "paste");
    const second = reporter.confirmed(3, s.confirmedDoc());
    await vi.waitFor(() => { expect(record).toHaveBeenCalledTimes(1); });
    // While revision 2 is on its way, the pasted text is deleted and the same letters typed.
    reporter.note(s.change((current) => current.tr.delete(start + 1, start + 4)), null);
    reporter.note(s.insertAt(start + 1, "xyz"), "editor");
    release();
    await first;
    await second;
    const base = points(TEXT_A);
    expect(record.mock.calls[1]![1]).toBe(3);
    expect(record.mock.calls[1]![2]).toEqual([
      { blockId: A, start: base, end: base + 1, kind: "typed" },
      { blockId: A, start: base + 1, end: base + 4, kind: "pasted_unknown" },
    ]);
  });

  it("forgets every range when a change went by without passing here, rather than misplace them", async () => {
    const s = sheet();
    const { port, record } = fakePort();
    const reporter = new OriginReporter(port, DOCUMENT);
    reporter.note(s.insertAt(s.endOf(A), " zalijepljeno"), "paste");
    s.insertAt(1, "Neviđeno ");
    reporter.note(s.insertAt(s.endOf(B), "!"), "editor");
    await reporter.confirmed(3, s.confirmedDoc());
    expect(record.mock.calls[0]![2]).toEqual([{ blockId: B, start: points(TEXT_B), end: points(TEXT_B) + 1, kind: "typed" }]);
  });
});
