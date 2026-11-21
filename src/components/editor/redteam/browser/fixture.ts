/**
 * Red-team "AI tipkač" fixture: the student editor with the extensions
 * `LocalDocument` gives it, the production `SourceObserver` included, on a
 * bare page. Each change that edits the document gets the source the
 * production code would record for it (`take` + `sourceOfChange`, as
 * `recordWithSource` does); the page keeps only that list. Never shipped.
 */

import { Editor } from "@tiptap/core";

import {
  ArrowCollapse, ChapterNumbers, createEditorExtensions, sourceOfChange, SourceObserver, StorableInput,
} from "../../../../../packages/editor-core/src/editor";
import {
  changeShape, entersRhythm, InputRhythm, reviewFlags, type Burst, type ReviewFlag,
} from "../../../../../packages/editor-core/src/editor/review-signals";

type Harness = {
  ready: boolean;
  sources(): string[];
  /** P-2 proposal: bursts and review flags of the author's changes. */
  bursts(): Burst[];
  flags(): ReviewFlag[];
  text(): string;
  /** A change made by a script through the editor's own API, with no DOM event. */
  scripted(text: string): void;
};

declare global {
  interface Window { __source?: Harness }
}

const observer = new SourceObserver();
const editor = new Editor({
  element: document.querySelector<HTMLElement>("#editor"),
  extensions: [...createEditorExtensions(""), StorableInput, ArrowCollapse, ChapterNumbers, observer.extension],
});

const sources: string[] = [];
const rhythm = new InputRhythm();
let frontier = 0;
let selectionWasEmpty = true;
let ready = false;

editor.on("transaction", ({ transaction, appendedTransactions }) => {
  const all = [transaction, ...appendedTransactions];
  const seen = observer.take(all);
  // What the editor does to itself while it is created is not a change of the author.
  if (!ready || !all.some((tr) => tr.docChanged)) {
    selectionWasEmpty = editor.state.selection.empty;
    return;
  }
  const source = sourceOfChange(all, seen);
  sources.push(source);
  // Only typing is rhythm; dictation and on-screen keyboards never are (P-2 §4).
  if (entersRhythm(source)) {
    const shape = changeShape(all, frontier, selectionWasEmpty);
    frontier = shape.frontier;
    rhythm.record({ at: performance.now(), inserted: shape.inserted, removed: shape.removed, wentBack: shape.wentBack });
  }
  selectionWasEmpty = editor.state.selection.empty;
});

const harness: Harness = {
  ready: false,
  sources: () => [...sources],
  bursts: () => rhythm.bursts(),
  flags: () => reviewFlags(rhythm.bursts(), { automated: navigator.webdriver === true, rhythmRecorded: true }),
  text: () => editor.getText(),
  scripted: (text) => { editor.commands.insertContent(text); },
};
window.__source = harness;
editor.on("create", () => { ready = true; harness.ready = true; });
