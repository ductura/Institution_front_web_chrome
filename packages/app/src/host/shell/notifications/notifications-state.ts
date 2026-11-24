import type { NotificationEntry } from "@ductura/ui";

import type { InboxItem, InboxRead } from "./inbox";
import { deadlineReminderLine, notificationKindText } from "./text";

export type NotificationsState = { status: "ready" | "unavailable"; items: readonly InboxItem[] };

export const INITIAL: NotificationsState = { status: "ready", items: [] };

/** A read replaces the list; an unavailable read keeps the last list but says so. */
export function applyRead(state: NotificationsState, read: InboxRead): NotificationsState {
  if (read.kind === "available") return { status: "ready", items: read.items };
  return { ...state, status: "unavailable" };
}

/** Optimistic mark: the item is read at once, the count follows from the items. */
export function applyMarked(state: NotificationsState, id: string, readAt: string): NotificationsState {
  return { ...state, items: state.items.map((n) => (n.id === id && n.readAt === null ? { ...n, readAt } : n)) };
}

export const unreadOf = (state: NotificationsState): number => state.items.filter((n) => n.readAt === null).length;

/** What a reminder needs of its assignment: the title and the deadline that applies (the extended one when given). */
export type Deadlines = ReadonlyMap<string, { readonly title: string; readonly dueAt: string }>;

const zagreb = (iso: string) => new Date(iso).toLocaleString("hr-HR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Zagreb" });

/** P-2: "Rok za zadatak {naslov}: {rok}" when the assignment is known, else the plain line by kind. */
export function textOf(item: InboxItem, deadlines?: Deadlines): string {
  const known = item.kind === "deadline_reminder" ? deadlines?.get(item.targetId) : undefined;
  if (known === undefined || Number.isNaN(Date.parse(known.dueAt))) return notificationKindText[item.kind];
  return deadlineReminderLine.replace("{title}", known.title).replace("{due}", zagreb(known.dueAt));
}

/** The bell's lines: Croatian text by kind, Zagreb time, and the route of each entry. */
export function entriesOf(state: NotificationsState, hrefOf: (item: InboxItem) => string, deadlines?: Deadlines): NotificationEntry[] {
  return state.items.map((n) => ({
    id: n.id,
    text: textOf(n, deadlines),
    when: new Date(n.createdAt).toLocaleString("hr-HR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Zagreb" }),
    read: n.readAt !== null,
    href: hrefOf(n),
  }));
}
