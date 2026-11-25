"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { Button, Notice } from "@ductura/ui";

import { computeSheet, countFilledCells, formatCellRef, type SheetDocument } from "../../../../../editor-core/src/sheet/index.ts";
import { FormulaBar } from "./FormulaBar";
import { SheetTabs } from "./SheetTabs";
import {
  addSheet, cellInputText, clampSelection, clearRange, columnName, insertLine, displayCell, emptyHistory, inRange, isTypingKey, moveSelection,
  rangeName, rangeOf, recordEdit, redo, setCellText, startSelection, stepAfterCommit, undo,
  type EditResult, type History, type MoveKey, type Position, type RefusalCode, type Selection,
} from "./grid-model";
import { sheetGridHr as t } from "./messages.hr";

export type SheetGridState = "loading" | "error" | "ready";

export type SheetGridProps = {
  /** Loading, failed and empty are three different screens: a failed read is never shown as an empty sheet. */
  state: SheetGridState;
  document: SheetDocument | null;
  /** Every accepted edit, undo and redo hands the whole new document up; the port that stores it is the page's. */
  onChange: (next: SheetDocument) => void;
  onRetry?: () => void;
  readOnly?: boolean;
  /** Ids of new sheets; the page may supply its own (default: random). */
  newSheetId?: () => string;
};

