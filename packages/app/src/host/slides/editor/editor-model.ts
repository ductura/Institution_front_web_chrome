// WEB-V13-UREDNIK (val 13): the pure state of the slides editor. No React, no
// I/O, no clock. Every change of the document is built as steps of
// `ductus-slide-steps-v1` and applied through `applySlideSteps` of the model
// mirror, so the editor can never show a document the server's validator would
// refuse. Undo and redo are steps too (the inverse of a change is applied as a
// new change); nothing is ever taken back by rewinding the record.
import {
  LAYOUT_SLOTS,
  MAX_ALT_CODE_POINTS,
  MAX_HEADING_CODE_POINTS,
  MAX_LIST_ITEM_CODE_POINTS,
  MAX_NOTES_CODE_POINTS,
  MAX_SLIDE_STEPS_BYTES,
  MAX_SLIDE_STEPS_PER_EVENT,
  MAX_SLIDE_PARAGRAPH_CODE_POINTS,
  SLIDE_LAYOUTS,
  applySlideSteps,
  slideNodeSha256,
  slideTextSha256,
  type ApplySlideStepErrorCode,
  type Slide,
  type SlideBlock,
  type SlideLayout,
  type SlideSlot,
  type SlideStep,
  type SlidesDocument,
} from "../../../../../editor-core/src/slides/index.ts";

/** One change as the steps that make it and the steps that take it back. */
export type Command = {
  forward: SlideStep[];
  inverse: SlideStep[];
  /** Consecutive commands with the same key are one undo entry (typing in one field). */
  key?: string;
};

/** Why a change was not made; the document is unchanged. */
export type Refusal = ApplySlideStepErrorCode | "last_slide" | "unknown_slide" | "failed";

export type EditorState = {
  doc: SlidesDocument;
  selectedId: string;
  past: Command[];
  future: Command[];
  refusal: Refusal | null;
  /** Counts undo and redo, so a field that holds a draft is rebuilt from the document. */
  epoch: number;
};

/** The new state and the steps this call added to the record (empty when nothing changed). */
export type Outcome = { state: EditorState; steps: SlideStep[] };

export function createEditorState(doc: SlidesDocument): EditorState {
  return { doc, selectedId: doc.slides[0]!.id, past: [], future: [], refusal: null, epoch: 0 };
}

export function selectedSlide(state: EditorState): Slide {
  return state.doc.slides.find((slide) => slide.id === state.selectedId) ?? state.doc.slides[0]!;
}

export function selectSlide(state: EditorState, slideId: string): EditorState {
  if (!state.doc.slides.some((slide) => slide.id === slideId)) return state;
  return { ...state, selectedId: slideId, refusal: null };
}

const unchanged = (state: EditorState): Outcome => ({ state, steps: [] });
const refused = (state: EditorState, refusal: Refusal): Outcome => ({ state: { ...state, refusal }, steps: [] });

const points = (text: string): string[] => Array.from(text);

/** Applies a command; on success it becomes the latest undo entry (merged when it shares a key). */
async function perform(state: EditorState, command: Command, selectedId?: string): Promise<Outcome> {
  const applied = await applySlideSteps(state.doc, command.forward);
  if (!applied.ok) return refused(state, applied.error);
  const last = state.past[state.past.length - 1];
  const merged: Command | null =
    command.key !== undefined && last?.key === command.key && fitsOneEvent(last, command)
      ? { key: command.key, forward: [...last.forward, ...command.forward], inverse: [...command.inverse, ...last.inverse] }
      : null;
  const past = merged === null ? [...state.past, command] : [...state.past.slice(0, -1), merged];
  const next: EditorState = { ...state, doc: applied.doc, past, future: [], refusal: null };
  return { state: { ...next, selectedId: keepSelection(applied.doc, selectedId ?? state.selectedId, state) }, steps: command.forward };
}

/** A merged command stays one event of the step format: within its step and byte limits (half the byte limit, as steps carry hashes too). */
function fitsOneEvent(a: Command, b: Command): boolean {
  const steps = (c: Command) => Math.max(c.forward.length, c.inverse.length);
  if (steps(a) + steps(b) > MAX_SLIDE_STEPS_PER_EVENT) return false;
  return JSON.stringify([a.forward, a.inverse, b.forward, b.inverse]).length <= MAX_SLIDE_STEPS_BYTES / 2;
}

