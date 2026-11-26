import { useSyncExternalStore } from "react";

import type { PanelGroup } from "./RightPanel";

/**
 * ED-38 (prototype prune.js `RP.ctxAlerts`): the alert row of the "Uz tekst" layout. It shows what asks for
 * attention but does not show in the chapter's lists. A host that knows such a thing reports it under its own
 * key. The host does not have to sit inside the panel: in layout B a group's card is mounted only while the
 * group is open. The row draws one button per alert, and the button opens the alert's group.
 */
export type ContextAlert = { readonly group: PanelGroup; readonly text: string };

let alerts: ReadonlyMap<string, ContextAlert> = new Map();
let list: readonly (ContextAlert & { key: string })[] = [];
const listeners = new Set<() => void>();

/** Sets (or, with null, takes back) the alert one host reports under `key`. */
export function reportAlert(key: string, alert: ContextAlert | null): void {
  const current = alerts.get(key);
  if (alert === null ? current === undefined : current?.group === alert.group && current.text === alert.text) return;
  const next = new Map(alerts);
  if (alert === null) next.delete(key);
  else next.set(key, alert);
  alerts = next;
  list = [...next].map(([k, a]) => ({ key: k, ...a }));
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
const snapshot = () => list;
const empty: typeof list = [];

/** The reported alerts, in the order they were first reported. */
export function useContextAlerts(): typeof list {
  return useSyncExternalStore(subscribe, snapshot, () => empty);
}
