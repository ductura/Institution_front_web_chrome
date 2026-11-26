"use client";

import { useRef, type KeyboardEvent } from "react";
import { Button } from "@ductura/ui";

import { MAX_SHEETS } from "../../../../../editor-core/src/sheet/index.ts";
import { sheetGridHr as t } from "./messages.hr";

export type SheetTabsProps = {
  sheets: readonly { id: string; name: string }[];
  activeId: string;
  /** Id of the grid element the open tab controls. */
  panelId: string;
  readOnly?: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
};

/** The sheets as tabs (WAI-ARIA tabs, automatic activation: Left/Right/Home/End), and a button for one more. */
export function SheetTabs({ sheets, activeId, panelId, readOnly = false, onSelect, onAdd }: SheetTabsProps) {
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const full = sheets.length >= MAX_SHEETS;

  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = sheets.findIndex((s) => s.id === activeId);
    const next =
      event.key === "ArrowRight" ? (index + 1) % sheets.length
      : event.key === "ArrowLeft" ? (index - 1 + sheets.length) % sheets.length
      : event.key === "Home" ? 0
      : event.key === "End" ? sheets.length - 1
      : null;
    const id = next === null ? undefined : sheets[next]?.id;
    if (id === undefined) return;
    event.preventDefault();
    onSelect(id);
    buttons.current.get(id)?.focus();
  };

  return (
    <div style={{ display: "flex", gap: "var(--space-2, 8px)", alignItems: "center", flexWrap: "wrap" }}>
      <div role="tablist" aria-label={t.tabs.label} onKeyDown={keys} style={{ display: "flex", gap: "var(--space-1, 4px)", flexWrap: "wrap" }}>
        {sheets.map((sheet) => (
          <button
            key={sheet.id}
            ref={(element) => {
              if (element) buttons.current.set(sheet.id, element);
              else buttons.current.delete(sheet.id);
            }}
            type="button"
            role="tab"
            id={`${panelId}-tab-${sheet.id}`}
            aria-selected={sheet.id === activeId}
            aria-controls={panelId}
            tabIndex={sheet.id === activeId ? 0 : -1}
            data-sheet-tab={sheet.id}
            style={{ fontWeight: sheet.id === activeId ? 700 : 400, textDecoration: sheet.id === activeId ? "underline" : "none" }}
            onClick={() => onSelect(sheet.id)}
          >
            {sheet.name}
          </button>
        ))}
      </div>
      <Button tone="ghost" size="dense" disabled={readOnly || full} aria-describedby={full ? `${panelId}-limit` : undefined} onClick={onAdd}>
        {t.tabs.add}
      </Button>
      {full ? <span id={`${panelId}-limit`}>{t.tabs.limit}</span> : null}
    </div>
  );
}
