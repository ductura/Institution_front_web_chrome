"use client";

// ED-79: "Popis kratica" (prototype more2.js `#abbrBox`, `m2AbEdit`). When the student turns it on in
// "Dijelovi rada", the list stands on the sheet under the table of contents. It is drawn from the text
// as it is typed; "Uredi" or "Upiši" opens the dialog "Kratica X" for the full name. A work that
// cannot be edited shows the list without the buttons. Nothing here edits the work.
import { Button, Dialog, TextField } from "@ductura/ui";
import { useMemo, useState, useSyncExternalStore } from "react";

import { readWorkPartsDisplay, subscribeWorkPartsDisplay } from "../../../../../../src/components/editor/parts/work-parts-document.ts";

import { fullNamesKey, listAbbreviations, readFullNames, subscribeFullNames, writeFullName, type Abbreviation } from "./abbreviations";
import { abbreviationsHr as t } from "./messages.hr";
import styles from "./SheetAbbreviations.module.css";

/** What the box needs of the editor: its text blocks, its changes and whether it can be edited. */
export type AbbreviationsEditor = {
  readonly isEditable: boolean;
  readonly state: { readonly doc: { descendants(f: (node: { isTextblock: boolean; textContent: string }) => boolean | void): void } };
  on(event: "update", listener: () => void): unknown;
  off(event: "update", listener: () => void): unknown;
};

/** The box itself, from its list; without `onEdit` (read only) it has no buttons. */
export function SheetAbbreviationsBox({ list, onEdit }: { list: readonly Abbreviation[]; onEdit?: (abbreviation: Abbreviation) => void }) {
  return (
    <section className={styles.box} aria-label={t.label} data-sheet-abbreviations="">
      <h2 className={styles.title}>{t.title}</h2>
      {list.length === 0 ? <p className={styles.note}>{t.empty}</p> : (
        <dl className={styles.list}>
          {list.map((a) => (
            <div key={a.abbreviation} className={styles.row}>
              <dt className={styles.abbreviation}>{a.abbreviation}</dt>
              <dd className={styles.full}>{a.full === "" ? <i>{t.unknown}</i> : a.full}</dd>
              {onEdit ? (
                <dd className={styles.action}>
                  <button type="button" className={styles.link} onClick={() => onEdit(a)}
                    aria-label={a.full === "" ? t.writeLabel(a.abbreviation) : t.editLabel(a.abbreviation)}>
                    {a.full === "" ? t.write : t.edit}
                  </button>
                </dd>
              ) : null}
            </div>
          ))}
        </dl>
      )}
      <p className={styles.note}>{t.note}</p>
    </section>
  );
}

/** "Kratica X": the full name; an empty one gives the guess from the text back. */
export function AbbreviationDialog({ abbreviation, onSave, onClose }: { abbreviation: Abbreviation; onSave: (full: string) => void; onClose: () => void }) {
  const [value, setValue] = useState(abbreviation.full);
  return (
    <Dialog open title={t.dialogTitle(abbreviation.abbreviation)} onClose={onClose}
      actions={<>
        <Button type="button" tone="quiet" onClick={onClose}>{t.cancel}</Button>
        <Button type="button" onClick={() => onSave(value)}>{t.save}</Button>
      </>}>
      <TextField label={t.fullName} value={value} placeholder={t.placeholder} hint={t.hint}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onSave(value); } }} />
    </Dialog>
  );
}

const textBlocks = (doc: AbbreviationsEditor["state"]["doc"]): string[] => {
  const blocks: string[] = [];
  doc.descendants((node) => {
    if (!node.isTextblock) return true;
    blocks.push(node.textContent);
    return false;
  });
  return blocks;
};

const noEditor = () => () => {};
const NO_NAMES = {};

/** The box on the sheet, shown only while "Popis kratica" is on in this person's work parts. */
export function SheetAbbreviations({ editor, scope, documentId }: { editor: AbbreviationsEditor | null; scope: string; documentId: string }) {
  const partsKey = `ductura.editor.work-parts:${JSON.stringify([scope, documentId])}`;
  const on = useSyncExternalStore(subscribeWorkPartsDisplay, () => readWorkPartsDisplay(partsKey).abbreviations, () => false);
  const namesKey = fullNamesKey(scope, documentId);
  const written = useSyncExternalStore(subscribeFullNames, () => readFullNames(namesKey), () => NO_NAMES);
  const subscribeDoc = useMemo(() => editor === null ? noEditor : (listener: () => void) => {
    editor.on("update", listener);
    return () => { editor.off("update", listener); };
  }, [editor]);
  const doc = useSyncExternalStore(subscribeDoc, () => editor?.state.doc ?? null, () => null);
  const list = useMemo(() => on && doc !== null ? listAbbreviations(textBlocks(doc), written) : [], [on, doc, written]);
  const [editing, setEditing] = useState<Abbreviation | null>(null);
  if (!on || editor === null) return null;
  return (
    <>
      <SheetAbbreviationsBox list={list} onEdit={editor.isEditable ? setEditing : undefined} />
      {editing === null ? null : (
        <AbbreviationDialog abbreviation={editing} onClose={() => setEditing(null)}
          onSave={(full) => { writeFullName(namesKey, editing.abbreviation, full); setEditing(null); }} />
      )}
    </>
  );
}