/** The selected slide if it still exists, else the slide that took its place. */
function keepSelection(doc: SlidesDocument, wanted: string, before: EditorState): string {
  if (doc.slides.some((slide) => slide.id === wanted)) return wanted;
  const was = before.doc.slides.findIndex((slide) => slide.id === wanted);
  return doc.slides[Math.min(Math.max(was, 0), doc.slides.length - 1)]!.id;
}

/** The steps that put a removed slide back: the slide, its blocks, its notes. */
function restoreSlide(slide: Slide, index: number): SlideStep[] {
  const steps: SlideStep[] = [{ type: "slideAdd", slideId: slide.id, layout: slide.layout, index }];
  slide.blocks.forEach((block, at) => steps.push({ type: "blockSet", slideId: slide.id, index: at, block: structuredClone(block) }));
  if (slide.notes !== undefined) steps.push({ type: "notesSet", slideId: slide.id, notes: slide.notes });
  return steps;
}

/** Adds an empty slide after the selected one and selects it. `id` is a fresh UUID v4. */
export async function addSlide(state: EditorState, layout: SlideLayout, id: string): Promise<Outcome> {
  const at = state.doc.slides.findIndex((slide) => slide.id === state.selectedId) + 1;
  const empty: Slide = { id, layout, blocks: [] };
  return perform(
    state,
    {
      forward: [{ type: "slideAdd", slideId: id, layout, index: at }],
      inverse: [{ type: "slideRemove", slideId: id, removedSha256: await slideNodeSha256(empty) }],
    },
    id,
  );
}

/** Removes a slide. The last slide is never removed: a deck has at least one. */
export async function removeSlide(state: EditorState, slideId: string): Promise<Outcome> {
  const index = state.doc.slides.findIndex((slide) => slide.id === slideId);
  if (index === -1) return refused(state, "unknown_slide");
  if (state.doc.slides.length === 1) return refused(state, "last_slide");
  const slide = state.doc.slides[index]!;
  return perform(state, {
    forward: [{ type: "slideRemove", slideId, removedSha256: await slideNodeSha256(slide) }],
    inverse: restoreSlide(slide, index),
  });
}

/** Moves a slide by `delta` places (-1 up, +1 down); beyond either end nothing happens. */
export async function moveSlide(state: EditorState, slideId: string, delta: number): Promise<Outcome> {
  const from = state.doc.slides.findIndex((slide) => slide.id === slideId);
  if (from === -1) return refused(state, "unknown_slide");
  const to = from + delta;
  if (to < 0 || to >= state.doc.slides.length || to === from) return unchanged(state);
  return perform(state, {
    forward: [{ type: "slideMove", slideId, toIndex: to }],
    inverse: [{ type: "slideMove", slideId, toIndex: from }],
  });
}

/** Layouts a slide can take without dropping a block: every block's slot is in the new layout. */
export function compatibleLayouts(slide: Slide): SlideLayout[] {
  return SLIDE_LAYOUTS.filter((layout) =>
    slide.blocks.every((block) => (LAYOUT_SLOTS[layout] as readonly SlideSlot[]).includes(block.slot)),
  );
}

export async function setLayout(state: EditorState, slideId: string, layout: SlideLayout): Promise<Outcome> {
  const slide = state.doc.slides.find((candidate) => candidate.id === slideId);
  if (slide === undefined) return refused(state, "unknown_slide");
  if (slide.layout === layout) return unchanged(state);
  return perform(state, {
    forward: [{ type: "layoutSet", slideId, layout }],
    inverse: [{ type: "layoutSet", slideId, layout: slide.layout }],
  });
}

/** Text with the ends the document allows: NFC and no white space at either end. */
export function documentText(raw: string): string {
  return raw.normalize("NFC").replace(/^\s+|\s+$/gu, "").replace(/\r\n?/gu, "\n");
}

