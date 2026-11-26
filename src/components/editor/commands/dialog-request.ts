// ED-60: the work page's dialogs that the prototype opens from a menu (import, the work's rules,
// the legend of the marks) are asked for through this event, as "Povijest i usporedba" is
// (work-history-event.ts). The host that mounts the dialog answers; the menu entry needs no props.
import { useEffect, useRef } from "react";

export const EDITOR_DIALOGS = ["import", "rules", "marks"] as const;
export type EditorDialog = (typeof EDITOR_DIALOGS)[number];

const EVENT = "ductura:editor-dialog";

/** Asks the page to open one dialog; false when no host took it. */
export function requestDialog(name: EditorDialog, target: EventTarget = document): boolean {
  return !target.dispatchEvent(new CustomEvent<EditorDialog>(EVENT, { detail: name, cancelable: true }));
}

const hosts = new Map<EditorDialog, number>();
/** A host that can open the dialog says so; the returned function takes it back. */
export function offerDialog(name: EditorDialog): () => void {
  hosts.set(name, (hosts.get(name) ?? 0) + 1);
  let taken = false;
  return () => {
    if (taken) return;
    taken = true;
    hosts.set(name, (hosts.get(name) ?? 1) - 1);
  };
}
/** True while some host on the page can open it; an entry without one is not offered. */
export const dialogOffered = (name: EditorDialog): boolean => (hosts.get(name) ?? 0) > 0;

/** The host's side: while `enabled`, a request for `name` calls `open`. */
export function useDialogRequest(name: EditorDialog, open: () => void, enabled = true): void {
  const latest = useRef(open);
  latest.current = open;
  useEffect(() => {
    if (!enabled) return undefined;
    const asked = (event: Event) => {
      if ((event as CustomEvent<EditorDialog>).detail !== name) return;
      event.preventDefault();
      latest.current();
    };
    document.addEventListener(EVENT, asked);
    const withdraw = offerDialog(name);
    return () => { withdraw(); document.removeEventListener(EVENT, asked); };
  }, [name, enabled]);
}
