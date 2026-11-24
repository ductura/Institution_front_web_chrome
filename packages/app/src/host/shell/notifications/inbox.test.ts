import { describe, expect, it } from "vitest";

import vectors from "../../../../../../src/client/migration-contract-vectors.generated.json" with { type: "json" };

import { contractInbox, inboxItem, inboxRoute, INBOX_KINDS, markInboxRead, readInbox, type InboxAnswer, type InboxTransport } from "./inbox";
import { notificationKindText } from "./text";

// Invented identifiers only.
const ID = "00000000-0000-4000-8000-000000001701";
const ID2 = "00000000-0000-4000-8000-000000001702";
const TARGET = "a5000000-0000-4000-8000-000000000001";
const item = (over: Record<string, unknown> = {}) =>
  ({ id: ID, kind: "assignment_version", targetId: TARGET, createdAt: "2026-11-21T08:00:00.000Z", readAt: null, ...over });

const answering = (list: InboxAnswer | (() => Promise<InboxAnswer>), mark: InboxAnswer = { ok: true, body: undefined }): InboxTransport => ({
  list: typeof list === "function" ? list : async () => list,
  markRead: async () => mark,
});

describe("P-1 inbox over notifications.list.get", () => {
  it("reads the contract's page and keeps nextBefore", async () => {
    const read = await readInbox(answering({ ok: true, body: { notifications: [item(), item({ id: ID2, kind: "deadline_reminder", readAt: "2026-11-21T09:00:00.000Z" })], nextBefore: ID2 } }));
    expect(read).toEqual({ kind: "available", items: [item(), item({ id: ID2, kind: "deadline_reminder", readAt: "2026-11-21T09:00:00.000Z" })], nextBefore: ID2 });
  });
  it("skips an unknown kind or a broken item and keeps the rest (PD-9)", async () => {
    const read = await readInbox(answering({ ok: true, body: { notifications: [item({ kind: "grade_published" }), item({ id: "x" }), item({ createdAt: "yesterday" }), item({ id: ID2 })], nextBefore: null } }));
    expect(read.kind === "available" && read.items.map((i) => i.id)).toEqual([ID2]);
  });
  it("is unavailable for a page that is not the contract's envelope, signed out on 401", async () => {
    expect(await readInbox(answering({ ok: true, body: { items: [] } }))).toEqual({ kind: "unavailable" });
    expect(await readInbox(answering({ ok: true, body: { notifications: Array.from({ length: 51 }, () => item()), nextBefore: null } }))).toEqual({ kind: "unavailable" });
    expect(await readInbox(answering({ ok: true, body: { notifications: [], nextBefore: "nope" } }))).toEqual({ kind: "unavailable" });
    expect(await readInbox(answering({ ok: false, status: 503 }))).toEqual({ kind: "unavailable" });
    expect(await readInbox(answering({ ok: false, status: 401 }))).toEqual({ kind: "signedOut" });
    expect(await readInbox(answering(() => Promise.reject(new Error("net"))))).toEqual({ kind: "unavailable" });
  });
  it("knows every kind of the contract, each with its own text", () => {
    const contractKinds = new Set((vectors as Array<{ route: string; response?: { body?: { notifications?: Array<{ kind: string }> } } }>)
      .filter((v) => v.route === "notifications.list.get")
      .flatMap((v) => v.response?.body?.notifications?.map((n) => n.kind) ?? []));
    for (const kind of contractKinds) expect(INBOX_KINDS).toContain(kind);
    for (const kind of INBOX_KINDS) {
      expect(inboxItem(item({ kind }))?.kind).toBe(kind);
      expect(notificationKindText[kind]).toMatch(/\S/);
    }
    expect(new Set(Object.values(notificationKindText)).size).toBe(INBOX_KINDS.length);
  });
  it("leads each kind to its page", () => {
    expect(inboxRoute({ kind: "assignment_version", targetId: TARGET })).toBe(`/zadatak/${TARGET}`);
    expect(inboxRoute({ kind: "deadline_reminder", targetId: TARGET })).toBe(`/zadatak/${TARGET}`);
    expect(inboxRoute({ kind: "comment_posted", targetId: TARGET })).toBe(`/rad/${TARGET}`);
    expect(inboxRoute({ kind: "submission_recorded", targetId: TARGET })).toBe(`/rad/${TARGET}/predaja/potvrda`);
    expect(inboxRoute({ kind: "course_handover", targetId: TARGET })).toBe("/zadaci/kolegiji");
  });
});

describe("P-1 marking read over notifications.read.post", () => {
  it("is marked on 204; 401, 404 and the rest are told apart; a bad id is not sent", async () => {
    expect(await markInboxRead(answering({ ok: true, body: {} }), ID)).toEqual({ kind: "marked" });
    expect(await markInboxRead(answering({ ok: true, body: {} }, { ok: false, status: 401 }), ID)).toEqual({ kind: "signedOut" });
    expect(await markInboxRead(answering({ ok: true, body: {} }, { ok: false, status: 404 }), ID)).toEqual({ kind: "notFound" });
    expect(await markInboxRead(answering({ ok: true, body: {} }, { ok: false, status: 503 }), ID)).toEqual({ kind: "unavailable" });
    let sent = 0;
    const counting: InboxTransport = { list: async () => ({ ok: true, body: {} }), markRead: async () => { sent += 1; return { ok: true, body: undefined }; } };
    expect(await markInboxRead(counting, "../x")).toEqual({ kind: "notFound" });
    expect(sent).toBe(0);
  });
});

describe("P-1 contract transport", () => {
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  it("calls the contract's routes and returns the page", async () => {
    const seen: string[] = [];
    const inbox = contractInbox(async (input, init) => {
      seen.push(`${init?.method ?? "GET"} ${new URL(String(input)).pathname}${new URL(String(input)).search}`);
      return String(input).endsWith("/read") ? new Response(null, { status: 204 }) : json(200, { notifications: [item()], nextBefore: null });
    });
    globalThis.location ??= { origin: "http://127.0.0.1" } as Location;
    expect(await readInbox(inbox)).toEqual({ kind: "available", items: [item()], nextBefore: null });
    expect(await readInbox(inbox, ID2)).toMatchObject({ kind: "available" });
    expect(await markInboxRead(inbox, ID)).toEqual({ kind: "marked" });
    expect(seen).toEqual(["GET /api/v1/notifications", `GET /api/v1/notifications?before=${ID2}`, `POST /api/v1/notifications/${ID}/read`]);
  });
  it("keeps a page the generated client refuses for an unknown kind, so the rest still shows", async () => {
    globalThis.location ??= { origin: "http://127.0.0.1" } as Location;
    const inbox = contractInbox(async () => json(200, { notifications: [item({ kind: "grade_published" }), item({ id: ID2 })], nextBefore: null }));
    const read = await readInbox(inbox);
    expect(read.kind === "available" && read.items.map((i) => i.id)).toEqual([ID2]);
  });
  it("says unavailable on 503 and signed out on 401", async () => {
    globalThis.location ??= { origin: "http://127.0.0.1" } as Location;
    expect(await readInbox(contractInbox(async () => json(503, { code: "unavailable" })))).toEqual({ kind: "unavailable" });
    expect(await readInbox(contractInbox(async () => json(401, { code: "unauthorized" })))).toEqual({ kind: "signedOut" });
  });
});
