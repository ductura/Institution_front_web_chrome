/**
 * Exam mode (P-4 proposal, docs/ductus/USTAV-DOPUNA-P4.md in ductura/.github,
 * status PRIJEDLOG): for a task the teacher sets so, text that was not typed
 * does not enter the work. The change is refused before it is applied, so
 * nothing is recorded, flagged or held against the student: the editor simply
 * does not take it, and says why.
 *
 * Built and tested on invented input only; not wired into the product until
 * the owner confirms P-4.
 *
 * What is refused, only when a change inserts text:
 * - a paste or a drop of text that was not copied in this work;
 * - input without keys (dictation, an on-screen keyboard, a script or an
 *   extension using insertText), unless the student has an approved
 *   accommodation; composition made with physical keys stays allowed;
 * - a change no trusted event explains (a script, an extension, a program).
 * Typing, the keymap, undo and redo from a trusted key, short spelling
 * suggestions, deleting and formatting pass. The application's own changes
 * (loading, the Literatura form, find and replace, toolbar undo) pass only when
 * it marks them with markAppTransaction, a private WeakSet a page script cannot
 * reach; plain metas are never trusted, since a script can set them.
 *
 * Known limit: keys sent through the Chrome DevTools Protocol (an extension
 * with chrome.debugger) or by a program outside the browser are trusted keys
 * and pass (red-team kanali.spec.ts, redteam.spec.ts). Only the desktop app
 * can tell those apart (P-3).
 */

import { Extension } from "@tiptap/core";
import { redo, undo } from "@tiptap/pm/history";
import { Plugin, PluginKey, type EditorState, type Transaction } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
import { ReplaceAroundStep, ReplaceStep } from "@tiptap/pm/transform";

import type { EvidenceSource } from "../document/forensics/evidence-segment-v2";
import { sourceOfChange, type SourceObserver } from "./source";

/**
 * Transactions the application itself makes (loading a work, a server version, the Literatura form,
 * find and replace, undo and redo from its toolbar). A WeakSet private to this module, never a meta:
 * a meta is a plain string key that a script injected into the page can set on its own transaction
 * (red-team ispitni.spec.ts, "krivotvorenom oznakom").
 */
const appTransactions = new WeakSet<Transaction>();

/** Marks a transaction as the application's own; returns it, for `dispatch(markAppTransaction(tr))`. */
export function markAppTransaction(tr: Transaction): Transaction {
  appTransactions.add(tr);
  return tr;
}

/** Runs undo or redo as the application's own change (for a toolbar button). */
export function examHistory(view: EditorView, which: "undo" | "redo"): boolean {
  const command = which === "undo" ? undo : redo;
  return command(view.state, (tr) => view.dispatch(markAppTransaction(tr)));
}

export type ExamRefusal = "pasted-from-outside" | "dropped" | "keyless-input" | "long-replacement" | "program";

/** A spelling suggestion replaces a word; anything longer through that channel is not a correction. */
export const MAX_REPLACEMENT_CODE_POINTS = 40;

export type ExamContext = Readonly<{
  insertsText: boolean;
  /** Code points the change inserts. */
  insertedLength: number;
  /** The pasted text is text copied or cut in this work. */
  internalPaste: boolean;
  accommodation: boolean;
  /** A trusted key was pressed in the same task. */
  keyInTask: boolean;
  /** A trusted composition (IME, dead keys) produced the change. */
  composing: boolean;
  /** Marked by the application (markAppTransaction), or appended to a change exam mode let in. */
  trustedByApp: boolean;
}>;

/** Whether exam mode refuses a change of this source, and why; null lets it in. Pure. */
export function examDecision(source: EvidenceSource, ctx: ExamContext): ExamRefusal | null {
  if (!ctx.insertsText || ctx.trustedByApp) return null;
  switch (source) {
    case "system-replacement":
      return ctx.insertedLength <= MAX_REPLACEMENT_CODE_POINTS ? null : "long-replacement";
    case "editor":
    case "cut":
      return null;
    // The Literatura form's mark is a meta a script can set: only a transaction the application
    // marked is the form's (trustedByApp, above).
    case "citation-form":
      return "program";
    case "composition":
      return null;
    case "paste":
      return ctx.internalPaste ? null : "pasted-from-outside";
    case "drop":
      return ctx.internalPaste ? null : "dropped";
    case "keyless-input":
      // Composition made with physical keys (dead keys, IME) is typing; a key alone does not make
      // text without a key event typed (a tool answering a real key with a sentence).
      return ctx.accommodation || (ctx.keyInTask && ctx.composing) ? null : "keyless-input";
    default:
      return "program";
  }
}

/** The text a transaction inserts, without block separators. */
function inserted(tr: Transaction): string {
  let text = "";
  for (const step of tr.steps) {
    if (step instanceof ReplaceStep || step instanceof ReplaceAroundStep) {
      text += step.slice.content.textBetween(0, step.slice.content.size, "", "");
    }
  }
  return text;
}

export type ExamModeOptions = {
  observer: SourceObserver;
  /** An approved accommodation (work_accommodation): input without keys is allowed. */
  accommodation?: boolean;
  /** Told after a refusal, outside the transaction, so the interface can say why. */
  onRefused?: (reason: ExamRefusal) => void;
};

/** The exam mode extension; add it after the observer's extension. */
export function createExamMode(options: ExamModeOptions): Extension {
  const { observer, accommodation = false, onRefused } = options;
  // Text copied or cut in this work, kept only as the last copied string and only in memory.
  let copied: string | null = null;
  const remember = (state: EditorState) => {
    const { from, to } = state.selection;
    copied = from < to ? state.doc.textBetween(from, to, "", "") : null;
  };
  // Changes exam mode let in: a transaction appended to one of them is the application's reaction.
  const passed = new WeakSet<Transaction>();
  const plugin = new Plugin({
    key: new PluginKey("examMode"),
    props: {
      // Undo and redo from the keyboard, only on a trusted key: exam mode runs them itself and marks
      // them, so a forged history meta is never taken for undo.
      handleKeyDown: (view, event) => {
        if (!event.isTrusted || !(event.ctrlKey || event.metaKey) || event.altKey) return false;
        const key = event.key.toLowerCase();
        if (key === "z" && !event.shiftKey) return examHistory(view, "undo");
        if ((key === "z" && event.shiftKey) || (key === "y" && !event.shiftKey)) return examHistory(view, "redo");
        return false;
      },
      handleDOMEvents: {
        copy: (view) => { remember(view.state); return false; },
        cut: (view) => { remember(view.state); return false; },
      },
    },
    filterTransaction: (tr) => {
      if (!tr.docChanged) return true;
      const text = inserted(tr);
      const root = tr.getMeta("appendedTransaction") as unknown;
      const trustedByApp =
        appTransactions.has(tr) || (typeof root === "object" && root !== null && passed.has(root as Transaction));
      const observed = observer.peek([tr]);
      const source = sourceOfChange([tr], observed);
      const refusal = examDecision(source, {
        insertsText: text !== "",
        insertedLength: [...text].length,
        internalPaste: copied !== null && copied !== "" && text === copied,
        accommodation,
        keyInTask: observer.keyPressedInTask,
        composing: observed.composing,
        trustedByApp,
      });
      if (refusal === null) { passed.add(tr); return true; }
      if (onRefused) setTimeout(() => onRefused(refusal), 0);
      return false;
    },
  });
  // Below the source observer (100 000), which must still see every key, and above the history
  // keymap, so undo and redo from the keyboard go through exam mode.
  return Extension.create({ name: "examMode", priority: 50_000, addProseMirrorPlugins: () => [plugin] });
}