/** The smallest replaced range, in code points, that turns `before` into `after`. */
export function textRange(before: string, after: string): { from: number; to: number; insert: string; removed: string } | null {
  const a = points(before);
  const b = points(after);
  let head = 0;
  while (head < a.length && head < b.length && a[head] === b[head]) head += 1;
  let tail = 0;
  while (tail < a.length - head && tail < b.length - head && a[a.length - 1 - tail] === b[b.length - 1 - tail]) tail += 1;
  if (head === a.length && head === b.length) return null;
  return { from: head, to: a.length - tail, insert: b.slice(head, b.length - tail).join(""), removed: a.slice(head, a.length - tail).join("") };
}

async function textEditCommand(slideId: string, blockId: string, item: number | undefined, before: string, after: string, key: string): Promise<Command | null> {
  const range = textRange(before, after);
  if (range === null) return null;
  const at = item === undefined ? {} : { item };
  const insertedLength = points(range.insert).length;
  const forward: SlideStep = {
    type: "textEdit", slideId, blockId, ...at, from: range.from, to: range.to, insert: range.insert,
    ...(range.from < range.to ? { removedSha256: await slideTextSha256(range.removed) } : {}),
  };
  const inverse: SlideStep = {
    type: "textEdit", slideId, blockId, ...at, from: range.from, to: range.from + insertedLength, insert: range.removed,
    ...(insertedLength > 0 ? { removedSha256: await slideTextSha256(range.insert) } : {}),
  };
  return { forward: [forward], inverse: [inverse], key };
}

/** Where a block of `slot` goes among the slide's blocks: after every block of an earlier slot (and of the same slot). */
function blockIndex(slide: Slide, slot: SlideSlot): number {
  const order = LAYOUT_SLOTS[slide.layout] as readonly SlideSlot[];
  const rank = order.indexOf(slot);
  return slide.blocks.filter((block) => order.indexOf(block.slot) <= rank).length;
}

export function slotBlockType(slot: SlideSlot): "heading" | "paragraph" {
  return slot === "title" ? "heading" : "paragraph";
}

/**
 * Sets the text of the text block of a slot. Empty text removes the block (a
 * block never holds empty text); text in a slot without a block creates the
 * block with `newBlockId` (a fresh UUID v4). Editing a block that exists is a
 * `textEdit` of the smallest changed range.
 */
export async function setBlockText(
  state: EditorState,
  slideId: string,
  slot: SlideSlot,
  blockId: string | null,
  raw: string,
  newBlockId: string,
): Promise<Outcome> {
  const slide = state.doc.slides.find((candidate) => candidate.id === slideId);
  if (slide === undefined) return refused(state, "unknown_slide");
  const target = documentText(raw);
  // `null` means "the slot's text block, if it has one by now": a second keystroke can run before the render that shows the block the first one made.
  const inSlot = slide.blocks.find((candidate) => candidate.slot === slot && (candidate.type === "heading" || candidate.type === "paragraph"));
  // An id the slide no longer has (the block was cleared and made again by an earlier queued edit) means the slot's block now.
  const block = (blockId === null ? undefined : slide.blocks.find((candidate) => candidate.id === blockId)) ?? inSlot;
  if (block === undefined) {
    if (target === "") return unchanged(state);
    const created = { type: slotBlockType(slot), id: newBlockId, slot, text: target } as SlideBlock;
    return perform(state, {
      forward: [{ type: "blockSet", slideId, index: blockIndex(slide, slot), block: created }],
      inverse: [{ type: "blockRemove", slideId, blockId: newBlockId, removedSha256: await slideNodeSha256(created) }],
      key: `text:${slideId}:${newBlockId}`,
    });
  }
  if (block.type !== "heading" && block.type !== "paragraph") return refused(state, "target_invalid");
  const key = `text:${slideId}:${block.id}`;
  if (target === "") {
    return perform(state, {
      forward: [{ type: "blockRemove", slideId, blockId: block.id, removedSha256: await slideNodeSha256(block) }],
      inverse: [{ type: "blockSet", slideId, index: slide.blocks.indexOf(block), block: structuredClone(block) }],
      key,
    });
  }
  const command = await textEditCommand(slideId, block.id, undefined, block.text, target, key);
  return command === null ? unchanged(state) : perform(state, command);
}

