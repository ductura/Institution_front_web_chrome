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
 * Typing, the keymap, undo and redo, the browser's spelling suggestions, the
 * Literatura form, find and replace, deleting and formatting always pass, and
 * so do the application's own transactions (appended, or marked with
 * EXAM_MODE_APP).
 *
 * Known limit: keys sent through the Chrome DevTools Protocol (an extension
 * with chrome.debugger) or by a program outside the browser are trusted keys
 * and pass (red-team kanali.spec.ts, redteam.spec.ts). Only the desktop app
 * can tell those apart (P-3).
 */

import { Extension } from "@tiptap/core";
import { isHistoryTransaction } from "@tiptap/pm/history";
import { Plugin, PluginKey, type EditorState, type Transaction } from "@tiptap/pm/state";
import { ReplaceAroundStep, ReplaceStep } from "@tiptap/pm/transform";

import type { EvidenceSource } from "../document/forensics/evidence-segment-v2";
import { CITATION_FORM_META, FIND_REPLACE_META, sourceOfChange, type SourceObserver } from "./source";

/** Meta for a transaction the application itself makes (loading a work, a server version). */
export const EXAM_MODE_APP = new PluginKey<boolean>("examModeApp");

export type ExamRefusal = "pasted-from-outside" | "dropped" | "keyless-input" | "program";

export type ExamContext = Readonly<{
  insertsText: boolean;
  /** The pasted text is text copied or cut in this work. */
  internalPaste: boolean;
  accommodation: boolean;
  /** A trusted key was pressed in the same task (composition made with keys). */
  keyInTask: boolean;
  /** Undo/redo, an appended or application transaction, the Literatura form or find and replace. */
  trustedByApp: boolean;
}>;

/** Whether exam mode refuses a change of this source, and why; null lets it in. Pure. */
export function examDecision(source: EvidenceSource, ctx: ExamContext): ExamRefusal | null {
  if (!ctx.insertsText || ctx.trustedByApp) return null;
  switch (source) {
    case "editor":
    case "system-replacement":
    case "citation-form":
    case "cut":
      return null;
    case "composition":
      return null;
    case "paste":
      return ctx.internalPaste ? null : "pasted-from-outside";
    case "drop":
      return ctx.internalPaste ? null : "dropped";
    case "keyless-input":
      return ctx.accommodation || ctx.keyInTask ? null : "keyless-input";
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
  const plugin = new Plugin({
    key: new PluginKey("examMode"),
    props: {
      handleDOMEvents: {
        copy: (view) => { remember(view.state); return false; },
        cut: (view) => { remember(view.state); return false; },
      },
    },
    filterTransaction: (tr) => {
      if (!tr.docChanged) return true;
      const text = inserted(tr);
      const trustedByApp =
        isHistoryTransaction(tr) ||
        tr.getMeta("appendedTransaction") !== undefined ||
        tr.getMeta(EXAM_MODE_APP) === true ||
        tr.getMeta(CITATION_FORM_META) === true ||
        tr.getMeta(FIND_REPLACE_META) === true;
      const source = sourceOfChange([tr], observer.peek([tr]));
      const refusal = examDecision(source, {
        insertsText: text !== "",
        internalPaste: copied !== null && copied !== "" && text === copied,
        accommodation,
        keyInTask: observer.keyPressedInTask,
        trustedByApp,
      });
      if (refusal === null) return true;
      if (onRefused) setTimeout(() => onRefused(refusal), 0);
      return false;
    },
  });
  return Extension.create({ name: "examMode", addProseMirrorPlugins: () => [plugin] });
}

