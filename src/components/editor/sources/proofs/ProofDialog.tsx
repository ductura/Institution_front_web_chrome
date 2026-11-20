"use client";

/**
 * "Potvrda iz izvora" (E§3.4 proofs, prototype dialog `proof`): the page of
 * the source is drawn on a canvas, the student drags a frame around the part
 * that bears out the quote, writes the page in the source and an optional
 * note. For a PDF the dialog also pages through it and looks for the quote's
 * literal text; a near miss reads "tekst navoda razlikuje se od priložene
 * stranice" (B-8). The dialog is controlled: its draft lives in the caller's
 * `captureReducer`, so a failed send keeps it.
 */

import { Button, Dialog, TextArea, TextField } from "@ductura/ui";
import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from "react";

import { dragRect, nudgeRect, type Point, type Rect } from "./crop";
import { proofsHr as t } from "./messages.hr";
import { fieldErrors, LIMITS, type Capture, type CaptureAction, type QuoteNote } from "./proof-draft";
import styles from "./Proofs.module.css";

export type ProofDialogProps = {
  state: Capture | null;
  dispatch: (action: CaptureAction) => void;
  onSave: () => void;
  onCancel: () => void;
  /** PDF only: show page n. */
  onPdfPage?: (n: number) => void;
  /** PDF only: look for the quote through the pages. */
  onFind?: () => void;
  /** false: in the page flow (the catalogue). */
  modal?: boolean;
};

export function noticeText(notice: QuoteNote): string {
  switch (notice.kind) {
    case "short": return t.quoteShort;
    case "scan": return t.quoteScan;
    case "found": return t.quoteFound;
    case "foundOn": return t.quoteFoundOn.replace("{n}", String(notice.page));
    case "differs": return t.quoteDiffers;
    case "missing": return t.quoteMissing;
    case "searching": return t.searching;
    case "pdfOpening": return t.pdfOpening;
    case "pdfFailed": return t.pdfFailed;
    case "readFailed": return t.readFailed;
  }
}

const STATUS_TEXT = {
  failed: t.sendFailed, refused: t.sendRefused, expired: t.sendExpired, tooLarge: t.tooLarge,
} as const;

const KEY_STEP = 10;

