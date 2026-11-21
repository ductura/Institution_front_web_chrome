// In-app notifications (WEB-1702, plan M6.6). The server contract does not
// exist yet, so this module only checks and shapes what a transport returns;
// it makes no network call itself (no-direct-api.test.ts): the transport is
// the generated client once the route is in the contract, and a stand-in in
// tests. Assumed shape: list -> { items, unread }, read -> { readAt }.

export const NOTIFICATION_KINDS = ["comment", "assignmentVersion", "submission"] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export type AppNotification = {
  readonly id: string;
  readonly kind: NotificationKind;
  /** The assignment (work) the notification leads to. */
  readonly targetId: string;
  readonly createdAt: string;
  readonly readAt: string | null;
};

export type NotificationsRead =
  | { kind: "available"; items: readonly AppNotification[]; unread: number }
  | { kind: "signedOut" | "unavailable" };

export type NotificationMark = { kind: "marked"; readAt: string } | { kind: "signedOut" | "notFound" | "unavailable" };

export type TransportResult = { ok: true; body: unknown } | { ok: false; status: number };

export type NotificationsTransport = {
  list: () => Promise<TransportResult>;
  markRead: (notificationId: string) => Promise<TransportResult>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const MAX_NOTIFICATIONS = 50;

function isInstant(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms) && new Date(ms).toISOString() === value;
}

function item(raw: unknown): AppNotification | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const keys = Object.keys(r);
  if (keys.length !== 5 || !["id", "kind", "targetId", "createdAt", "readAt"].every((k) => keys.includes(k))) return null;
  if (typeof r.id !== "string" || !UUID.test(r.id) || typeof r.targetId !== "string" || !UUID.test(r.targetId)) return null;
  if (!NOTIFICATION_KINDS.includes(r.kind as NotificationKind)) return null;
  if (!isInstant(r.createdAt) || !(r.readAt === null || isInstant(r.readAt))) return null;
  return { id: r.id.toLowerCase(), kind: r.kind as NotificationKind, targetId: r.targetId.toLowerCase(), createdAt: r.createdAt, readAt: r.readAt };
}

export async function readNotifications(transport: NotificationsTransport): Promise<NotificationsRead> {
  try {
    const result = await transport.list();
    if (!result.ok) return { kind: result.status === 401 ? "signedOut" : "unavailable" };
    const body = result.body as { items?: unknown; unread?: unknown } | null;
    if (typeof body !== "object" || body === null || !Array.isArray(body.items) || body.items.length > MAX_NOTIFICATIONS) {
      return { kind: "unavailable" };
    }
    const items = body.items.map(item);
    if (items.includes(null)) return { kind: "unavailable" };
    const list = items as AppNotification[];
    // The count is derived from the items, never trusted from the server alone.
    const unread = list.filter((n) => n.readAt === null).length;
    if (body.unread !== undefined && body.unread !== unread) return { kind: "unavailable" };
    return { kind: "available", items: list, unread };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function markNotificationRead(transport: NotificationsTransport, notificationId: string): Promise<NotificationMark> {
  if (!UUID.test(notificationId)) return { kind: "notFound" };
  try {
    const result = await transport.markRead(notificationId.toLowerCase());
    if (!result.ok) {
      if (result.status === 401) return { kind: "signedOut" };
      if (result.status === 404 || result.status === 403) return { kind: "notFound" };
      return { kind: "unavailable" };
    }
    const body = result.body as { readAt?: unknown } | null;
    if (typeof body !== "object" || body === null || !isInstant(body.readAt)) return { kind: "unavailable" };
    return { kind: "marked", readAt: body.readAt };
  } catch {
    return { kind: "unavailable" };
  }
}

/** Until the route is in the contract: every call is "not available" (no request is made). */
export const UNAVAILABLE_TRANSPORT: NotificationsTransport = {
  list: async () => ({ ok: false, status: 404 }),
  markRead: async () => ({ ok: false, status: 404 }),
};
