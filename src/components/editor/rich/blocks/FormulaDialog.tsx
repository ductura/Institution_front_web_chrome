"use client";

/**
 * The formula dialog (E§3.4, stem.js): shapes with blanks, a LaTeX field and a
 * KaTeX preview. Tab in the field jumps to the next blank; saving stops while
 * a blank is left. KaTeX is bundled with the app, and its output is the only
 * HTML inserted here (`trust` is off in renderTex).
 */

import { Button, Dialog, TextArea } from "@ductura/ui";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import "katex/dist/katex.min.css";

import styles from "./blocks.module.css";
import { FORMULA_GROUPS, applyTemplate, hasHoles, nextHole } from "./formula-templates";
import { renderTex } from "./katex-render";
import { richBlocksMessages as m } from "./messages.hr";

export type FormulaDialogProps = {
  open: boolean;
  inline: boolean;
  editing: boolean;
  initialTex: string;
  /** false when the editor refused the formula; the dialog then stays open with an error. */
  onSave: (tex: string) => boolean;
  onRemove?: () => void;
  onClose: () => void;
};

export function FormulaDialog({ open, inline, editing, initialTex, onSave, onRemove, onClose }: FormulaDialogProps) {
  const [tex, setTex] = useState(initialTex);
  const [error, setError] = useState<string | undefined>();
  const wrap = useRef<HTMLDivElement>(null);
  const field = { get current() { return wrap.current?.querySelector("textarea") ?? null; } };
  const caret = useRef<[number, number] | null>(null);

  useEffect(() => { if (open) { setTex(initialTex); setError(undefined); } }, [open, initialTex]);
  useEffect(() => {
    const at = caret.current;
    if (at && field.current) { field.current.focus(); field.current.setSelectionRange(at[0], at[1]); caret.current = null; }
  }, [tex]);

  const preview = useMemo(() => renderTex(tex, !inline), [tex, inline]);

  const insert = (template: string) => {
    const el = field.current;
    const result = applyTemplate(tex, el?.selectionStart ?? tex.length, el?.selectionEnd ?? tex.length, template);
    caret.current = [result.caret, result.caretEnd];
    setTex(result.tex);
    setError(undefined);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Tab" || event.shiftKey) return;
    const at = nextHole(tex, event.currentTarget.selectionEnd);
    if (at === -1) return;
    event.preventDefault();
    event.currentTarget.setSelectionRange(at, at + 1);
  };
  const save = () => {
    if (hasHoles(tex)) return setError(m.formulaHoles);
    if (tex.trim() === "" || !preview.ok) return setError(m.formulaBroken);
    if (!onSave(tex)) return setError(m.formulaInvalid);
    onClose();
  };

  return (
    <Dialog open={open} title={inline ? m.inlineFormulaTitle : m.formulaTitle} onClose={onClose} error={error}
      actions={<>
        {editing && onRemove && <Button type="button" tone="quiet" onClick={() => { onRemove(); onClose(); }}>{m.remove}</Button>}
        <Button type="button" tone="quiet" onClick={onClose}>{m.cancel}</Button>
        <Button type="button" onClick={save}>{m.save}</Button>
      </>}>
      <p>{m.formulaHint} {inline ? m.inlineFormulaHint : ""}</p>
      {FORMULA_GROUPS.map((group) => (
        <fieldset key={group.key} className={styles.group}>
          <legend>{m.groups[group.key]}</legend>
          {group.items.map((item) => (
            <button key={item.label} type="button" className={styles.chip} aria-label={item.label} onClick={() => insert(item.tex)}>
              {item.label}
            </button>
          ))}
        </fieldset>
      ))}
      <div ref={wrap}><TextArea label={m.formulaField} value={tex} rows={3} spellCheck={false}
        className={styles.mono} placeholder={m.formulaPlaceholder}
        onChange={(event) => { setTex(event.target.value); setError(undefined); }} onKeyDown={onKeyDown} /></div>
      <div className={styles.preview} role="group" aria-label={m.formulaPreviewLabel} data-ok={preview.ok ? "" : undefined}>
        {tex.trim() === ""
          ? <span>{m.formulaPreview}</span>
          // KaTeX output with trust off; the only markup this component injects.
          : <span dangerouslySetInnerHTML={{ __html: preview.html }} />}
      </div>
    </Dialog>
  );
}
