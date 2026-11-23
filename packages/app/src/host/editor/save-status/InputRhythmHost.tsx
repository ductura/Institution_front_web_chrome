"use client";

// PIL-P1-RITAM-EDITOR (P-1 rule 4): the rhythm of entry in the working editor. Mounted only in
// the student's own writing (EditorSessionControls of /rad), never in a replay or a teacher's
// view, and it listens only while the editor can be written in. What is recorded and sent is
// decided in src/client/input-rhythm.ts (gaps only, never a key, text or speed); the switch of
// the work decides whether anything is recorded at all.
import { useEffect, useMemo, useState } from "react";

import { createRhythmPort, type RhythmPort } from "@/client/input-rhythm";
import { useInputRhythm } from "@/components/editor/rhythm";

/** The editor the student writes in; a read-only or replayed one is not contenteditable. */
export const WRITABLE_EDITOR = '.ProseMirror[contenteditable="true"]';

/** The writable editor now in the page, or null. */
export function writableEditor(root: ParentNode = document): HTMLElement | null {
  return root.querySelector<HTMLElement>(WRITABLE_EDITOR);
}

export function InputRhythmHost({ documentId, port }: { documentId: string; port?: RhythmPort }) {
  const [dom, setDom] = useState<HTMLElement | null>(null);
  const rhythm = useMemo(() => port ?? createRhythmPort(), [port]);
  // The editor mounts after the page and becomes read-only on submit: follow it, do not assume it.
  useEffect(() => {
    const follow = () => setDom((current) => {
      const next = writableEditor();
      return current === next ? current : next;
    });
    follow();
    const observer = new MutationObserver(follow);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["contenteditable"] });
    return () => observer.disconnect();
  }, []);
  useInputRhythm(dom, documentId, rhythm);
  return null;
}
