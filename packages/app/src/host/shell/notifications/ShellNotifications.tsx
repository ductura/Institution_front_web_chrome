"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import { NotificationBell, type NotificationEntry } from "@ductura/ui";

import { appHref } from "../../../../../../src/components/index.ts";
import type { Base } from "../../../bases";
import { contractInbox, inboxRoute, markInboxRead, readInbox, type InboxRead, type InboxTransport } from "./inbox";
import { applyMarked, applyRead, entriesOf, INITIAL, unreadOf, type NotificationsState } from "./notifications-state";
import { bellLabels } from "./text";

export const POLL_MS = 60_000;

type Action = { read: InboxRead } | { marked: { id: string; readAt: string } };
const reduce = (state: NotificationsState, action: Action): NotificationsState =>
  "read" in action ? applyRead(state, action.read) : applyMarked(state, action.marked.id, action.marked.readAt);

/**
 * The bell in the shell's account place (WEB-1702, plan M6.6; P-1 of NF-1). It reads
 * the first page of notifications.list.get, again every minute and when the tab
 * becomes visible, so the count changes without a reload. A click on an entry
 * marks it read (notifications.read.post) and the link leads by kind (PD-9).
 */
export default function ShellNotifications({ base, transport }: { base: Base; transport?: InboxTransport }) {
  const inbox = useMemo(() => transport ?? contractInbox(), [transport]);
  const [state, dispatch] = useReducer(reduce, INITIAL);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    const read = await readInbox(inbox);
    if (alive.current) dispatch({ read });
  }, [inbox]);

  useEffect(() => {
    alive.current = true;
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive.current = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const onOpenEntry = useCallback((entry: NotificationEntry) => {
    void markInboxRead(inbox, entry.id).then((mark) => {
      // The contract answers 204: the moment of reading is the browser's until the next read.
      if (mark.kind === "marked" && alive.current) dispatch({ marked: { id: entry.id, readAt: new Date().toISOString() } });
      else void refresh();
    });
  }, [inbox, refresh]);

  return (
    <NotificationBell
      entries={entriesOf(state, (item) => appHref(base, inboxRoute(item)))}
      unread={unreadOf(state)}
      status={state.status}
      labels={bellLabels}
      onOpenEntry={onOpenEntry}
    />
  );
}