export function ProofDialog({ state, dispatch, onSave, onCancel, onPdfPage, onFind, modal = true }: ProofDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<Point | null>(null);
  const picture = state?.picture ?? null;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === null || picture === null) return;
    canvas.width = picture.width;
    canvas.height = picture.height;
    const ctx = canvas.getContext("2d");
    if (ctx === null) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, picture.width, picture.height);
    const all = { x: 0, y: 0, width: picture.width, height: picture.height };
    picture.draw(ctx, all, all);
  }, [picture]);

  if (state === null) return null;
  const sending = state.status === "sending";
  const errors = state.tried ? fieldErrors(state) : {};
  const bounds = picture ?? { width: 1, height: 1 };

  // Pointer position in the picture's own pixels, measured on the drawn canvas
  // (its on-screen box already moves with the stage's scroll).
  const at = (event: PointerEvent<HTMLElement>): Point => {
    const box = (canvasRef.current ?? event.currentTarget).getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) / Math.max(1, box.width)) * bounds.width,
      y: ((event.clientY - box.top) / Math.max(1, box.height)) * bounds.height,
    };
  };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (picture === null || sending) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = at(event);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current === null) return;
    const rect = dragRect(drag.current, at(event), bounds);
    if (rect) dispatch({ type: "select", selection: rect });
  };
  const up = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current === null) return;
    const rect = dragRect(drag.current, at(event), bounds);
    drag.current = null;
    // A click keeps the earlier frame.
    if (rect) dispatch({ type: "select", selection: rect });
  };
  const key = (event: KeyboardEvent<HTMLDivElement>) => {
    if (picture === null || sending) return;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_STEP, 0], ArrowRight: [KEY_STEP, 0], ArrowUp: [0, -KEY_STEP], ArrowDown: [0, KEY_STEP],
    };
    const step = moves[event.key];
    if (!step) return;
    event.preventDefault();
    const start: Rect = state.selection ?? {
      x: bounds.width / 4, y: bounds.height / 4, width: bounds.width / 2, height: bounds.height / 2,
    };
    dispatch({ type: "select", selection: nudgeRect(start, step[0] * (bounds.width / 400), step[1] * (bounds.height / 400), bounds, event.shiftKey) });
  };

  const pct = (value: number, of: number) => `${(value / of) * 100}%`;
  const sel = state.selection;
  const pdf = state.pdf;
  const status = state.status === "idle" || state.status === "sending" ? undefined : STATUS_TEXT[state.status];

  return (
    <Dialog
      open title={t.dialogTitle} onClose={onCancel} dismissible={!sending} modal={modal} error={status}
      actions={<>
        <Button tone="quiet" onClick={() => dispatch({ type: "select", selection: null })} aria-disabled={sending || sel === null || undefined}>{t.whole}</Button>
        <Button tone="quiet" onClick={onCancel} aria-disabled={sending || undefined}>{t.cancel}</Button>
        <Button onClick={onSave} busy={sending || pdf?.loading === true}>{sending ? t.saving : t.save}</Button>
      </>}
    >
      <p className={styles.muted}>{state.sourceLabel === "" ? t.dialogIntro : `${state.sourceLabel}. ${t.dialogIntro}`}</p>
      {pdf && (
        <div className={styles.pdfBar}>
          <Button tone="quiet" aria-label={t.pdfPrev} onClick={() => onPdfPage?.(pdf.page - 1)} aria-disabled={pdf.loading || pdf.page <= 1 || undefined}>‹</Button>
          <span className={styles.pdfPage} aria-live="polite">{t.pdfPage} {pdf.page} {t.pdfOf.replace("{n}", String(pdf.count))}</span>
          <Button tone="quiet" aria-label={t.pdfNext} onClick={() => onPdfPage?.(pdf.page + 1)} aria-disabled={pdf.loading || pdf.page >= pdf.count || undefined}>›</Button>
        </div>
      )}
      {pdf && (
        <div className={styles.findRow}>
          <TextField label={t.quote} hint={t.quoteHint} value={state.quote} readOnly={sending}
            onChange={(event) => dispatch({ type: "field", field: "quote", value: event.target.value })} />
          <Button tone="quiet" onClick={onFind} aria-disabled={pdf.loading || sending || undefined}>{t.find}</Button>
        </div>
      )}
      {state.notice && (
        <p className={styles.notice} role="status" data-notice={state.notice.kind}>{noticeText(state.notice)}</p>
      )}
      <div className={styles.stage} tabIndex={0} role="group" aria-label={t.canvasLabel} onKeyDown={key}>
        {/* The sheet is exactly the drawn canvas: the pointer and the frame are measured on it, not on the scrolled stage. */}
        <div className={styles.sheet}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; }}>
          <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
          {sel && picture && (
            <div className={styles.frame} aria-hidden="true" style={{
              insetInlineStart: pct(sel.x, bounds.width), insetBlockStart: pct(sel.y, bounds.height), width: pct(sel.width, bounds.width), height: pct(sel.height, bounds.height),
            }} />
          )}
        </div>
      </div>
      <p className={styles.muted} aria-live="polite">{sel ? t.selection : t.noSelection}</p>
      <div className={styles.fields}>
        <TextField label={t.sourcePage} placeholder={t.sourcePageHint} value={state.page} readOnly={sending} maxLength={LIMITS.page * 2}
          error={errors.page === undefined ? undefined : errors.page === "pageRequired" ? t.pageRequired : t.pageTooLong.replace("{n}", String(LIMITS.page))}
          onChange={(event) => dispatch({ type: "field", field: "page", value: event.target.value })} />
        <TextArea label={t.note} value={state.note} readOnly={sending} rows={2}
          error={errors.note === undefined ? undefined : t.noteTooLong.replace("{n}", String(LIMITS.note))}
          onChange={(event) => dispatch({ type: "field", field: "note", value: event.target.value })} />
      </div>
    </Dialog>
  );
}
