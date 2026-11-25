"use client";

// WEB-V21-STEM-FORMULA-UREDNIK: the formula in the student's editor. `useFormulaHost` draws the formula
// atoms (KaTeX), opens the dialog of WEB-V21-STEM-FORMULA-DIJALOG for "Formula…" and on a double click, and
// applies the result to the document through formula-commands. Document only: nothing is written to the
// server here beyond what the editor's own syncing already does.
import type { Editor } from "@tiptap/core";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { setupOf } from "../rules/rules-model.ts";
import { DEFAULT_PROFILE_ID, profileById, type ToolKey } from "../rules/profiles.ts";
import { FormulaDialog, type FormulaDialogResult } from "./FormulaDialog.tsx";
import { insertFormula, updateFormula } from "./formula-commands.ts";
import { formulaAvailability, formulaViewPlugin, formulaViewKey, supportsFormulas, type FormulaAvailability, type FormulaTarget } from "./formula-view.ts";
import type { FormulaKind } from "./limits.ts";

/** The tools of the field the work is written for; the general academic profile (no tools) until the assignment names one. */
export function defaultFormulaTools(): readonly ToolKey[] {
  const profile = profileById(DEFAULT_PROFILE_ID);
  return profile ? setupOf(profile).tools : [];
}

type Session = { kind: FormulaKind; pos: number | null; tex: string };

export type FormulaHostApi = {
  availability: FormulaAvailability;
  /** Opens the dialog for a new formula; false when the menu item is off. */
  open: (kind: FormulaKind) => boolean;
  dialog: ReactNode;
};

export function useFormulaHost(
  editor: Editor | null, schemaVersion: number | undefined, tools: readonly ToolKey[] = defaultFormulaTools(),
): FormulaHostApi {
  const live = !!editor && !editor.isDestroyed;
  const availability: FormulaAvailability = live
    ? formulaAvailability(editor.schema, schemaVersion, tools, editor.isEditable)
    : { enabled: false, reason: "" };
  const [session, setSession] = useState<Session | null>(null);
  const available = useRef(availability.enabled);
  available.current = availability.enabled;
  const supported = live && supportsFormulas(editor.schema, schemaVersion);

  useEffect(() => {
    if (!editor || editor.isDestroyed || !supported) return;
    editor.registerPlugin(formulaViewPlugin(
      (target: FormulaTarget) => setSession({ kind: target.kind, pos: target.pos, tex: target.tex }),
      () => available.current,
    ));
    return () => { if (!editor.isDestroyed) editor.unregisterPlugin(formulaViewKey); };
  }, [editor, supported]);

  const open = useCallback((kind: FormulaKind) => {
    if (!available.current) return false;
    setSession({ kind, pos: null, tex: "" });
    return true;
  }, []);

  const confirm = (result: FormulaDialogResult): boolean => {
    if (!session) return false;
    const applied = session.pos === null
      ? insertFormula(editor, result.kind, result.tex)
      : updateFormula(editor, session.pos, result.kind, result.tex);
    if (applied) { setSession(null); editor?.commands.focus(); }
    return applied;
  };

  const dialog = session
    ? <FormulaDialog open kind={session.kind} initialTex={session.tex} onConfirm={confirm}
        onClose={() => { setSession(null); editor?.commands.focus(); }} />
    : null;
  return { availability, open, dialog };
}
