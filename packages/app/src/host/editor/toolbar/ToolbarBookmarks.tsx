"use client";

// ED-102 (prototype toolbar2.js menu-marks): "Oznake" on the bar lists the marked paragraphs, jumps to one, takes one
// off, and "Označi ovaj odlomak" marks the paragraph at the cursor. Only in this browser, for this work.
import { useEffect, useRef, useState } from "react";
import { Button, Popover } from "@ductura/ui";
import type { Editor } from "@tiptap/core";

import { addBookmark, loadBookmarks, placeBookmarks, removeBookmark, saveBookmarks, type Bookmark } from "./bookmarks";
import { toolbarBehaviourHr as hr } from "./messages.hr";

const store = (): Storage | null => { try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; } };
const newId = () => `mk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** Marks the paragraph at the cursor; says how it went. */
export function markHere(editor: Editor | null, marks: readonly Bookmark[]): { marks: Bookmark[]; text: string } {
  if (!editor || editor.isDestroyed) return { marks: [...marks], text: hr.markNone };
  const done = addBookmark(marks, editor.state.doc, editor.state.selection.from, newId());
  return { marks: done.marks, text: done.result === "added" ? hr.markAdded : done.result === "already" ? hr.markAlready : hr.markNone };
}

export function ToolbarBookmarks({ editor, work, toast }: { editor: Editor | null; work: string; toast: (text: string) => void }) {
  const anchor = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [marks, setMarks] = useState<Bookmark[]>([]);
  // Read after mount, so the server's markup and the first client render agree.
  useEffect(() => { setMarks(loadBookmarks(work, store())); }, [work]);
  const keep = (next: Bookmark[]) => { setMarks(next); saveBookmarks(work, next, store()); };
  const placed = open && editor && !editor.isDestroyed ? placeBookmarks(marks, editor.state.doc) : [];
  const go = (pos: number) => {
    setOpen(false);
    if (!editor || editor.isDestroyed) return;
    editor.chain().setTextSelection(pos + 1).scrollIntoView().focus().run();
  };

  return (
    <>
      <Button ref={anchor} tone="quiet" aria-haspopup="dialog" aria-expanded={open} title={hr.marksTip}
        onClick={() => setOpen((o) => !o)}>{hr.marks}</Button>
      <Popover open={open} anchor={anchor} label={hr.marks} onClose={() => setOpen(false)}>
        <h3>{hr.marks}</h3>
        <Button tone="quiet" disabled={!editor?.isEditable} onClick={() => {
          setOpen(false);
          const done = markHere(editor, marks);
          keep(done.marks);
          toast(done.text);
        }}>{hr.markAdd} <small>{hr.markAddNote}</small></Button>
        {placed.length ? (
          <ul>{placed.map((m) => (
            <li key={m.id}>
              <Button tone="quiet" onClick={() => go(m.pos)}>{m.label} <small>{m.where}</small></Button>
              <Button tone="quiet" aria-label={hr.markRemove} title={hr.markRemove} onClick={() => keep(removeBookmark(marks, m.id))}>✕</Button>
            </li>
          ))}</ul>
        ) : <p>{hr.marksEmpty}</p>}
      </Popover>
    </>
  );
}
