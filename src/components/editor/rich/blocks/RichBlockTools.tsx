"use client";

/**
 * Insert and format controls for formula, code block, box and foreign
 * language (E§3.4). The toolbar owner mounts this component where the
 * prototype's "Umetni" and context menus put these items; it keeps no
 * document state of its own, only which dialog is open.
 */

import { Button, Select, TextField } from "@ductura/ui";
import { useEditorState, type Editor } from "@tiptap/react";
import { useState } from "react";

import styles from "./blocks.module.css";
import {
  applyBox, applyLanguage, boxActive, codeBlockActive, formulaTarget, insertCodeBlock, isBoxKind, isCodeLanguage,
  LANGUAGE_CODES, removeBox, removeFormula, saveFormula, setCodeCaption, setCodeLanguage, type FormulaTarget,
  type ForeignLanguage,
} from "./block-commands";
import { FormulaDialog } from "./FormulaDialog";
import { CODE_LANGUAGE_LABELS } from "./code-labels";
import { richBlocksMessages as m } from "./messages.hr";

export function RichBlockTools({ editor, onNotice }: { editor: Editor; onNotice?: (text: string) => void }) {
  const [target, setTarget] = useState<FormulaTarget | null>(null);
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      editable: e.isEditable,
      code: codeBlockActive(e),
      language: (e.getAttributes("codeBlock").language as string | null) ?? "",
      caption: (e.getAttributes("codeBlock").caption as string | null) ?? "",
      box: boxActive(e),
    }),
  });
  const off = !state.editable;
  const options = ["", ...Object.keys(CODE_LANGUAGE_LABELS)].map((value) => ({
    value, label: value === "" ? m.codeNoHighlight : CODE_LANGUAGE_LABELS[value as keyof typeof CODE_LANGUAGE_LABELS],
  }));

  return (
    <div className={styles.tools} role="group" aria-label={m.codeBlock}>
      <Button type="button" tone="quiet" disabled={off} onClick={() => setTarget(formulaTarget(editor, false))}>{m.formulaTitle}</Button>
      <Button type="button" tone="quiet" disabled={off} onClick={() => setTarget(formulaTarget(editor, true))}>{m.inlineFormulaTitle}</Button>
      <Button type="button" tone="quiet" disabled={off} onClick={() => insertCodeBlock(editor)}>{m.codeBlock}</Button>
      <Select label={m.boxTitle} value={state.box ?? ""} disabled={off}
        options={[{ value: "", label: m.boxTitle }, ...Object.entries(m.boxKinds).map(([value, label]) => ({ value, label }))]}
        onChange={(event) => {
          const value = event.target.value;
          if (isBoxKind(value) && !applyBox(editor, value)) onNotice?.(m.boxNeedsParagraph);
        }} />
      {state.box && <Button type="button" tone="quiet" disabled={off} onClick={() => removeBox(editor)}>{m.boxRemove}</Button>}
      <Select label={m.languageTitle} value="" disabled={off} hint={m.languageHint}
        options={[{ value: "", label: m.languageTitle },
          ...LANGUAGE_CODES.map((value) => ({ value, label: m.languages[value] })),
          { value: "-", label: m.languageRemove }]}
        onChange={(event) => {
          const value = event.target.value;
          const language = value === "-" ? null : (LANGUAGE_CODES as readonly string[]).includes(value) ? (value as ForeignLanguage) : undefined;
          if (language !== undefined && !applyLanguage(editor, language)) onNotice?.(m.languageNeedsSelection);
        }} />
      {state.code && (
        <>
          <Select label={m.codeLanguage} value={state.language} options={options} disabled={off} hint={m.codeNote}
            onChange={(event) => { const v = event.target.value; setCodeLanguage(editor, isCodeLanguage(v) ? v : null); }} />
          <TextField label={m.codeCaption} value={state.caption} placeholder={m.codeCaptionPlaceholder} disabled={off}
            onChange={(event) => setCodeCaption(editor, event.target.value)} />
        </>
      )}
      <FormulaDialog open={target !== null} inline={target?.inline ?? false} editing={target?.editing ?? false}
        initialTex={target?.tex ?? ""} onClose={() => setTarget(null)}
        onSave={(tex) => (target ? saveFormula(editor, target, tex) : false)}
        onRemove={() => removeFormula(editor)} />
    </div>
  );
}
