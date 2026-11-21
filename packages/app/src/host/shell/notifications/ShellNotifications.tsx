"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";

import { NotificationBell, type NotificationEntry } from "@ductura/ui";

import { appHref } from "../../../../../../src/components/index.ts";
import {
  markNotificationRead, readNotifications, UNAVAILABLE_TRANSPORT, type NotificationsTransport,
} from "../../../../../../src/client/notifications";
import type { Base } from "../../../bases";
import { applyMarked, applyRead, entriesOf, INITIAL, unreadOf, type NotificationsState } from "./notifications-state";
import { bellLabels } from "./text";

export const POLL_MS = 60_000;

type Action = { read: Parameters<typeof applyRead>[1] } | { marked: { id: string; readAt: string } };
const reduce = (state: NotificationsState, action: Action): NotificationsState =>
  "read" in action ? applyRead(state, action.read) : applyMarked(state, action.marked.id, action.marked.readAt);

/**
 * The bell in the shell's account place (WEB-1702, plan M6.6). The count is
 * read again every minute and when the tab becomes visible, so it changes
 * without a reload. A click on an entry marks it read and the link leads to
 * the work. Until the route is in the contract the transport reports it
 * unavailable and the list says so.
 */
export default function ShellNotifications({ base, transport = UNAVAILABLE_TRANSPORT }: { base: Base; transport?: NotificationsTransport }) {
  const [state, dispatch] = useReducer(reduce, INITIAL);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    const read = await readNotifications(transport);
    if (alive.current) dispatch({ read });
  }, [transport]);

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
    void markNotificationRead(transport, entry.id).then((mark) => {
      if (mark.kind === "marked" && alive.current) dispatch({ marked: { id: entry.id, readAt: mark.readAt } });
      else void refresh();
    });
  }, [transport, refresh]);

  return (
    <NotificationBell
      entries={entriesOf(state, (target) => appHref(base, `/rad/${target}`))}
      unread={unreadOf(state)}
      status={state.status}
      labels={bellLabels}
      onOpenEntry={onOpenEntry}
    />
  );
}
