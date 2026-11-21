import { describe, expect, it, vi } from "vitest";
import { markNotificationRead, readNotifications, UNAVAILABLE_TRANSPORT, type NotificationsTransport } from "./notifications";

const A = { id: "00000000-0000-4000-8000-0000000000a1", kind: "comment", targetId: "00000000-0000-4000-8000-0000000000b1", createdAt: "2026-11-03T09:14:00.000Z", readAt: null };
const B = { ...A, id: "00000000-0000-4000-8000-0000000000a2", kind: "submission", readAt: "2026-11-03T10:00:00.000Z" };
const ok = (body: unknown) => ({ ok: true as const, body });
const transport = (list: unknown, markRead: unknown = { readAt: B.readAt }): NotificationsTransport => ({
  list: vi.fn(async () => (list as { ok?: boolean }).ok === false ? (list as never) : ok(list)),
  markRead: vi.fn(async () => (markRead as { ok?: boolean }).ok === false ? (markRead as never) : ok(markRead)),
});

describe("readNotifications", () => {
  it("returns the items and counts unread ones from them", async () => {
    expect(await readNotifications(transport({ items: [A, B], unread: 1 }))).toEqual({ kind: "available", items: [A, B], unread: 1 });
  });
  it.each([
    [{ ok: false, status: 401 }, "signedOut"], [{ ok: false, status: 503 }, "unavailable"],
    [{ items: [{ ...A, extra: 1 }] }, "unavailable"], [{ items: [{ ...A, kind: "other" }] }, "unavailable"],
    [{ items: [{ ...A, createdAt: "2026-02-31T00:00:00.000Z" }] }, "unavailable"],
    [{ items: [A], unread: 5 }, "unavailable"], [{ items: "x" }, "unavailable"],
  ] as const)("rejects %j as %s", async (list, kind) => {
    expect((await readNotifications(transport(list))).kind).toBe(kind);
  });
  it("treats a throwing transport as unavailable", async () => {
    expect(await readNotifications({ ...UNAVAILABLE_TRANSPORT, list: async () => { throw new Error("x"); } })).toEqual({ kind: "unavailable" });
  });
});

describe("markNotificationRead", () => {
  it("marks and returns the server time", async () => {
    const t = transport({ items: [] });
    expect(await markNotificationRead(t, A.id)).toEqual({ kind: "marked", readAt: B.readAt });
    expect(t.markRead).toHaveBeenCalledWith(A.id);
  });
  it("does not call the transport for an invalid id", async () => {
    const t = transport({ items: [] });
    expect(await markNotificationRead(t, "nije-id")).toEqual({ kind: "notFound" });
    expect(t.markRead).not.toHaveBeenCalled();
  });
  it.each([[401, "signedOut"], [404, "notFound"], [503, "unavailable"]] as const)("maps %s to %s", async (status, kind) => {
    expect(await markNotificationRead(transport({ items: [] }, { ok: false, status }), A.id)).toEqual({ kind });
  });
});
