import { describe, expect, it } from "vitest";

import type { InboxItem } from "./inbox";
import { applyMarked, applyRead, entriesOf, INITIAL, unreadOf } from "./notifications-state";

const n = (id: string, readAt: string | null, kind: InboxItem["kind"] = "comment_posted"): InboxItem =>
  ({ id, kind, targetId: "t" + id, createdAt: "2026-11-03T09:14:00.000Z", readAt });
const page = (items: InboxItem[]) => ({ kind: "available" as const, items, nextBefore: null });

describe("notifications state", () => {
  it("a read replaces the list and the count follows without a reload", () => {
    const a = applyRead(INITIAL, page([n("1", null)]));
    expect(unreadOf(a)).toBe(1);
    const b = applyRead(a, page([n("1", null), n("2", null)]));
    expect(unreadOf(b)).toBe(2);
  });
  it("an unavailable read keeps the list and flags it", () => {
    const a = applyRead(INITIAL, page([n("1", null)]));
    expect(applyRead(a, { kind: "unavailable" })).toEqual({ status: "unavailable", items: a.items });
  });
  it("marking reads one item and lowers the count; an already read item is untouched", () => {
    const a = applyRead(INITIAL, page([n("1", null), n("2", "2026-11-03T10:00:00.000Z")]));
    const b = applyMarked(a, "1", "2026-11-04T08:00:00.000Z");
    expect(unreadOf(b)).toBe(0);
    expect(applyMarked(b, "2", "2026-12-01T00:00:00.000Z").items[1]!.readAt).toBe("2026-11-03T10:00:00.000Z");
  });
  it("entries lead where the caller says, carry Croatian text and Zagreb time", () => {
    const [e] = entriesOf(applyRead(INITIAL, page([n("1", null)])), (item) => `/rad/${item.targetId}`);
    expect(e).toMatchObject({ href: "/rad/t1", text: "Novi komentar uz rad", read: false });
    expect(e!.when).toContain("10:14");
  });
});
