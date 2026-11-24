"use client";

// WEB-1908, mounted by PIL-D8-PRECACI (P-D8): the shortcut list opens from its button in the
// shell's view bar, by the question mark key outside a text field and by Ctrl/Cmd+/ (ED-03, through the editor
// commands); Esc or "Zatvori" closes it (shared Dialog).
// The list is the one definition in shortcut-definitions.ts; the editor commands read it too.
import { useCallback, useEffect, useState } from "react";
import { Button, ShortcutListDialog } from "@ductura/ui";

import { shortcutsHostHr as t } from "./messages.hr";
import { SHORTCUT_LIST_EVENT, shortcutListGroups } from "./shortcut-definitions";
import { opensEditorShortcutList } from "./shortcut-key";

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/u.test(navigator.platform ?? "");

export function EditorShortcutListHost({ editable }: { editable: boolean }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((value) => !value), []);
  useEffect(() => {
    const on = (event: KeyboardEvent) => {
      if (!opensEditorShortcutList(event)) return;
      event.preventDefault();
      toggle();
    };
    // ED-03: Ctrl+/ and the palette's "Prečaci" ask through the editor commands; this list answers.
    const asked = (event: Event) => {
      event.preventDefault();
      toggle();
    };
    document.addEventListener("keydown", on);
    document.addEventListener(SHORTCUT_LIST_EVENT, asked);
    return () => {
      document.removeEventListener("keydown", on);
      document.removeEventListener(SHORTCUT_LIST_EVENT, asked);
    };
  }, [toggle]);
  return (
    <>
      <Button tone="quiet" aria-haspopup="dialog" aria-keyshortcuts="Control+/ Meta+/ ?" title={t.openTitle} onClick={() => setOpen(true)}>
        {t.open}
      </Button>
      <ShortcutListDialog open={open} groups={shortcutListGroups(editable, IS_MAC)} onClose={() => setOpen(false)} />
    </>
  );
}
