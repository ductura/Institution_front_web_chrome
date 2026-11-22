"use client";

// WEB-2126: the chapter sheet under "Struktura" (prototype rail.js: state chip,
// ↑↓, "Više radnji ⋯", purpose and note, thesis). The state, purpose, note and
// thesis stay on this device; nothing here enters the text, the export or a
// submission. "Pitaj mentora" and "Prikaži samo ovo poglavlje" need the server
// or a view the editor does not offer yet, so they say "nedostupno".
import { useMemo, useState, useSyncExternalStore } from "react";
import { Button, Select, TextArea } from "@ductura/ui";

import { createTocStore, EMPTY_TOC, headingPosition, moveChapterInEditor } from "../../../../../editor-core/src/outline/index.ts";
import { useLocalEditor } from "../../../../../../src/components/editor/LocalDocument.tsx";
import { CHAPTER_STATES, defaultState, parseStates, parseTextMap, parseThread, EMPTY_THREAD, withText, type ChapterState } from "./left-model";
import { leftHr as t } from "./messages.hr";
import { useDeviceValue, useEditorRead, useWorkSnapshot } from "./use-left";
import styles from "./Left.module.css";

export function ChapterPanel({ workId }: { workId: string }) {
  const editor = useLocalEditor();
  const store = useMemo(() => createTocStore(editor), [editor]);
  const toc = useSyncExternalStore(store.subscribe, store.getSnapshot, () => EMPTY_TOC);
  const snap = useWorkSnapshot();
  const [states, setStates] = useDeviceValue("states", workId, parseStates, {});
  const [purposes, setPurposes] = useDeviceValue("purpose", workId, parseTextMap, {});
  const [notes, setNotes] = useDeviceValue("note", workId, parseTextMap, {});
  const [thread, setThread] = useDeviceValue("thread", workId, parseThread, EMPTY_THREAD);
  const [message, setMessage] = useState("");
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [editingThesis, setEditingThesis] = useState(false);
  const key = toc.currentKey;
  const entry = toc.entries.find((e) => e.key === key);
  const index = toc.entries.findIndex((e) => e.key === key);
  const live = useEditorRead(editor, (i) => i.isEditable, false);

  const thesis = (
    <div className={styles.stack}>
      {editingThesis ? (
        <>
          <TextArea label={t.thesis.label} hint={t.thesis.hint} rows={3} defaultValue={thread.question} maxLength={2000}
            onBlur={(e) => { setThread({ ...thread, question: e.currentTarget.value.trim() }); setEditingThesis(false); }} autoFocus />
        </>
      ) : thread.question ? (
        <p className={styles.row}><span><strong>{t.thesis.label}:</strong> {thread.question}</span>
          <Button tone="quiet" onClick={() => setEditingThesis(true)}>{t.thesis.edit}</Button></p>
      ) : <Button tone="quiet" onClick={() => setEditingThesis(true)} disabled={!live}>{t.thesis.add}</Button>}
    </div>
  );

  if (!entry || !editor || editor.isDestroyed) {
    return <div className={styles.sheet}>{thesis}<p className={styles.muted}>{snap.headings.length === 0 ? t.title.none : t.chapter.none}</p></div>;
  }

  const words = snap.words[index] ?? 0;
  const state: ChapterState = states[entry.key] ?? defaultState(words);
  const pos = headingPosition(editor.state, entry.key);

  const move = (direction: "up" | "down") => {
    const canMove = direction === "up" ? toc.canMoveUp : toc.canMoveDown;
    setMessage(canMove && moveChapterInEditor(editor, direction, entry.key) ? t.chapter.moved
      : direction === "up" ? t.chapter.alreadyFirst : t.chapter.alreadyLast);
  };
  const heading = () => (pos === null ? null : editor.state.doc.nodeAt(pos));
  const subtreeEnd = (from: number, level: number) => {
    let end = editor.state.doc.content.size;
    let found = false;
    editor.state.doc.forEach((node, offset) => {
      if (!found && offset > from && node.type.name === "heading" && Number(node.attrs.level) <= level) { end = offset; found = true; }
    });
    return end;
  };
  const setLevel = (delta: number) => {
    const node = heading();
    if (!node || pos === null) return;
    const level = Math.min(3, Math.max(1, Number(node.attrs.level) + delta));
    if (level === node.attrs.level) return;
    editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, undefined, { ...node.attrs, level }));
    setMenu(false);
  };
  const addSub = () => {
    const node = heading();
    if (!node || pos === null) return;
    const level = Math.min(3, Number(node.attrs.level) + 1);
    const end = subtreeEnd(pos, Number(node.attrs.level));
    editor.chain().insertContentAt(end, { type: "heading", attrs: { level } }).setTextSelection(end + 1).focus().run();
    setMenu(false);
  };
  const rename = () => {
    const node = heading();
    if (!node || pos === null) return;
    editor.chain().setTextSelection({ from: pos + 1, to: pos + node.nodeSize - 1 }).focus().run();
    setMenu(false);
  };
  const remove = () => {
    const node = heading();
    if (!node || pos === null) return;
    editor.chain().deleteRange({ from: pos, to: subtreeEnd(pos, Number(node.attrs.level)) }).focus().run();
    setConfirm(false);
    setMenu(false);
  };

  return (
    <div className={styles.sheet} role="group" aria-label={t.chapter.label}>
      {thesis}
      <div className={styles.row}>
        <Select label={t.chapter.state} value={state} disabled={!live}
          options={CHAPTER_STATES.map((s) => ({ value: s, label: t.chapter.states[s] }))}
          onChange={(e) => { setStates({ ...states, [entry.key]: e.currentTarget.value as ChapterState }); setMessage(t.chapter.saved); }} />
        <span className={styles.row}>
          <Button tone="quiet" disabled={!live} aria-keyshortcuts="Alt+Shift+ArrowUp" onClick={() => move("up")}>↑<span className="sr-only"> {t.chapter.moveUp}</span></Button>
          <Button tone="quiet" disabled={!live} aria-keyshortcuts="Alt+Shift+ArrowDown" onClick={() => move("down")}>↓<span className="sr-only"> {t.chapter.moveDown}</span></Button>
        </span>
      </div>
      <Button tone="quiet" aria-expanded={menu} aria-label={t.chapter.moreLabel} onClick={() => { setMenu(!menu); setConfirm(false); }}>{t.chapter.more}</Button>
      {menu && (
        <div className={styles.menu} role="group" aria-label={t.chapter.moreLabel}>
          <Button tone="quiet" disabled={!live || entry.level >= 3} onClick={addSub}>{t.chapter.addSub}</Button>
          <Button tone="quiet" disabled={!live} onClick={rename}>{t.chapter.rename}</Button>
          <Button tone="quiet" disabled={!live || entry.level <= 1} onClick={() => setLevel(-1)}>{t.chapter.raise}</Button>
          <Button tone="quiet" disabled={!live || entry.level >= 3} onClick={() => setLevel(1)}>{t.chapter.lower}</Button>
          <Button tone="quiet" aria-disabled="true" onClick={(e) => e.preventDefault()}>{t.chapter.askMentor} ({t.chapter.unavailable})</Button>
          <Button tone="quiet" aria-disabled="true" onClick={(e) => e.preventDefault()}>{t.chapter.onlyThis} ({t.chapter.unavailable})</Button>
          {confirm ? (
            <div role="alertdialog" aria-label={t.chapter.remove}>
              <p>{t.chapter.removeConfirm}</p>
              <Button onClick={remove}>{t.chapter.removeYes}</Button>
              <Button tone="quiet" onClick={() => setConfirm(false)}>{t.chapter.removeNo}</Button>
            </div>
          ) : <Button tone="quiet" disabled={!live} onClick={() => setConfirm(true)}>{t.chapter.remove}</Button>}
        </div>
      )}
      <TextArea label={t.chapter.purpose} hint={t.chapter.purposeHint} rows={2} key={`p${entry.key}`} defaultValue={purposes[entry.key] ?? ""} maxLength={2000}
        onBlur={(e) => { setPurposes(withText(purposes, entry.key, e.currentTarget.value)); setMessage(t.chapter.saved); }} />
      <TextArea label={t.chapter.note} hint={t.chapter.noteHint} rows={3} key={`n${entry.key}`} defaultValue={notes[entry.key] ?? ""} maxLength={2000}
        onBlur={(e) => { setNotes(withText(notes, entry.key, e.currentTarget.value)); setMessage(t.chapter.saved); }} />
      <p role="status" className={styles.live}>{message}</p>
    </div>
  );
}
