"use client";

// WEB-1908: opens the shortcut list from the keyboard (Ctrl/Cmd+/ or ?) and from a button.
// The list is the one definition in shortcut-definitions.ts; the editor commands read it too.
import { useCallback, useState } from "react";
import { Button, ShortcutListDialog, useShortcutListKey } from "@ductura/ui";

import { shortcutListGroups } from "./shortcut-definitions";

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/u.test(navigator.platform ?? "");

export function EditorShortcutListHost({ editable }: { editable: boolean }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((value) => !value), []);
  useShortcutListKey(toggle);
  return (
    <>
      <Button tone="quiet" aria-haspopup="dialog" aria-keyshortcuts="Control+/ Meta+/" onClick={() => setOpen(true)}>
        Prečaci
      </Button>
      <ShortcutListDialog open={open} groups={shortcutListGroups(editable, IS_MAC)} onClose={() => setOpen(false)} />
    </>
  );
}
