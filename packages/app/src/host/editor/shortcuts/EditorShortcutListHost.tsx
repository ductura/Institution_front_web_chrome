"use client";

// WEB-1908, mounted by PIL-D8-PRECACI (P-D8): the shortcut list opens from its button in the
// shell's view bar and by the question mark key outside a text field; Esc or "Zatvori" closes it (shared Dialog).
// The list is the one definition in shortcut-definitions.ts; the editor commands read it too.
import { useCallback, useEffect, useState } from "react";
import { Button, ShortcutListDialog } from "@ductura/ui";

import { shortcutsHostHr as t } from "./messages.hr";
import { shortcutListGroups } from "./shortcut-definitions";
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
    document.addEventListener("keydown", on);
    return () => document.removeEventListener("keydown", on);
  }, [toggle]);
  return (
    <>
      <Button tone="quiet" aria-haspopup="dialog" aria-keyshortcuts="?" title={t.openTitle} onClick={() => setOpen(true)}>
        {t.open}
      </Button>
      <ShortcutListDialog open={open} groups={shortcutListGroups(editable, IS_MAC)} onClose={() => setOpen(false)} />
    </>
  );
}