/** Sets one item of an existing list block; an item is never empty (an empty one is refused, not repaired). */
export async function setListItem(state: EditorState, slideId: string, blockId: string, item: number, raw: string): Promise<Outcome> {
  const slide = state.doc.slides.find((candidate) => candidate.id === slideId);
  const block = slide?.blocks.find((candidate) => candidate.id === blockId);
  if (slide === undefined || block === undefined) return refused(state, "unknown_slide");
  if (block.type !== "list" || block.items[item] === undefined) return refused(state, "target_invalid");
  const command = await textEditCommand(slideId, blockId, item, block.items[item]!, documentText(raw), `text:${slideId}:${blockId}:${item}`);
  return command === null ? unchanged(state) : perform(state, command);
}

/** Sets the speaker notes; empty notes remove them (notes are never an empty string). */
export async function setNotes(state: EditorState, slideId: string, raw: string): Promise<Outcome> {
  const slide = state.doc.slides.find((candidate) => candidate.id === slideId);
  if (slide === undefined) return refused(state, "unknown_slide");
  const target = documentText(raw);
  const key = `notes:${slideId}`;
  if (slide.notes === undefined) {
    if (target === "") return unchanged(state);
    return perform(state, {
      forward: [{ type: "notesSet", slideId, notes: target }],
      inverse: [{ type: "notesRemove", slideId, removedSha256: await slideTextSha256(target) }],
      key,
    });
  }
  if (target === slide.notes) return unchanged(state);
  if (target === "") {
    return perform(state, {
      forward: [{ type: "notesRemove", slideId, removedSha256: await slideTextSha256(slide.notes) }],
      inverse: [{ type: "notesSet", slideId, notes: slide.notes }],
      key,
    });
  }
  return perform(state, {
    forward: [{ type: "notesSet", slideId, notes: target }],
    inverse: [{ type: "notesSet", slideId, notes: slide.notes }],
    key,
  });
}

/** Undo: the inverse of the latest change is applied as new steps. */
export async function undo(state: EditorState): Promise<Outcome> {
  const command = state.past[state.past.length - 1];
  if (command === undefined) return unchanged(state);
  const applied = await applySlideSteps(state.doc, command.inverse);
  if (!applied.ok) return refused(state, applied.error);
  const next: EditorState = {
    ...state, doc: applied.doc, past: state.past.slice(0, -1), future: [command, ...state.future], refusal: null, epoch: state.epoch + 1,
  };
  return { state: { ...next, selectedId: keepSelection(applied.doc, firstSlideOf(command.inverse) ?? state.selectedId, state) }, steps: command.inverse };
}

export async function redo(state: EditorState): Promise<Outcome> {
  const command = state.future[0];
  if (command === undefined) return unchanged(state);
  const applied = await applySlideSteps(state.doc, command.forward);
  if (!applied.ok) return refused(state, applied.error);
  const next: EditorState = {
    ...state, doc: applied.doc, past: [...state.past, command], future: state.future.slice(1), refusal: null, epoch: state.epoch + 1,
  };
  return { state: { ...next, selectedId: keepSelection(applied.doc, firstSlideOf(command.forward) ?? state.selectedId, state) }, steps: command.forward };
}

/** The slide a command works on, so undo and redo show the slide that changed. */
function firstSlideOf(steps: readonly SlideStep[]): string | null {
  return steps[0]?.slideId ?? null;
}

/** The limits a field enforces before the validator would (a hint, never the check). */
export const FIELD_LIMITS = {
  heading: MAX_HEADING_CODE_POINTS,
  paragraph: MAX_SLIDE_PARAGRAPH_CODE_POINTS,
  listItem: MAX_LIST_ITEM_CODE_POINTS,
  notes: MAX_NOTES_CODE_POINTS,
  alt: MAX_ALT_CODE_POINTS,
} as const;

/** The label of a slide in the list: its title, else "Slajd n" (the caller adds the number). */
export function slideTitle(slide: Slide): string | null {
  const title = slide.blocks.find((block) => block.slot === "title" && block.type === "heading");
  return title !== undefined && title.type === "heading" ? title.text : null;
}
