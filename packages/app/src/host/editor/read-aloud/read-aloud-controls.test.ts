import { describe, expect, it } from "vitest";
import { Schema } from "@tiptap/pm/model";
import { EditorState, TextSelection } from "@tiptap/pm/state";

import { readAloudEntries } from "./ReadAloudControls";
import { createEditorReading } from "./ReadAloudHost";
import { docRangeOf, readAloudPlugin, READ_ALOUD_KEY, scopeRange, sourceOfScope } from "./highlight";
import type { ReadAloudHost, SpeechUtteranceLike } from "./support";

// WEB-V20-NAGLAS-UREDNIK: invented text; fake speechSynthesis; a plain ProseMirror state stands in for the editor.
const schema = new Schema({
  nodes: {
    doc: { content: "paragraph+" },
    paragraph: { content: "text*", group: "block" },
    text: { group: "inline" },
  },
});
const para = (s: string) => schema.node("paragraph", null, s ? [schema.text(s)] : []);
const doc = schema.node("doc", null, [para("Prva rečenica. Druga rečenica."), para("Treći odlomak."), para("")]);

function fakeEditor(selFrom?: number, selTo?: number) {
  let state = EditorState.create({ doc, plugins: [readAloudPlugin()] });
  if (selFrom !== undefined) state = state.apply(state.tr.setSelection(TextSelection.create(state.doc, selFrom, selTo ?? selFrom)));
  const dispatched: { docChanged: boolean }[] = [];
  const editor = {
    isDestroyed: false,
    get state() { return state; },
    view: { dispatch(tr: never) { dispatched.push({ docChanged: (tr as { docChanged: boolean }).docChanged }); state = state.apply(tr); } },
  };
  return { editor, dispatched, doc: () => state.doc };
}

function fakeSpeech() {
  const spoken: (SpeechUtteranceLike & { text: string })[] = [];
  const calls: string[] = [];
  class Utterance {
    lang = ""; rate = 1; voice = null; onstart: (() => void) | null = null; onend: (() => void) | null = null; onerror: (() => void) | null = null;
    constructor(public text: string) {}
  }
  const host: ReadAloudHost = {
    SpeechSynthesisUtterance: Utterance as never,
    speechSynthesis: {
      speak: (u) => { calls.push("speak"); spoken.push(u as never); },
      cancel: () => calls.push("cancel"), pause: () => calls.push("pause"), resume: () => calls.push("resume"), getVoices: () => [],
    },
  };
  return { host, spoken, calls };
}

describe("what is read", () => {
  it("reads the paragraph with the cursor, the selection, and the whole work with line breaks between blocks", () => {
    const { editor } = fakeEditor(3);
    expect(sourceOfScope(editor.state, "paragraph")?.text).toBe("Prva rečenica. Druga rečenica.");
    expect(sourceOfScope(editor.state, "work")?.text).toBe("Prva rečenica. Druga rečenica.\nTreći odlomak.");
    const sel = fakeEditor(2, 6).editor;
    expect(sourceOfScope(sel.state, "selection")?.text).toBe("rva ");
  });
  it("has no selection range for a collapsed cursor and nothing to read in an empty paragraph", () => {
    const { editor } = fakeEditor(3);
    expect(scopeRange(editor.state, "selection")).toBeNull();
  });
  it("maps a sentence of the read text back to document positions", () => {
    const { editor } = fakeEditor(3);
    const source = sourceOfScope(editor.state, "work")!;
    const range = docRangeOf(source, 15, 29)!;
    expect(editor.state.doc.textBetween(range.from, range.to)).toBe("Druga rečenica");
    const second = docRangeOf(source, 31, 45)!;
    expect(editor.state.doc.textBetween(second.from, second.to)).toBe("Treći odlomak.");
  });
});

