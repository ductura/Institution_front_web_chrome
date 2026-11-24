// P-1 (NF-1, WEB-NUZ-NF1): the bell over the contract's inbox, notifications.list.get
// and notifications.read.post of the generated extract, reached only through
// createApi (no-direct-api). The contract's page is { notifications[], nextBefore }
// with five kinds; a kind the app does not know (or an item of another shape) is
// skipped, so one new kind never empties the bell (PD-9: "nepoznata vrsta se
// preskače"). The count is derived from the kept items, never trusted on its own.

import { browserTransport, createApi } from "../../../../../../src/client/api";

export const INBOX_KINDS = ["assignment_version", "deadline_reminder", "comment_posted", "submission_recorded", "course_handover"] as const;
export type InboxKind = (typeof INBOX_KINDS)[number];

export type InboxItem = {
  readonly id: string;
  readonly kind: InboxKind;
  /** The assignment the notification is about (for course_handover: the course; the bell then opens "Moji kolegiji"). */
  readonly targetId: string;
  readonly createdAt: string;
  readonly readAt: string | null;
};

export type InboxRead =
  | { readonly kind: "available"; readonly items: readonly InboxItem[]; readonly nextBefore: string | null }
  | { readonly kind: "signedOut" | "unavailable" };

export type InboxMark = { readonly kind: "marked" } | { readonly kind: "signedOut" | "notFound" | "unavailable" };

export type InboxAnswer = { readonly ok: true; readonly body: unknown } | { readonly ok: false; readonly status: number };

/** What the bell needs of the server; the contract transport below, a stand-in in tests. */
export type InboxTransport = {
  list: (before?: string) => Promise<InboxAnswer>;
  markRead: (id: string) => Promise<InboxAnswer>;
};

export const MAX_PAGE = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const isInstant = (value: unknown): value is string => typeof value === "string" && INSTANT.test(value) && Number.isFinite(Date.parse(value));

/** One item of the page, or null when its kind is unknown or its shape is not the contract's. */
export function inboxItem(raw: unknown): InboxItem | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.kind !== "string" || !(INBOX_KINDS as readonly string[]).includes(r.kind)) return null;
  if (typeof r.id !== "string" || !UUID.test(r.id) || typeof r.targetId !== "string" || !UUID.test(r.targetId)) return null;
  if (!isInstant(r.createdAt) || !(r.readAt === null || isInstant(r.readAt))) return null;
  return { id: r.id.toLowerCase(), kind: r.kind as InboxKind, targetId: r.targetId.toLowerCase(), createdAt: r.createdAt, readAt: r.readAt };
}

/** One page of the inbox; never throws. A page that is not the contract's envelope is "unavailable". */
export async function readInbox(transport: InboxTransport, before?: string): Promise<InboxRead> {
  try {
    const answer = await transport.list(before);
    if (!answer.ok) return { kind: answer.status === 401 ? "signedOut" : "unavailable" };
    const body = answer.body as { notifications?: unknown; nextBefore?: unknown } | null;
    if (typeof body !== "object" || body === null || !Array.isArray(body.notifications) || body.notifications.length > MAX_PAGE) {
      return { kind: "unavailable" };
    }
    const next = body.nextBefore;
    if (!(next === null || next === undefined || (typeof next === "string" && UUID.test(next)))) return { kind: "unavailable" };
    const items = body.notifications.map(inboxItem).filter((item): item is InboxItem => item !== null);
    return { kind: "available", items, nextBefore: typeof next === "string" ? next.toLowerCase() : null };
  } catch {
    return { kind: "unavailable" };
  }
}

/** Marks one notification read; the contract answers 204 without a body. Never throws. */
export async function markInboxRead(transport: InboxTransport, id: string): Promise<InboxMark> {
  if (!UUID.test(id)) return { kind: "notFound" };
  try {
    const answer = await transport.markRead(id.toLowerCase());
    if (answer.ok) return { kind: "marked" };
    if (answer.status === 401) return { kind: "signedOut" };
    return answer.status === 404 ? { kind: "notFound" } : { kind: "unavailable" };
  } catch {
    return { kind: "unavailable" };
  }
}

type Fetch = typeof fetch;

/**
 * The inbox over the generated client. The client refuses a page whose every
 * item is not the contract's (a kind added on the server first): the raw JSON of
 * such a 200 is kept, so readInbox can skip what it does not know.
 */
export function contractInbox(fetchImpl: Fetch = browserTransport): InboxTransport {
  return {
    async list(before) {
      let raw: unknown;
      const keep: Fetch = async (input, init) => {
        const response = await fetchImpl(input, init);
        if (response.status === 200 && response.headers.get("content-type")?.startsWith("application/json")) {
          raw = await response.clone().json().catch(() => undefined);
        }
        return response;
      };
      const result = await createApi({ fetchImpl: keep })("notifications.list.get", {
        params: undefined, query: before === undefined ? {} : { before }, body: undefined,
      });
      if (result.ok) return { ok: true, body: result.body };
      if (result.status === 200 && raw !== undefined) return { ok: true, body: raw };
      return { ok: false, status: result.status };
    },
    async markRead(id) {
      const result = await createApi({ fetchImpl })("notifications.read.post", { params: { id }, query: undefined, body: undefined });
      return result.ok ? { ok: true, body: undefined } : { ok: false, status: result.status };
    },
  };
}

/** Where an entry leads (PD-9): the notice, the work, its receipt, or the courses. */
export function inboxRoute(item: Pick<InboxItem, "kind" | "targetId">): string {
  const id = encodeURIComponent(item.targetId);
  switch (item.kind) {
    case "assignment_version":
    case "deadline_reminder":
      return `/zadatak/${id}`;
    case "comment_posted":
      return `/rad/${id}`;
    case "submission_recorded":
      return `/rad/${id}/predaja/potvrda`;
    case "course_handover":
      return "/zadaci/kolegiji";
  }
}
