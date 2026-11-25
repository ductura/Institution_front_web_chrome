"use client";

/**
 * The host's formula dialog (WEB-V21-STEM-FORMULA-DIJALOG): a LaTeX field, a
 * live preview from the KaTeX core (`renderTex`), invented-example shapes with
 * blanks, and an error that keeps the typed text. The result leaves through
 * `onConfirm({ kind, tex })`; nothing here touches a document, and the dialog
 * is not mounted anywhere yet (WEB-V21-STEM-FORMULA-UREDNIK mounts it).
 * KaTeX's HTML is the only markup injected, and `trust` is off in `renderTex`.
 */

import { Button, Dialog, TextArea } from "@ductura/ui";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import "katex/dist/katex.min.css";

import { checkFormulaLimit, type FormulaKind } from "./limits.ts";
import { formulaDialogHr as t } from "./messages.hr.ts";
import { renderTex } from "./render.ts";
import { FORMULA_TEMPLATES, applyTemplate, hasHoles, nextHole } from "./templates.ts";

export type FormulaDialogResult = { kind: FormulaKind; tex: string };

export type FormulaDialogProps = {
  open: boolean;
  kind: FormulaKind;
  /** The formula being changed; empty when inserting a new one. */
  initialTex?: string;
  /** Return false when the editor refuses the formula: the dialog stays open and keeps the text. */
  onConfirm: (result: FormulaDialogResult) => boolean | void;
  onClose: () => void;
};

export function FormulaDialog({ open, kind, initialTex = "", onConfirm, onClose }: FormulaDialogProps) {
  const [tex, setTex] = useState(initialTex);
  const [refused, setRefused] = useState(false);
  const field = useRef<HTMLTextAreaElement | null>(null);
  const pendingSelection = useRef<[number, number] | null>(null);

  // A kept-mounted dialog starts a new session on every opening or new target: no stale draft or message.
  useEffect(() => { if (open) { setTex(initialTex); setRefused(false); } }, [open, initialTex]);

  const limit = checkFormulaLimit(tex, kind);
  const holes = hasHoles(tex);
  const preview = useMemo(() => renderTex(tex, kind === "block"), [tex, kind]);
  const typed = tex.trim() !== "";
  const message = refused ? t.refused
    : limit.reason === "too-long" ? t.tooLong(limit.length, limit.max)
    : holes ? t.holes
    : typed && !preview.ok ? t.broken
    : undefined;
  const canConfirm = limit.ok && !holes && preview.ok;

  const setText = (next: string) => { setTex(next); setRefused(false); };
  const insert = (template: string) => {
    const el = field.current;
    const result = applyTemplate(tex, el?.selectionStart ?? tex.length, el?.selectionEnd ?? tex.length, template);
    setText(result.tex);
    // The textarea is controlled: restore focus and selection once React has written the new value.
    pendingSelection.current = [result.caret, result.caretEnd];
    queueMicrotask(() => {
      const at = pendingSelection.current;
      pendingSelection.current = null;
      if (at && field.current) { field.current.focus(); field.current.setSelectionRange(at[0], at[1]); }
    });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Tab" || event.shiftKey) return;
    const at = nextHole(tex, event.currentTarget.selectionEnd);
    if (at === -1) return;
    event.preventDefault();
    // The shared Dialog would otherwise move the focus on to the next control.
    event.stopPropagation();
    event.currentTarget.setSelectionRange(at, at + 1);
  };
  const confirm = () => {
    if (!canConfirm) return;
    if (onConfirm({ kind, tex: tex.trim() }) === false) setRefused(true);
  };

  return (
    <Dialog open={open} title={kind === "inline" ? t.inlineTitle : t.title} onClose={onClose} error={message}
      actions={<>
        <Button type="button" tone="quiet" onClick={onClose}>{t.cancel}</Button>
        <Button type="button" disabled={!canConfirm} onClick={confirm}>{t.confirm}</Button>
      </>}>
      <p>{t.hint} {kind === "inline" ? t.inlineHint : ""}</p>
      <div role="group" aria-label={t.templates}>
        {FORMULA_TEMPLATES.map((template) => (
          <Button key={template.id} type="button" tone="quiet" onClick={() => insert(template.tex)}>
            {t.templateNames[template.id as keyof typeof t.templateNames]}
          </Button>
        ))}
      </div>
      <TextArea ref={field} label={t.field} hint={t.counter(limit.length, limit.max)} value={tex} rows={3} spellCheck={false}
        placeholder={t.placeholder} onChange={(event) => setText(event.target.value)} onKeyDown={onKeyDown} />
      <div role="group" aria-label={t.previewLabel} data-ok={preview.ok ? "" : undefined}>
        {typed && limit.reason !== "too-long"
          // KaTeX output with trust off; the only markup this component injects.
          ? <span dangerouslySetInnerHTML={{ __html: preview.html }} />
          : <span>{t.previewEmpty}</span>}
      </div>
    </Dialog>
  );
}
