"use client";

import { Button, DataTable, TextArea, TextField, type DataTableColumn } from "@ductura/ui";
import { useRef, useState } from "react";

import type { Dataset } from "./infer-kinds";
import { describeError } from "./describe-error";
import { datasetMessages as t } from "./messages.hr";
import { MAX_CSV_LENGTH, parseDataset } from "./parse-csv";
import styles from "./dataset.module.css";

/** How many errors the list shows; the rest is only counted, so a broken file cannot flood the screen. */
export const MAX_SHOWN_ERRORS = 10;

export type LoaderState =
  | { kind: "idle" }
  | { kind: "reading" }
  | { kind: "loaded"; dataset: Dataset }
  | { kind: "refused"; errors: string[]; more: number };

/** Parses text into a loader state; bad input becomes Croatian messages and never throws. */
export function stateOfText(text: string): LoaderState {
  const parsed = parseDataset(text);
  if (parsed.ok) return { kind: "loaded", dataset: parsed.dataset };
  const lines = parsed.errors.map(describeError);
  return { kind: "refused", errors: lines.slice(0, MAX_SHOWN_ERRORS), more: Math.max(0, lines.length - MAX_SHOWN_ERRORS) };
}

type ColumnRow = Dataset["columns"][number];
const COLUMN_TABLE: DataTableColumn<ColumnRow>[] = [
  { id: "name", header: t.columnName, cell: (column) => column.name, rowHeader: true },
  { id: "kind", header: t.columnKind, cell: (column) => (column.kind === "numeric" ? t.numeric : t.category) },
];

/**
 * Loads a data set from a CSV file or pasted text. The file is read here with `File.text()` and goes nowhere; the
 * parent gets the data set through `onLoaded` and sends it only in the body of a calculation. `onCleared` tells the
 * parent that a set it was given is gone (new input that failed, or "Očisti").
 */
export function DatasetLoader({ onLoaded, onCleared }: { onLoaded: (dataset: Dataset) => void; onCleared?: () => void }) {
  const [state, setState] = useState<LoaderState>({ kind: "idle" });
  const [text, setText] = useState("");
  // Counts reads; a read that is no longer the latest (cleared, or another file chosen) is dropped when it ends.
  const generation = useRef(0);

  function apply(next: LoaderState) {
    setState(next);
    if (next.kind === "loaded") onLoaded(next.dataset);
    else if (next.kind !== "reading") onCleared?.();
  }

  async function chooseFile(file: File | undefined) {
    if (!file) return;
    const mine = ++generation.current;
    if (file.size > MAX_CSV_LENGTH * 4) {
      apply({ kind: "refused", errors: [t.fileTooLarge.replace("{max}", String(MAX_CSV_LENGTH))], more: 0 });
      return;
    }
    setState({ kind: "reading" });
    try {
      const read = await file.text();
      if (mine === generation.current) apply(stateOfText(read));
    } catch {
      if (mine === generation.current) apply({ kind: "refused", errors: [t.readFailed], more: 0 });
    }
  }

  const refused = state.kind === "refused" ? state : undefined;
  return (
    <section aria-labelledby="skup-naslov" className={styles.loader}>
      <h2 id="skup-naslov">{t.title}</h2>
      <p>{t.lead}</p>
      <TextField label={t.file} hint={t.fileHint} type="file" accept=".csv,.txt,text/csv,text/plain"
        onChange={(event) => { void chooseFile(event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} />
      <TextArea label={t.paste} hint={t.pasteHint} value={text} rows={6} spellCheck={false}
        onChange={(event) => setText(event.target.value)} />
      <div className={styles.actions}>
        <Button busy={state.kind === "reading"} aria-disabled={text.trim() === ""} onClick={() => { if (text.trim() === "") return; generation.current += 1; apply(stateOfText(text)); }}>{t.load}</Button>
        <Button tone="ghost" onClick={() => { generation.current += 1; setText(""); apply({ kind: "idle" }); }}>{t.clear}</Button>
      </div>
      {state.kind === "reading" && <p role="status">{t.reading}</p>}
      {refused && (
        <div role="alert">
          <h3>{t.errorsTitle}</h3>
          <ul>{refused.errors.map((line, index) => <li key={index}>{line}</li>)}</ul>
          {refused.more > 0 && <p>{t.errorsMore.replace("{count}", String(refused.more))}</p>}
        </div>
      )}
      {state.kind === "loaded" && (
        <>
          <p role="status">{t.loaded.replace("{rows}", String(state.dataset.rows.length)).replace("{columns}", String(state.dataset.columns.length))}</p>
          <DataTable caption={t.columns} columns={COLUMN_TABLE} rows={state.dataset.columns} rowKey={(column) => column.name} empty={t.columns} />
        </>
      )}
    </section>
  );
}
