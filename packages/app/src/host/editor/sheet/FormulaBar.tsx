"use client";

import type { KeyboardEvent } from "react";
import { Button } from "@ductura/ui";

import { sheetGridHr as t } from "./messages.hr";

export type FormulaBarProps = {
  /** The active cell, e.g. "B3". */
  cellRef: string;
  /** The text being written (the formula as typed, not its result). */
  value: string;
  readOnly?: boolean;
  /** Told every change of the text; the grid starts editing when the bar is typed into. */
  onChange: (text: string) => void;
  onCommit: () => void;
  onCancel: () => void;
  /** A refusal text to show under the bar (role=alert); null when the last commit was accepted. */
  problem: string | null;
};

/** Name box and formula field above the grid. Enter commits, Esc cancels (like the cell editor). */
export function FormulaBar({ cellRef, value, readOnly = false, onChange, onCommit, onCancel, problem }: FormulaBarProps) {
  const keys = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onCommit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  };
  return (
    <div data-sheet-formula-bar>
      <div style={{ display: "flex", gap: "var(--space-2, 8px)", alignItems: "center" }}>
        <output aria-label={t.formulaBar.refLabel} data-sheet-active-ref>{cellRef}</output>
        <input
          type="text"
          aria-label={t.formulaBar.label}
          aria-describedby="sheet-formula-hint"
          aria-invalid={problem !== null}
          autoComplete="off"
          spellCheck={false}
          readOnly={readOnly}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={keys}
          style={{ flex: 1, minWidth: 0 }}
        />
        <Button tone="secondary" size="dense" disabled={readOnly} onClick={onCommit}>{t.formulaBar.confirm}</Button>
        <Button tone="ghost" size="dense" disabled={readOnly} onClick={onCancel}>{t.formulaBar.cancel}</Button>
      </div>
      <p id="sheet-formula-hint" className="visually-hidden">{t.formulaBar.hint}</p>
      {problem !== null ? <p role="alert" data-sheet-problem>{problem}</p> : null}
    </div>
  );
}
