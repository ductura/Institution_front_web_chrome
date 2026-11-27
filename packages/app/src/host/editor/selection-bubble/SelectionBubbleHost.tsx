"use client";

// ED-75: the bubble beside the selected text (prototype toolbar2.js `showBub`, #selBub). A moment after the
// selection settles on three or more characters of a work that can be written in, a small bar stands above
// the selection with what can be done to it: Komentar, Navod, U blok-citat, U fusnotu, Odloži. Each runs the
// path the rest of the editor already has; the bubble itself never changes the document on its own.
// Pressing a button keeps the selection (mousedown does not take the focus from the text).
import type { Editor } from "@tiptap/core";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useLocalEditor } from "@/components/editor/LocalDocument";
import { insertAcademicAtom } from "@/components/editor/footnotes/inline-atoms";
import { requestPanel } from "@/components/editor/layout-prefs/open-panel";
import { convertBlock } from "@/components/editor/toolbar-menu";
import { requestCiteAtCaret } from "@/components/editor/triggers/TriggerPopover";

import { useStudentToast } from "../../student/toast/StudentToasts";
import { askComment } from "../comments/ask-comment";
import { prepareFootnoteText } from "../footnote/footnote-model";
import { parseStash, stashAdd } from "../left/left-model";
import { useDeviceValue } from "../left/use-left";
import { bubbleActions, bubblePlace, DELAY_MS, type BubbleAction, type Box } from "./bubble-model";
import { selectionBubbleHr as t } from "./messages.hr";
import styles from "./SelectionBubble.module.css";

type Shown = { readonly actions: BubbleAction[]; readonly box: Box };
type Props = { editor: Editor; workId: string; version: number | undefined; delay?: number };

const newId = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

export function SelectionBubbleHost({ workId, confirmedWorkSchemaVersion }: { workId: string; confirmedWorkSchemaVersion?: number }) {
  const editor = useLocalEditor();
  return editor ? <SelectionBubble editor={editor} workId={workId} version={confirmedWorkSchemaVersion} /> : null;
}

/** Where the selection stands on the screen; the editor's own box when the browser cannot measure it. */
function selectionBox(editor: Editor, from: number, to: number): Box {
  try {
    const a = editor.view.coordsAtPos(from);
    const b = editor.view.coordsAtPos(to);
    const left = Math.min(a.left, b.left);
    return { left, top: Math.min(a.top, b.top), width: Math.max(a.right, b.right) - left, bottom: Math.max(a.bottom, b.bottom) };
  } catch {
    const r = editor.view.dom.getBoundingClientRect();
    return { left: r.left, top: r.top, width: r.width, bottom: r.top };
  }
}

export function SelectionBubble({ editor, workId, version, delay = DELAY_MS }: Props) {
  const [shown, setShown] = useState<Shown | null>(null);
  const box = useRef<HTMLDivElement | null>(null);
  const [stash, setStash] = useDeviceValue("stash", workId, parseStash, []);
  const toast = useStudentToast();

  const selected = useCallback(() => {
    const { from, to, empty } = editor.state.selection;
    return { from, to, text: empty ? "" : editor.state.doc.textBetween(from, to, " ", " ") };
  }, [editor]);

  const update = useCallback(() => {
    if (editor.isDestroyed) return setShown(null);
    const inBubble = box.current !== null && box.current.contains(document.activeElement);
    const { from, to, text } = selected();
    const actions = bubbleActions({
      editable: editor.isEditable && (editor.view.hasFocus() || inBubble),
      text,
      inQuote: editor.isActive("quote"),
      footnote: insertAcademicAtom(editor.state, version, "footnote", { text: "x" }) !== null,
    });
    setShown(actions === null ? null : { actions, box: selectionBox(editor, from, to) });
  }, [editor, selected, version]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const later = () => { clearTimeout(timer); timer = setTimeout(update, delay); };
    const hide = (event?: Event) => {
      if (event?.target instanceof Node && box.current?.contains(event.target)) return;
      clearTimeout(timer);
      setShown(null);
    };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") hide(); };
    document.addEventListener("selectionchange", later);
    editor.on("selectionUpdate", later);
    editor.on("blur", later);
    document.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    document.addEventListener("keydown", key);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("selectionchange", later);
      editor.off("selectionUpdate", later);
      editor.off("blur", later);
      document.removeEventListener("scroll", hide, true);
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

  const run = (action: BubbleAction) => {
    setShown(null);
    if (editor.isDestroyed || !editor.isEditable) return;
    const { to, text } = selected();
    if (action === "comment") {
      requestPanel("comments");
      askComment("");
    } else if (action === "cite") {
      editor.chain().setTextSelection(to).focus().run();
      if (!requestCiteAtCaret(editor)) requestPanel("sources");
    } else if (action === "toQuote") {
      if (!convertBlock(editor, "quote")) toast(t.failed, "error");
    } else if (action === "toFootnote") {
      const note = prepareFootnoteText(text);
      const tr = note ? insertAcademicAtom(editor.state, version, "footnote", { text: note }) : null;
      if (tr === null) return toast(t.failed, "error");
      editor.view.dispatch(tr.scrollIntoView());
      editor.commands.focus();
      toast(t.footnoteDone);
    } else {
      if (!setStash(stashAdd(stash, text, newId(), new Date().toISOString()))) return toast(t.stashFailed, "error");
      editor.chain().deleteSelection().focus().run();
      toast(t.stashed);
    }
  };

  if (!shown) return null;
  return createPortal(
    <div ref={box} className={styles.bubble} role="toolbar" aria-label={t.label} data-selection-bubble=""
      onMouseDown={(event) => event.preventDefault()}>
      {shown.actions.map((a) => (
        <button key={a} type="button" data-act={a} onClick={() => run(a)}>{t.actions[a]}</button>
      ))}
    </div>,
    document.body,
  );
}
