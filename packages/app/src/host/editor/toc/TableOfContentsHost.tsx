"use client";

// WEB-1602 (M5.3, DAN-395): the live table of contents of the editor shell.
// It reads the editor through createTocStore, so it is redrawn on every change
// that alters a line and on no other. A click looks the heading up by block id
// at that moment; the move buttons and Alt+Shift+↑/↓ reorder whole chapters
// without changing any id. Read-only works get the list and the copy only.
import { useMemo, useState, useSyncExternalStore } from "react";

import { createTocStore, EMPTY_TOC, goToHeading, moveChapterInEditor, type TocEditor } from "@ductura/editor-core/outline";
import { Button, EditorOutline } from "@ductura/ui";

import { tocHr as t } from "./messages.hr";
import { moveButtons, outlineEntriesOf, tocCopyText } from "./toc-model";

export function TableOfContentsHost({ editor }: { editor: TocEditor | null }) {
  const store = useMemo(() => createTocStore(editor), [editor]);
  const toc = useSyncExternalStore(store.subscribe, store.getSnapshot, () => EMPTY_TOC);
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const moves = moveButtons(toc);

  const copyToc = async () => {
    try {
      await navigator.clipboard.writeText(tocCopyText(toc));
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
  };

  return (
    <div data-toc="">
      <EditorOutline
        entries={outlineEntriesOf(toc)}
        currentId={toc.currentKey}
        onSelect={(key) => { if (editor) goToHeading(editor, key); }}
        label={t.label}
      />
      {moves && editor ? (
        <div role="group" aria-label={t.moveHint}>
          <Button tone="quiet" disabled={!moves.up} aria-keyshortcuts="Alt+Shift+ArrowUp" onClick={() => moveChapterInEditor(editor, "up")}>
            {t.moveUp}
          </Button>
          <Button tone="quiet" disabled={!moves.down} aria-keyshortcuts="Alt+Shift+ArrowDown" onClick={() => moveChapterInEditor(editor, "down")}>
            {t.moveDown}
          </Button>
        </div>
      ) : null}
      {toc.entries.length > 0 ? (
        <Button tone="quiet" onClick={() => void copyToc()}>{t.copy}</Button>
      ) : null}
      <p role="status">{copy === "copied" ? t.copied : copy === "failed" ? t.copyFailed : ""}</p>
    </div>
  );
}
