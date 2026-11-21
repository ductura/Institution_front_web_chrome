"use client";

// WEB-1609 (M5.14a-c, D-234): the "Struktura" card of the Draft panel. Chapters
// are listed from the live projection; a chapter moves by dragging it onto a
// sibling, by its buttons or by Alt+Shift+↑/↓ (focus on its row). A note per
// chapter is the student's alone: it stays beside the work and is never part
// of the document, the export or a submission.
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { createTocStore, EMPTY_TOC, goToHeading, moveChapterInEditor, type TocEditor } from "../../../../../editor-core/src/outline/index.ts";
import { Button, TextArea } from "@ductura/ui";

import { draftRows, dragSteps, loadNotes, MAX_NOTE_LENGTH, pruneNotes, saveNotes, withNote, type ChapterNotes, type NoteStorage } from "./draft-model";
import { draftHr as t } from "./messages.hr";

function browserStorage(): NoteStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function DraftPanelHost({ editor, workId, storage }: { editor: TocEditor | null; workId: string; storage?: NoteStorage | null }) {
  const store = useMemo(() => createTocStore(editor), [editor]);
  const toc = useSyncExternalStore(store.subscribe, store.getSnapshot, () => EMPTY_TOC);
  const [notes, setNotes] = useState<ChapterNotes>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const noteStore = storage === undefined ? browserStorage() : storage;

  useEffect(() => { setNotes(loadNotes(noteStore, workId)); }, [noteStore, workId]);

  const keys = toc.entries.map((e) => e.key);
  useEffect(() => {
    if (keys.length === 0) return;
    setNotes((current) => {
      const pruned = pruneNotes(current, keys);
      if (Object.keys(pruned).length === Object.keys(current).length) return current;
      saveNotes(noteStore, workId, pruned);
      return pruned;
    });
    // keys changes identity every render; the joined text is the dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys.join("|"), noteStore, workId]);

  const rows = draftRows(toc.entries, notes);
  const move = (key: string, direction: "up" | "down", times = 1) => {
    if (!editor) return;
    let done = false;
    for (let i = 0; i < times; i += 1) done = moveChapterInEditor(editor, direction, key) || done;
    if (done) setAnnounce(t.moved);
  };
  const edit = (key: string, text: string) => {
    const next = withNote(notes, key, text);
    setNotes(next);
    saveNotes(noteStore, workId, next);
  };

  if (rows.length === 0) return <p data-draft-panel="">{t.empty}</p>;
  const editable = toc.editable && editor !== null;

  return (
    <section data-draft-panel="" aria-label={t.label}>
      <p>{t.dragHint}</p>
      <ol>
        {rows.map((row, i) => (
          <li
            key={row.key}
            data-chapter={row.key}
            data-level={row.level}
            draggable={editable}
            onDragStart={() => setDragging(row.key)}
            onDragEnd={() => setDragging(null)}
            onDragOver={(e) => { if (editable && dragging) e.preventDefault(); }}
            onDrop={(e) => {
              e.preventDefault();
              const steps = dragging ? dragSteps(toc.entries, dragging, row.key) : null;
              if (dragging && steps) move(dragging, steps.direction, steps.times);
              setDragging(null);
            }}
            onKeyDown={(e) => {
              if (!editable || !e.altKey || !e.shiftKey || e.target !== e.currentTarget) return;
              if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                e.preventDefault();
                move(row.key, e.key === "ArrowUp" ? "up" : "down");
              }
            }}
            tabIndex={0}
            aria-label={`${row.number}. ${row.title === "" ? t.untitled : row.title}`}
          >
            <button type="button" onClick={() => { if (editor) goToHeading(editor, row.key); }}>
              {row.number}. {row.title === "" ? t.untitled : row.title}
            </button>
            {editable ? (
              <span role="group" aria-label={t.drag}>
                <Button tone="quiet" disabled={i === 0} aria-keyshortcuts="Alt+Shift+ArrowUp" onClick={() => move(row.key, "up")}>{t.moveUp}</Button>
                <Button tone="quiet" disabled={i === rows.length - 1} aria-keyshortcuts="Alt+Shift+ArrowDown" onClick={() => move(row.key, "down")}>{t.moveDown}</Button>
              </span>
            ) : null}
            <TextArea
              label={t.noteLabel}
              hint={t.noteHint}
              placeholder={t.notePlaceholder}
              maxLength={MAX_NOTE_LENGTH}
              value={notes[row.key] ?? ""}
              onChange={(e) => edit(row.key, e.target.value)}
            />
          </li>
        ))}
      </ol>
      <p role="status">{announce}</p>
    </section>
  );
}
