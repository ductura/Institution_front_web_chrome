import { describe, expect, it } from "vitest";
import type { AppNotification } from "../../../../../../src/client/notifications";
import { applyMarked, applyRead, entriesOf, INITIAL, unreadOf } from "./notifications-state";

const n = (id: string, readAt: string | null): AppNotification => ({ id, kind: "comment", targetId: "t" + id, createdAt: "2026-11-03T09:14:00.000Z", readAt });

describe("notifications state", () => {
  it("a read replaces the list and the count follows without a reload", () => {
    const a = applyRead(INITIAL, { kind: "available", items: [n("1", null)], unread: 1 });
    expect(unreadOf(a)).toBe(1);
    const b = applyRead(a, { kind: "available", items: [n("1", null), n("2", null)], unread: 2 });
    expect(unreadOf(b)).toBe(2);
  });
  it("an unavailable read keeps the list and flags it", () => {
    const a = applyRead(INITIAL, { kind: "available", items: [n("1", null)], unread: 1 });
    expect(applyRead(a, { kind: "unavailable" })).toEqual({ status: "unavailable", items: a.items });
  });
  it("marking reads one item and lowers the count; an already read item is untouched", () => {
    const a = applyRead(INITIAL, { kind: "available", items: [n("1", null), n("2", "2026-11-03T10:00:00.000Z")], unread: 1 });
    const b = applyMarked(a, "1", "2026-11-04T08:00:00.000Z");
    expect(unreadOf(b)).toBe(0);
    expect(applyMarked(b, "2", "2026-12-01T00:00:00.000Z").items[1]!.readAt).toBe("2026-11-03T10:00:00.000Z");
  });
  it("entries lead to the work and carry Croatian text", () => {
    const [e] = entriesOf(applyRead(INITIAL, { kind: "available", items: [n("1", null)], unread: 1 }), (t) => `/rad/${t}`);
    expect(e).toMatchObject({ href: "/rad/t1", text: "Novi komentar na radu", read: false });
  });
});
