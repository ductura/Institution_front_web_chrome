import { describe, expect, it } from "vitest";
import {
  applySlideSteps, parseSlideSteps, slidesRevisionZeroDocument, slidesSnapshotSha256, validateSlidesDocument, type SlideStep, type SlidesDocument,
} from "../../../../../editor-core/src/slides/index.ts";
import {
  addSlide, compatibleLayouts, createEditorState, documentText, moveSlide, redo, removeSlide, selectedSlide, setBlockText, setLayout, setListItem, setNotes,
  textRange, undo, type EditorState, type Outcome,
} from "./editor-model.ts";

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const start = () => createEditorState(slidesRevisionZeroDocument());
const first = (state: EditorState) => state.doc.slides[0]!.id;

/** Runs changes in order, collecting every step the editor recorded. */
async function play(state: EditorState, ...ops: ((s: EditorState) => Promise<Outcome>)[]) {
  const steps: SlideStep[] = [];
  let current = state;
  for (const op of ops) {
    const out = await op(current);
    steps.push(...out.steps);
    current = out.state;
  }
  return { state: current, steps };
}

/** The invariant of the editor: its steps, replayed on revision 0, give exactly the document it shows. */
async function replayed(steps: SlideStep[]): Promise<SlidesDocument> {
  const parsed = parseSlideSteps(JSON.parse(JSON.stringify(steps)));
  expect(parsed.ok).toBe(true);
  const result = await applySlideSteps(slidesRevisionZeroDocument(), parsed.ok ? parsed.steps : []);
  expect(result.ok).toBe(true);
  return result.ok ? result.doc : slidesRevisionZeroDocument();
}

const sha = (doc: SlidesDocument) => slidesSnapshotSha256(doc);

