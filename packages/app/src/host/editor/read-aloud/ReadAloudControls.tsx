"use client";

// WEB-V20-NAGLAS-UREDNIK: the "Čitaj naglas" menu of the student's toolbar: paragraph, selection, whole work,
// pause/resume and stop. Runs the reading of ReadAloudHost over the same editor; nothing here edits the document.
import { useState } from "react";
import { Button, ContextMenu, type MenuEntry, type MenuPoint } from "@ductura/ui";

import { readingOf, useEditorReading } from "./ReadAloudHost";
import type { ReadScope } from "./highlight";
import { readAloudHr as t } from "./messages.hr";

type EditorArg = Parameters<typeof readingOf>[0];

/** Menu entries for a state: three ways to start, then pause/resume and stop while a reading is on. */
export function readAloudEntries(state: "unsupported" | "idle" | "reading" | "paused"): MenuEntry[] {
  const off = state === "unsupported";
  const on = state === "reading" || state === "paused";
  return [
    { kind: "item", id: "paragraph", label: t.paragraph, disabled: off },
    { kind: "item", id: "selection", label: t.selection, disabled: off },
    { kind: "item", id: "work", label: t.work, disabled: off },
    { kind: "item", id: state === "paused" ? "resume" : "pause", label: state === "paused" ? t.resume : t.pause, disabled: !on },
    { kind: "item", id: "stop", label: t.stop, disabled: !on },
  ];
}

export function ReadAloudControls({ editor }: { editor: EditorArg | null }) {
  const [anchor, setAnchor] = useState<MenuPoint | null>(null);
  const snap = useEditorReading(editor);
  const usable = !!editor && !editor.isDestroyed;
  const run = (id: string) => {
    if (!editor || editor.isDestroyed) return;
    const reading = readingOf(editor);
    if (id === "paragraph" || id === "selection" || id === "work") reading.read(id as ReadScope);
    else if (id === "pause") reading.pause();
    else if (id === "resume") reading.resume();
    else if (id === "stop") reading.stop();
  };
  return (
    <>
      <Button tone="quiet" aria-haspopup="menu" disabled={!usable}
        onClick={(e) => { const b = e.currentTarget.getBoundingClientRect(); setAnchor({ x: b.left, y: b.bottom }); }}>{t.menu} ▾</Button>
      <ContextMenu anchor={anchor} entries={readAloudEntries(snap.state)} label={t.menu} onClose={() => setAnchor(null)}
        onSelect={(id) => { setAnchor(null); run(id); }} />
    </>
  );
}