const MOVE_KEYS = new Set<string>(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"]);
type Edit = { ref: string; draft: string; source: "cell" | "bar" };

const randomSheetId = () => `sheet-${Math.random().toString(36).slice(2, 10)}`;
const keyOf = (p: Position) => `${p.row}:${p.column}`;

export function SheetGrid({ state, document: doc, onChange, onRetry, readOnly = false, newSheetId = randomSheetId }: SheetGridProps) {
  if (state === "loading") return <p role="status" aria-busy="true" data-sheet-state="loading">{t.loading}</p>;
  if (state === "error" || doc === null) {
    return (
      <div role="alert" data-sheet-state="error">
        <h2>{t.loadFailedTitle}</h2>
        <p>{t.loadFailedBody}</p>
        {onRetry ? <Button tone="secondary" onClick={onRetry}>{t.retry}</Button> : null}
      </div>
    );
  }
  return <Grid doc={doc} onChange={onChange} readOnly={readOnly} newSheetId={newSheetId} />;
}

function Grid({ doc, onChange, readOnly, newSheetId }: { doc: SheetDocument; onChange: (d: SheetDocument) => void; readOnly: boolean; newSheetId: () => string }) {
  const panelId = useId();
  const [sheetId, setSheetId] = useState(doc.sheets[0]!.id);
  const sheet = doc.sheets.find((s) => s.id === sheetId) ?? doc.sheets[0]!;
  const [selection, setSelection] = useState<Selection>(startSelection);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [problem, setProblem] = useState<RefusalCode | null>(null);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<History>(emptyHistory);
  const cells = useRef(new Map<string, HTMLElement>());
  const wantFocus = useRef(false);
  const dragging = useRef(false);
  // The edit as the last commit/cancel left it: a blur that follows a commit in the same event must not commit twice.
  const live = useRef<Edit | null>(null);
  live.current = edit;

  const computed = useMemo(() => computeSheet(sheet), [sheet]);
  const sel = clampSelection(selection, sheet);
  const range = rangeOf(sel);
  const activeRef = formatCellRef(sel.active);
  const empty = countFilledCells(doc) === 0;

  useEffect(() => {
    if (!wantFocus.current || edit?.source === "cell") return;
    wantFocus.current = false;
    cells.current.get(keyOf(sel.active))?.focus();
  });

  const refuse = (error: RefusalCode) => setProblem(error);

  /** Applies an edit result: accepted ones go up and into the history, refused ones stay on screen. */
  const apply = (result: EditResult, announce = ""): boolean => {
    if (!result.ok) { refuse(result.error); return false; }
    setProblem(null);
    if (result.doc !== doc) {
      setHistory(recordEdit(history, doc));
      onChange(result.doc);
    }
    setMessage(announce);
    return true;
  };

  const commit = (step?: { key: "Enter" | "Tab"; shift: boolean }): boolean => {
    const edit = live.current;
    if (edit === null) return true;
    const unchanged = edit.draft === cellInputText(sheet.cells[edit.ref]);
    if (!unchanged && !apply(setCellText(doc, sheet.id, edit.ref, edit.draft))) return false;
    setProblem(null);
    live.current = null;
    setEdit(null);
    wantFocus.current = true;
    if (step) setSelection(stepAfterCommit(sel, step.key, step.shift, sheet));
    return true;
  };

  const cancel = () => {
    live.current = null;
    setEdit(null);
    setProblem(null);
    wantFocus.current = true;
  };

  const beginEdit = (draft: string, source: Edit["source"]) => {
    if (readOnly) { setMessage(t.readOnly); return; }
    setProblem(null);
    setEdit({ ref: activeRef, draft, source });
  };

  const runUndo = () => {
    const step = undo(history, doc);
    if (step === null) { setMessage(t.nothingToUndo); return; }
    setHistory(step.history);
    setEdit(null);
    onChange(step.doc);
    setMessage(t.undone);
  };
  const runRedo = () => {
    const step = redo(history, doc);
    if (step === null) return;
    setHistory(step.history);
    setEdit(null);
    onChange(step.doc);
    setMessage(t.redone);
  };

  const gridKeys = (event: KeyboardEvent<HTMLTableElement>) => {
    if (event.target instanceof HTMLInputElement) return;
    const ctrl = event.ctrlKey || event.metaKey;
    if (ctrl && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (readOnly) return;
      if (event.shiftKey) runRedo(); else runUndo();
      return;
    }
    if (ctrl && event.key.toLowerCase() === "y") {
      event.preventDefault();
      if (!readOnly) runRedo();
      return;
    }
    if (MOVE_KEYS.has(event.key)) {
      event.preventDefault();
      wantFocus.current = true;
      setSelection(moveSelection(sel, event.key as MoveKey, { shift: event.shiftKey, ctrl }, sheet));
      return;
    }
    if (event.key === "Enter" || event.key === "F2") {
      event.preventDefault();
      beginEdit(cellInputText(sheet.cells[activeRef]), "cell");
    } else if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      if (readOnly) { setMessage(t.readOnly); return; }
      apply(clearRange(doc, sheet.id, range), t.cleared(rangeName(range)));
    } else if (isTypingKey(event)) {
      event.preventDefault();
      beginEdit(event.key, "cell");
    }
  };

  const inputKeys = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      commit({ key: event.key, shift: event.shiftKey });
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  };

  const pointerDown = (event: MouseEvent, at: Position) => {
    // A press inside the open editor is the caret and text selection of the input, not a cell choice.
    if (event.target instanceof HTMLInputElement) return;
    if (edit !== null && !commit()) { event.preventDefault(); return; }
    dragging.current = true;
    wantFocus.current = true;
    setSelection(event.shiftKey ? { active: sel.active, focus: at } : { active: at, focus: at });
  };
  const pointerOver = (event: MouseEvent, at: Position) => {
    if (dragging.current && event.buttons === 1) setSelection({ active: sel.active, focus: at });
  };

  const selectSheet = (id: string) => {
    if (edit !== null && !commit()) return;
    setSheetId(id);
    setSelection(startSelection());
  };
  /** The document with a pending edit written into it (null: that edit is refused and stays open). */
  const withPendingEdit = (): SheetDocument | null => {
    const pending = live.current;
    if (pending === null || pending.draft === cellInputText(sheet.cells[pending.ref])) return doc;
    const written = setCellText(doc, sheet.id, pending.ref, pending.draft);
    if (!written.ok) { refuse(written.error); return null; }
    return written.doc;
  };

  /** Hands up a structural change built on the document that includes the pending edit, so neither is lost. */
  const structural = (build: (base: SheetDocument) => EditResult, announce = ""): SheetDocument | null => {
    const base = withPendingEdit();
    if (base === null) return null;
    const result = build(base);
    if (!result.ok) { refuse(result.error); return null; }
    live.current = null;
    setEdit(null);
    setProblem(null);
    setHistory(recordEdit(history, doc));
    onChange(result.doc);
    setMessage(announce);
    return result.doc;
  };

  const onAddSheet = () => {
    const next = structural((base) => addSheet(base, newSheetId));
    if (next === null) return;
    setSheetId(next.sheets[next.sheets.length - 1]!.id);
    setSelection(startSelection());
  };

  const onAddLine = (axis: "row" | "column") => {
    const size = axis === "row" ? sheet.rows : sheet.columns;
    structural(
      (base) => insertLine(base, sheet.id, axis, size + 1),
      axis === "row" ? t.lines.rowAdded(size + 1) : t.lines.columnAdded(columnName(size + 1)),
    );
  };

  const barValue = edit ? edit.draft : cellInputText(sheet.cells[activeRef]);
  const problemText = problem === null ? null : t.refused[problem];
  const columns = Array.from({ length: sheet.columns }, (_, i) => i + 1);
  const rows = Array.from({ length: sheet.rows }, (_, i) => i + 1);

  return (
    <div data-sheet-state="ready" onMouseUp={() => { dragging.current = false; }}>
      <SheetTabs sheets={doc.sheets} activeId={sheet.id} panelId={panelId} readOnly={readOnly} onSelect={selectSheet} onAdd={onAddSheet} />
      <FormulaBar
        cellRef={activeRef}
        value={barValue}
        readOnly={readOnly}
        onChange={(text) => setEdit({ ref: activeRef, draft: text, source: "bar" })}
        onCommit={() => commit()}
        onCancel={cancel}
        problem={problemText}
      />
      <div role="group" aria-label={t.lines.label} style={{ display: "flex", gap: "var(--space-2, 8px)", flexWrap: "wrap" }}>
        <Button tone="ghost" size="dense" disabled={readOnly} onClick={() => onAddLine("row")}>{t.lines.addRow}</Button>
        <Button tone="ghost" size="dense" disabled={readOnly} onClick={() => onAddLine("column")}>{t.lines.addColumn}</Button>
      </div>
      {empty ? <Notice>{t.emptyNote}</Notice> : null}
      <p role="status" className="visually-hidden">{message === "" ? t.rangeLabel(rangeName(range)) : message}</p>
      <div role="tabpanel" id={panelId} aria-labelledby={`${panelId}-tab-${sheet.id}`} style={{ overflow: "auto", maxWidth: "100%" }}>
        <table
          role="grid"
          aria-label={`${t.gridLabel}: ${sheet.name}`}
          aria-rowcount={sheet.rows + 1}
          aria-colcount={sheet.columns + 1}
          aria-multiselectable="true"
          aria-readonly={readOnly}
          onKeyDown={gridKeys}
          style={{ borderCollapse: "collapse" }}
        >
          <thead>
            <tr>
              <td aria-label={t.cornerLabel} style={headStyle} />
              {columns.map((c) => <th key={c} scope="col" aria-label={t.columnHeader(columnName(c))} style={headStyle}>{columnName(c)}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row}>
                <th scope="row" aria-label={t.rowHeader(row)} style={headStyle}>{row}</th>
                {columns.map((column) => {
                  const at = { row, column };
                  const ref = formatCellRef(at);
                  const isActive = row === sel.active.row && column === sel.active.column;
                  const shown = displayCell(sheet.cells[ref], computed[ref]);
                  const editing = edit?.source === "cell" && edit.ref === ref;
                  return (
                    <td
                      key={column}
                      role="gridcell"
                      ref={(el) => { if (el) cells.current.set(keyOf(at), el); else cells.current.delete(keyOf(at)); }}
                      tabIndex={isActive && !editing ? 0 : -1}
                      aria-selected={inRange(range, at)}
                      aria-label={shown.error ? `${t.cellLabel(ref)}. ${t.errorSuffix(shown.error, t.errors[shown.error])}` : undefined}
                      data-cell={ref}
                      data-error={shown.error ?? undefined}
                      style={{ ...cellStyle, ...(inRange(range, at) ? { background: "var(--selected)" } : null), ...(isActive ? { outline: "2px solid var(--accent)", outlineOffset: -2 } : null) }}
                      onFocus={() => { if (!isActive && edit === null) setSelection({ active: at, focus: at }); }}
                      onMouseDown={(event) => pointerDown(event, at)}
                      onMouseEnter={(event) => pointerOver(event, at)}
                      onDoubleClick={() => beginEdit(cellInputText(sheet.cells[ref]), "cell")}
                    >
                      {editing ? (
                        <input
                          autoFocus
                          aria-label={t.cellLabel(ref)}
                          value={edit.draft}
                          autoComplete="off"
                          spellCheck={false}
                          onChange={(event) => setEdit({ ref, draft: event.target.value, source: "cell" })}
                          onKeyDown={inputKeys}
                          onBlur={() => { commit(); }}
                          style={{ width: "100%", boxSizing: "border-box" }}
                        />
                      ) : shown.error ? (
                        <span style={{ color: "var(--error)", fontWeight: 700 }}>{shown.text}</span>
                      ) : (
                        shown.text
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const headStyle = { border: "1px solid var(--rule)", padding: "2px 8px", minWidth: 40, textAlign: "center", fontWeight: 600 } as const;
const cellStyle = { border: "1px solid var(--rule)", padding: "2px 8px", minWidth: 96, minHeight: 28, height: 32, whiteSpace: "nowrap", textAlign: "left" } as const;