describe("slides editor model", () => {
  it("typing builds a block, then textEdit steps, and the steps replay to the same document", async () => {
    const s0 = start();
    const id = first(s0);
    const { state, steps } = await play(
      s0,
      (s) => setBlockText(s, id, "title", null, "N", ID(1)),
      (s) => setBlockText(s, id, "title", null, "Na", ID(2)),
      (s) => setBlockText(s, id, "title", null, "Naslov", ID(3)),
      (s) => setBlockText(s, id, "body", null, "Sadržaj", ID(4)),
      (s) => setNotes(s, id, "Reći uvod"),
    );
    expect(steps.map((step) => step.type)).toEqual(["blockSet", "textEdit", "textEdit", "blockSet", "notesSet"]);
    expect(state.doc.slides[0]!.blocks.map((b) => [b.slot, b.type])).toEqual([["title", "heading"], ["body", "paragraph"]]);
    expect(await sha(await replayed(steps))).toBe(await sha(state.doc));
    expect(validateSlidesDocument(state.doc).ok).toBe(true);
  });

  it("a block made after the first keystroke is found by slot, so two quick keystrokes make one block", async () => {
    const id = first(start());
    const { state } = await play(start(), (s) => setBlockText(s, id, "title", null, "A", ID(1)), (s) => setBlockText(s, id, "title", null, "AB", ID(2)));
    expect(state.doc.slides[0]!.blocks).toHaveLength(1);
    expect(state.doc.slides[0]!.blocks[0]).toMatchObject({ id: ID(1), text: "AB" });
  });

  it("text with trailing white space is stored trimmed, never refused, and an empty field removes the block", async () => {
    const id = first(start());
    const { state } = await play(start(), (s) => setBlockText(s, id, "title", null, "Naslov  ", ID(1)));
    expect(state.refusal).toBeNull();
    expect(state.doc.slides[0]!.blocks[0]).toMatchObject({ text: "Naslov" });
    const cleared = await setBlockText(state, id, "title", ID(1), "", ID(9));
    expect(cleared.state.doc.slides[0]!.blocks).toEqual([]);
    expect(cleared.steps.map((step) => step.type)).toEqual(["blockRemove"]);
  });

  it("a refused change leaves the document as it was and says why (too long, forbidden character)", async () => {
    const id = first(start());
    const long = await setBlockText(start(), id, "title", null, "x".repeat(201), ID(1));
    expect(long.steps).toEqual([]);
    expect(long.state.refusal).toBe("result_invalid");
    expect(long.state.doc).toEqual(start().doc);
    const control = await setBlockText(start(), id, "body", null, "a\u0000b", ID(1));
    expect(control.state.refusal).toBe("result_invalid");
  });

  it("undo and redo are steps of their own and walk the document back and forth", async () => {
    const id = first(start());
    const { state, steps } = await play(start(), (s) => setBlockText(s, id, "title", null, "Naslov", ID(1)), (s) => addSlide(s, "twoColumns", ID(2)));
    expect(state.doc.slides).toHaveLength(2);
    expect(state.selectedId).toBe(ID(2));
    const back = await undo(state);
    expect(back.state.doc.slides).toHaveLength(1);
    expect(back.steps.map((step) => step.type)).toEqual(["slideRemove"]);
    const again = await redo(back.state);
    expect(await sha(again.state.doc)).toBe(await sha(state.doc));
    // The whole record (changes and their takings back) still replays to what is shown.
    const record = [...steps, ...back.steps, ...again.steps];
    expect(await sha(await replayed(record))).toBe(await sha(again.state.doc));
    // Undo twice reaches revision 0 and a third undo does nothing.
    const zero = await undo((await undo(again.state)).state);
    expect(await sha(zero.state.doc)).toBe(await sha(slidesRevisionZeroDocument()));
    expect((await undo(zero.state)).steps).toEqual([]);
  });

  it("typing in one field is one undo entry; a new change after undo clears redo", async () => {
    const id = first(start());
    const { state } = await play(start(), (s) => setBlockText(s, id, "title", null, "A", ID(1)), (s) => setBlockText(s, id, "title", null, "AB", ID(2)), (s) => setBlockText(s, id, "title", null, "ABC", ID(3)));
    expect(state.past).toHaveLength(1);
    const back = await undo(state);
    expect(back.state.doc.slides[0]!.blocks).toEqual([]);
    const forked = await setNotes(back.state, id, "Bilješka");
    expect(forked.state.future).toEqual([]);
  });

  it("removing a slide keeps its content for undo; the last slide is never removed", async () => {
    const id = first(start());
    const filled = await play(start(), (s) => setBlockText(s, id, "title", null, "Naslov", ID(1)), (s) => setNotes(s, id, "Bilješka"), (s) => addSlide(s, "titleContent", ID(2)));
    const removed = await removeSlide(filled.state, id);
    expect(removed.state.doc.slides.map((x) => x.id)).toEqual([ID(2)]);
    const restored = await undo(removed.state);
    expect(await sha(restored.state.doc)).toBe(await sha(filled.state.doc));
    const last = await removeSlide(removed.state, ID(2));
    expect(last.state.refusal).toBe("last_slide");
    expect(last.steps).toEqual([]);
    expect((await removeSlide(filled.state, ID(77))).state.refusal).toBe("unknown_slide");
  });

  it("moving a slide moves it by one place, not past the ends, and undo puts it back", async () => {
    const id = first(start());
    const two = await play(start(), (s) => addSlide(s, "titleContent", ID(2)), (s) => addSlide(s, "titleContent", ID(3)));
    expect(two.state.doc.slides.map((x) => x.id)).toEqual([id, ID(2), ID(3)]);
    const up = await moveSlide(two.state, ID(3), -1);
    expect(up.state.doc.slides.map((x) => x.id)).toEqual([id, ID(3), ID(2)]);
    expect((await moveSlide(two.state, id, -1)).steps).toEqual([]);
    expect((await moveSlide(two.state, ID(3), 1)).steps).toEqual([]);
    expect((await undo(up.state)).state.doc.slides.map((x) => x.id)).toEqual([id, ID(2), ID(3)]);
  });

  it("a layout is only offered when no block loses its place; an unfit one is refused by the steps too", async () => {
    const id = first(start());
    const { state } = await play(start(), (s) => setBlockText(s, id, "body", null, "Sadržaj", ID(1)));
    expect(compatibleLayouts(selectedSlide(state))).toEqual(["titleContent"]);
    const refused = await setLayout(state, id, "twoColumns");
    expect(refused.state.refusal).toBe("target_invalid");
    expect(refused.state.doc.slides[0]!.layout).toBe("titleContent");
    const empty = start();
    expect(compatibleLayouts(selectedSlide(empty))).toHaveLength(4);
    expect((await setLayout(empty, id, "title")).state.doc.slides[0]!.layout).toBe("title");
    expect((await setLayout(empty, id, "titleContent")).steps).toEqual([]);
  });

  it("blocks keep the order of the layout's places however they are typed", async () => {
    const id = first(start());
    const { state } = await play(start(), (s) => setLayout(s, id, "twoColumns").then((o) => o), (s) => setBlockText(s, id, "right", null, "D", ID(1)), (s) => setBlockText(s, id, "title", null, "T", ID(2)), (s) => setBlockText(s, id, "left", null, "L", ID(3)));
    expect(state.doc.slides[0]!.blocks.map((b) => b.slot)).toEqual(["title", "left", "right"]);
    expect(validateSlidesDocument(state.doc).ok).toBe(true);
  });

  it("list items are edited in place; an empty item is refused, not repaired", async () => {
    const doc: SlidesDocument = {
      ...slidesRevisionZeroDocument(),
      slides: [{ id: ID(5), layout: "titleContent", blocks: [{ type: "list", id: ID(6), slot: "body", items: ["jedan", "dva"] }] }],
    };
    const s0 = createEditorState(doc);
    const edited = await setListItem(s0, ID(5), ID(6), 1, "dvije");
    expect(edited.state.doc.slides[0]!.blocks[0]).toMatchObject({ items: ["jedan", "dvije"] });
    expect(edited.steps[0]).toMatchObject({ type: "textEdit", item: 1 });
    const empty = await setListItem(s0, ID(5), ID(6), 0, "");
    expect(empty.state.refusal).toBe("result_invalid");
    expect(empty.state.doc).toEqual(doc);
    expect((await setListItem(s0, ID(5), ID(6), 9, "x")).state.refusal).toBe("target_invalid");
  });

  it("notes: set, change, and empty notes are removed (never an empty string)", async () => {
    const id = first(start());
    const set = await setNotes(start(), id, "Prva");
    const changed = await setNotes(set.state, id, "Druga");
    const removed = await setNotes(changed.state, id, "  ");
    expect(removed.state.doc.slides[0]!).not.toHaveProperty("notes");
    expect(removed.steps.map((step) => step.type)).toEqual(["notesRemove"]);
    // Consecutive edits of one field are one undo entry, so undo goes back to before the first one.
    expect(removed.state.past).toHaveLength(1);
    expect((await undo(removed.state)).state.doc.slides[0]!).not.toHaveProperty("notes");
    // After another change in between, removing the notes undoes to the notes as they were.
    const between = await play(set.state, (s) => setBlockText(s, id, "title", null, "T", ID(1)), (s) => setNotes(s, id, ""));
    expect((await undo(between.state)).state.doc.slides[0]!.notes).toBe("Prva");
    expect((await setNotes(start(), id, "")).steps).toEqual([]);
  });

  it("textRange works on code points, not UTF-16 units", () => {
    expect(textRange("a😀c", "a😀😀c")).toEqual({ from: 2, to: 2, insert: "😀", removed: "" });
    expect(textRange("abc", "abc")).toBeNull();
    expect(textRange("abc", "")).toEqual({ from: 0, to: 3, insert: "", removed: "abc" });
    expect(documentText("  Á \r\nB ")).toBe("Á \nB");
  });
});
