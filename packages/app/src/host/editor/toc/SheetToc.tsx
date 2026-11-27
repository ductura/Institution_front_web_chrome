"use client";

// ED-71: "Sadržaj na listu" (prototype features.js `#toc .tocbox`): when the
// person turns it on in Prikaz, the table of contents stands on the sheet above
// the text. It is drawn from the one chapter projection (createTocStore), so
// its numbers are those of the left panel and the export; a line jumps to its
// heading. It is not part of the text: nothing here edits the work.
import { useMemo, useSyncExternalStore } from "react";

import { createTocStore, EMPTY_TOC, goToHeading, type TocEditor } from "../../../../../editor-core/src/outline/index.ts";

import { tocHr as t } from "./messages.hr";
import { readSheetToc, sheetTocKey, subscribeSheetToc } from "./sheet-toc";
import styles from "./SheetToc.module.css";

export type SheetTocLine = { readonly key: string; readonly number: string; readonly title: string; readonly level: number };

/** The box itself, from its lines; `onSelect` gets the heading's block id. */
export function SheetTocBox({ lines, onSelect }: { lines: readonly SheetTocLine[]; onSelect: (key: string) => void }) {
  return (
    <nav className={styles.box} aria-label={t.sheetLabel} data-sheet-toc="">
      <h2 className={styles.title}>{t.sheetTitle}</h2>
      {lines.length === 0 ? <p className={styles.note}>{t.sheetEmpty}</p> : (
        <ol className={styles.list}>
          {lines.map((line) => (
            <li key={line.key}>
              <button type="button" className={`${styles.line} ${line.level >= 3 ? styles.l3 : line.level === 2 ? styles.l2 : ""}`}
                onClick={() => onSelect(line.key)}>
                <span className={styles.number}>{line.number}.</span>
                <span>{line.title === "" ? t.untitled : line.title}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      <p className={styles.note}>{t.sheetNote}</p>
    </nav>
  );
}

/** The box on the sheet, shown only while "Sadržaj na listu" is on for this person and work. */
export function SheetToc({ editor, scope, documentId }: { editor: TocEditor | null; scope: string; documentId: string }) {
  const key = sheetTocKey(scope, documentId);
  const on = useSyncExternalStore(subscribeSheetToc, () => readSheetToc(key), () => false);
  const store = useMemo(() => createTocStore(on ? editor : null), [editor, on]);
  const toc = useSyncExternalStore(store.subscribe, store.getSnapshot, () => EMPTY_TOC);
  if (!on) return null;
  return <SheetTocBox lines={toc.entries} onSelect={(heading) => { if (editor) goToHeading(editor, heading); }} />;
}
