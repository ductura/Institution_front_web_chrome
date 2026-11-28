"use client";

// ED-75: the bubble beside the selected text (prototype toolbar2.js `showBub`, #selBub). A moment after the
// selection settles on three or more characters of a work that can be written in, a small bar stands above
// the selection with what can be done to it: Komentar, Navod, U blok-citat, U fusnotu, Odloži.
// ED-91: the right-click menu in the text (prototype more2.js `ctxMenu`) offers the same and a little more.
// Both run the actions in selection-actions.ts; the bubble itself never changes the document on its own.
// Pressing a button keeps the selection (mousedown does not take the focus from the text).
import type { Editor } from "@tiptap/core";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useLocalEditor } from "@/components/editor/LocalDocument";

import { bubbleActions, bubblePlace, DELAY_MS, type BubbleAction, type Box } from "./bubble-model";
import { selectionBubbleHr as t } from "./messages.hr";
import { selectionFacts, useSelectionActions } from "./selection-actions";
import { TextMenu } from "./TextMenu";
import styles from "./SelectionBubble.module.css";

type Shown = { readonly actions: BubbleAction[]; readonly box: Box };
type Props = { editor: Editor; workId: string; version: number | undefined; delay?: number };

export function SelectionBubbleHost({ workId, confirmedWorkSchemaVersion }: { workId: string; confirmedWorkSchemaVersion?: number }) {
  const editor = useLocalEditor();
  if (!editor) return null;
  return (
    <>
      <SelectionBubble editor={editor} workId={workId} version={confirmedWorkSchemaVersion} />
      <TextMenu editor={editor} workId={workId} version={confirmedWorkSchemaVersion} />
    </>
  );
}

/** Where the selection stands on the screen; the editor's own box when the browser cannot measure it. */
function selectionBox(editor: Editor, from: number, to: number): Box {
  try {
    const a = editor.view.coordsAtPos(from);
    const b = editor.view.coordsAtPos(to);
    const left = Math.min(a.left, b.left);
    // ["top"]: the API scanner reads a bare `top` key as the window alias.
    return { left, ["top"]: Math.min(a.top, b.top), width: Math.max(a.right, b.right) - left, bottom: Math.max(a.bottom, b.bottom) };
  } catch {
    const r = editor.view.dom.getBoundingClientRect();
    return { left: r.left, ["top"]: r.top, width: r.width, bottom: r.top };
  }
}

export function SelectionBubble({ editor, workId, version, delay = DELAY_MS }: Props) {
  const [shown, setShown] = useState<Shown | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const run = useSelectionActions(editor, workId, version);

  const update = useCallback(() => {
    if (editor.isDestroyed) return setShown(null);
    const inBubble = box.current !== null && box.current.contains(document.activeElement);
    const { from, to } = editor.state.selection;
    const actions = bubbleActions({ editable: editor.isEditable && (editor.view.hasFocus() || inBubble), ...selectionFacts(editor, version) });
    setShown(actions === null ? null : { actions, box: selectionBox(editor, from, to) });
  }, [editor, version]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const later = () => { clearTimeout(timer); timer = setTimeout(update, delay); };
    const hide = (event?: Event) => {
      if (event?.type === "scroll" && event.target instanceof Node && box.current?.contains(event.target)) return;
      clearTimeout(timer);
      setShown(null);
    };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") hide(); };
    document.addEventListener("selectionchange", later);
    editor.on("selectionUpdate", later);
    editor.on("blur", later);
    document.addEventListener("scroll", hide, true);
    document.addEventListener("contextmenu", hide, true);
    window.addEventListener("resize", hide);
    document.addEventListener("keydown", key);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("selectionchange", later);
      editor.off("selectionUpdate", later);
      editor.off("blur", later);
      document.removeEventListener("scroll", hide, true);
      document.removeEventListener("contextmenu", hide, true);
      window.removeEventListener("resize", hide);
      document.removeEventListener("keydown", key);
    };
  }, [editor, update, delay]);

  // Placed once its width is known, as in the prototype.
  useLayoutEffect(() => {
    const el = box.current;
    if (!shown || !el) return;
    const at = bubblePlace(shown.box, el.offsetWidth, { width: window.innerWidth, height: window.innerHeight });
    el.style.left = `${at.left}px`;
    el.style.top = `${at.top}px`;
  }, [shown]);

  if (!shown) return null;
  return createPortal(
    <div ref={box} className={styles.bubble} role="toolbar" aria-label={t.label} data-selection-bubble=""
      onMouseDown={(event) => event.preventDefault()}>
      {shown.actions.map((a) => (
        <button key={a} type="button" data-act={a} onClick={() => { setShown(null); run(a); }}>{t.actions[a]}</button>
      ))}
    </div>,
    document.body,
  );
}
