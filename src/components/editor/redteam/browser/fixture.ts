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

type Harness = {
  ready: boolean;
  sources(): string[];
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
let ready = false;

editor.on("transaction", ({ transaction, appendedTransactions }) => {
  const all = [transaction, ...appendedTransactions];
  const seen = observer.take(all);
  // What the editor does to itself while it is created is not a change of the author.
  if (!ready || !all.some((tr) => tr.docChanged)) return;
  sources.push(sourceOfChange(all, seen));
});

const harness: Harness = {
  ready: false,
  sources: () => [...sources],
  text: () => editor.getText(),
  scripted: (text) => { editor.commands.insertContent(text); },
};
window.__source = harness;
editor.on("create", () => { ready = true; harness.ready = true; });
