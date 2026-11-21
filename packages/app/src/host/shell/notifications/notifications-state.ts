import type { AppNotification, NotificationsRead } from "../../../../../../src/client/notifications";
import type { NotificationEntry } from "@ductura/ui";
import { notificationKindText } from "./text";

export type NotificationsState = { status: "ready" | "unavailable"; items: readonly AppNotification[] };

export const INITIAL: NotificationsState = { status: "ready", items: [] };

/** A read replaces the list; an unavailable read keeps the last list but says so. */
export function applyRead(state: NotificationsState, read: NotificationsRead): NotificationsState {
  if (read.kind === "available") return { status: "ready", items: read.items };
  return { ...state, status: "unavailable" };
}

/** Optimistic mark: the item is read at once, the count follows from the items. */
export function applyMarked(state: NotificationsState, id: string, readAt: string): NotificationsState {
  return { ...state, items: state.items.map((n) => (n.id === id && n.readAt === null ? { ...n, readAt } : n)) };
}

export const unreadOf = (state: NotificationsState): number => state.items.filter((n) => n.readAt === null).length;

export function entriesOf(state: NotificationsState, hrefOf: (targetId: string) => string): NotificationEntry[] {
  return state.items.map((n) => ({
    id: n.id,
    text: notificationKindText[n.kind],
    when: new Date(n.createdAt).toLocaleString("hr-HR", { dateStyle: "short", timeStyle: "short" }),
    read: n.readAt !== null,
    href: hrefOf(n.targetId),
  }));
}
