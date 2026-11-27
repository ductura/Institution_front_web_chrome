"use client";

// ED-109: the bubble beside a selection (prototype #selBub). Mounted beside the student's toolbar; it reads the
// local editor and draws itself under <body>, fixed over the text. Mousedown inside it keeps the selection.
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";

import { useLocalEditor } from "@/components/editor/LocalDocument";
import { citationRange } from "@/components/editor/citations/citation-document";
import { requestCiteOpen } from "@/components/editor/citations/open-cite";
import { convertBlock } from "@/components/editor/toolbar-menu";

import { useStudentToast } from "../../student/toast/StudentToasts";
import type { Store } from "../left/left-model";
import { storageKey } from "../left/left-model";
import { announceDeviceChange } from "../left/use-left";
import { BUBBLE_DELAY_MS, bubblePlace, bubbleText, caretToEnd, selectionToFootnote, stashText, type BubbleAction } from "./bubble-model";
import { selectionBubbleHr as t } from "./messages.hr";
import styles from "./SelectionBubble.module.css";

type Shown = { top: number; left: number; text: string; can: Record<BubbleAction, boolean> };

const ORDER: readonly BubbleAction[] = ["cite", "toQuote", "toFootnote", "stash"];
const LABEL: Record<BubbleAction, string> = { cite: t.cite, toQuote: t.toQuote, toFootnote: t.toFootnote, stash: t.stash };
const HINT: Record<BubbleAction, string> = { cite: t.citeHint, toQuote: t.toQuoteHint, toFootnote: t.toFootnoteHint, stash: t.stashHint };

function browserStore(): Store | null {
  try { return window.localStorage; } catch { return null; }
}

/** A dialog or the command palette is open: the bubble stays away (prototype: "nema dijaloga ni palete"). */
const dialogOpen = () => document.querySelector("dialog[open], [role='dialog'][aria-modal='true']") !== null;

function placeOf(editor: Editor) {
  const { from, to } = editor.state.selection;
  try {
    const a = editor.view.coordsAtPos(from);
    const b = editor.view.coordsAtPos(to);
    return bubblePlace({ top: Math.min(a.top, b.top), bottom: Math.max(a.bottom, b.bottom), left: Math.min(a.left, b.left), right: Math.max(a.right, b.right) },
      { width: window.innerWidth, height: window.innerHeight });
  } catch {
    return { top: 0, left: 0, below: false };
  }
}

export function SelectionBubbleHost({ workId, confirmedWorkSchemaVersion }: { workId: string; confirmedWorkSchemaVersion?: number }) {
  const editor = useLocalEditor();
  return editor ? <SelectionBubble editor={editor} workId={workId} version={confirmedWorkSchemaVersion} /> : null;
}

export function SelectionBubble({ editor, workId, version, store = browserStore, delay = BUBBLE_DELAY_MS }: {
  editor: Editor; workId: string; version?: number; store?: () => Store | null; delay?: number;
}) {
  const [shown, setShown] = useState<Shown | null>(null);
  const toast = useStudentToast();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
    const hide = () => { clear(); setShown(null); };
    const look = () => {
      hide();
      timer.current = setTimeout(() => {
        timer.current = null;
        if (editor.isDestroyed || !editor.isEditable || dialogOpen()) return;
        const text = bubbleText(editor.state);
        if (!text) return;
        const state = editor.state;
        const atEnd = state.apply(caretToEnd(state));
        const { top, left } = placeOf(editor);
        setShown({ top, left, text, can: {
          cite: citationRange(atEnd) !== null,
          toQuote: !editor.isActive("quote"),
          toFootnote: selectionToFootnote(state, version) !== null,
          stash: true,
        } });
      }, delay);
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") hide(); };
    editor.on("selectionUpdate", look);
    editor.on("update", hide);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    window.addEventListener("keydown", key);
    return () => {
      clear();
      editor.off("selectionUpdate", look);
      editor.off("update", hide);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
      window.removeEventListener("keydown", key);
    };
  }, [editor, version, delay]);

  if (!shown) return null;

  const run = (action: BubbleAction) => {
    setShown(null);
    if (editor.isDestroyed || !editor.isEditable) return;
    if (action === "cite") {
      editor.view.dispatch(caretToEnd(editor.state));
      editor.commands.focus();
      requestCiteOpen();
    } else if (action === "toQuote") {
      convertBlock(editor, "quote");
    } else if (action === "toFootnote") {
      const tr = selectionToFootnote(editor.state, version);
      if (!tr) { toast(t.footnoteFailed); return; }
      editor.view.dispatch(tr);
      editor.commands.focus();
    } else {
      const key = storageKey("stash", workId);
      if (!stashText(store(), workId, shown.text, crypto.randomUUID(), new Date().toISOString())) { toast(t.stashFailed); return; }
      announceDeviceChange(key);
      editor.chain().deleteSelection().focus().run();
      toast(t.stashed);
    }
  };

  // role=toolbar: the arrows move between the buttons.
  const arrows = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const buttons = [...(bar.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = buttons[(at + (e.key === "ArrowRight" ? 1 : -1) + buttons.length) % buttons.length];
    next?.focus();
    e.preventDefault();
  };

  return createPortal(
    <div ref={bar} role="toolbar" aria-label={t.label} className={styles.bubble} style={{ top: shown.top, left: shown.left }}
      onMouseDown={(e) => e.preventDefault()} onKeyDown={arrows}>
      {ORDER.map((action) => (
        <button key={action} type="button" title={HINT[action]} disabled={!shown.can[action]} onClick={() => run(action)}>
          {LABEL[action]}
        </button>
      ))}
    </div>,
    document.body,
  );
}