describe("reading in the editor", () => {
  it("reading a selection does not change the document and never dispatches a document change", () => {
    const { editor, dispatched, doc: now } = fakeEditor(2, 6);
    const before = now();
    const { host, spoken } = fakeSpeech();
    const reading = createEditorReading(editor as never, host);
    expect(reading.read("selection")).toBe(true);
    expect(spoken.map((u) => u.text)).toEqual(["rva"]);
    spoken[0]!.onstart?.();
    expect(READ_ALOUD_KEY.getState(editor.state)!.find().length).toBe(1);
    spoken[0]!.onend?.();
    expect(READ_ALOUD_KEY.getState(editor.state)!.find().length).toBe(0);
    expect(now().eq(before)).toBe(true);
    expect(dispatched.length).toBeGreaterThan(0);
    expect(dispatched.every((d) => !d.docChanged)).toBe(true);
  });
  it("highlights the sentence being read and clears it when stopped", () => {
    const { editor } = fakeEditor(3);
    const { host, spoken, calls } = fakeSpeech();
    const reading = createEditorReading(editor as never, host);
    reading.read("paragraph");
    spoken[0]!.onstart?.();
    const found = READ_ALOUD_KEY.getState(editor.state)!.find()[0]!;
    expect(editor.state.doc.textBetween(found.from, found.to)).toBe("Prva rečenica.");
    reading.pause();
    expect(reading.snapshot().state).toBe("paused");
    reading.resume();
    reading.stop(); // what Escape does
    expect(calls).toContain("cancel");
    expect(reading.snapshot()).toMatchObject({ state: "idle", notice: "stopped" });
    expect(READ_ALOUD_KEY.getState(editor.state)!.find().length).toBe(0);
  });
  it("wakes a paused synthesiser when a new reading starts or the paused one is stopped", () => {
    const { editor } = fakeEditor(3);
    const { host, calls } = fakeSpeech();
    const reading = createEditorReading(editor as never, host);
    reading.read("paragraph");
    reading.pause();
    reading.read("work"); // another scope while paused
    expect(calls.slice(calls.indexOf("pause"))).toEqual(["pause", "cancel", "resume", "speak"]);
    reading.pause();
    calls.length = 0;
    reading.stop();
    expect(calls).toEqual(["cancel", "resume"]);
  });
  it("shows a message, not an error, in an unsupported browser", () => {
    const { editor } = fakeEditor(3);
    const reading = createEditorReading(editor as never, {});
    expect(reading.snapshot()).toMatchObject({ state: "unsupported", notice: "unsupported" });
    expect(reading.read("work")).toBe(false);
    expect(reading.snapshot().notice).toBe("unsupported");
    expect(readAloudEntries("unsupported").filter((e) => e.kind === "item").every((e) => (e as { disabled?: boolean }).disabled)).toBe(true);
  });
  it("says there is no text for an empty selection or paragraph and speaks nothing", () => {
    const { host, spoken } = fakeSpeech();
    const collapsed = createEditorReading(fakeEditor(3).editor as never, host);
    expect(collapsed.read("selection")).toBe(false);
    expect(collapsed.snapshot().notice).toBe("noSelection");
    const emptyPara = createEditorReading(fakeEditor(doc.content.size - 1).editor as never, host);
    expect(emptyPara.read("paragraph")).toBe(false);
    expect(emptyPara.snapshot().notice).toBe("noText");
    expect(spoken).toEqual([]);
  });
  it("offers pause only while reading, resume only while paused", () => {
    const ids = (s: Parameters<typeof readAloudEntries>[0]) => readAloudEntries(s).filter((e) => e.kind === "item" && !(e as { disabled?: boolean }).disabled).map((e) => (e as { id: string }).id);
    expect(ids("idle")).toEqual(["paragraph", "selection", "work"]);
    expect(ids("reading")).toEqual(["paragraph", "selection", "work", "pause", "stop"]);
    expect(ids("paused")).toEqual(["paragraph", "selection", "work", "resume", "stop"]);
  });
});
