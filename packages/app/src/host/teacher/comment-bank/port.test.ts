import { describe, expect, it } from "vitest";

import { commentBankPortFor, draftCommentsPortFor } from "./port";
import { publishDraftGroup, publishMessage, removeBankEntry, saveBankEntry, saveDraftComment, updateBankEntry, visibleToStudent } from "./model";

const WORK = "d1";
const C1 = "3c9f0a1e-7b2d-4e5f-8a6b-1c2d3e4f5a60";
const T1 = "3c9f0a1e-7b2d-4e5f-8a6b-1c2d3e4f5a61";
const ANCHOR = { nodeId: "3c9f0a1e-7b2d-4e5f-8a6b-1c2d3e4f5a62", quote: "izmišljeni navod", prefix: "", suffix: "", startHint: 0, endHint: 16 };

type Answer = { ok: true; status: number; body: unknown } | { ok: false; status: number };
const stub = (routes: Record<string, (input: { body?: unknown }) => Answer>, log: string[] = []) =>
  (async (id: string, input: { body?: unknown }) => {
    log.push(id);
    const route = routes[id];
    if (!route) throw new Error(`no route ${id}`);
    return route(input);
  }) as never;
const drafts = (list: { threadId: string; commentId: string; text: string }[]) =>
  ({ ok: true, status: 200, body: { drafts: list.map((d) => ({ ...d, position: 1, anchor: null, state: "open", createdWindow: "2026-11-23T10:00:00.000Z" })) } }) as Answer;

describe("draft comments port (WEB-1704)", () => {
  it("lists drafts as drafts, which the student's list never holds", async () => {
    const port = draftCommentsPortFor(() => stub({ "work.comment-drafts.get": () => drafts([{ threadId: T1, commentId: C1, text: "Skica" }]) }));
    const read = await port.listDrafts(WORK);
    if (read.kind !== "ready") throw new Error("expected drafts");
    expect(read.drafts.map((d) => [d.id, d.state])).toEqual([[C1, "draft"]]);
    expect(visibleToStudent(read.drafts)).toEqual([]);
  });

  it("saves only with an anchor and shows the draft the server holds", async () => {
    const log: string[] = [];
    const port = draftCommentsPortFor(() => stub({
      "work.comment-drafts.post": () => ({ ok: true, status: 201, body: { threadId: T1 } }),
      "work.comment-drafts.get": () => drafts([{ threadId: T1, commentId: C1, text: "Skica" }]),
    }, log));
    expect(await saveDraftComment(port, WORK, "Skica")).toEqual({ kind: "rejected" });
    expect(log).toEqual([]);
    const saved = await saveDraftComment(port, WORK, "Skica", ANCHOR);
    expect(saved).toMatchObject({ kind: "saved", draft: { id: C1, state: "draft" } });
  });

  it("is unknown when the server does not list the saved draft", async () => {
    const port = draftCommentsPortFor(() => stub({
      "work.comment-drafts.post": () => ({ ok: true, status: 201, body: { threadId: T1 } }),
      "work.comment-drafts.get": () => drafts([]),
    }));
    expect(await saveDraftComment(port, WORK, "Skica", ANCHOR)).toEqual({ kind: "unknown" });
  });

  it("publishes exactly the drafts the teacher saw through publish-selected", async () => {
    const log: string[] = [];
    const sent: unknown[] = [];
    const port = draftCommentsPortFor(() => stub({
      "work.comments.publish-selected.post": (input) => { sent.push(input.body); return { ok: true, status: 200, body: { published: 2 } }; },
    }, log));
    expect(await publishDraftGroup(port, WORK, [C1, T1])).toEqual({ kind: "published", ids: [C1, T1] });
    expect(log).toEqual(["work.comments.publish-selected.post"]);
    expect(sent).toEqual([{ draftIds: [C1, T1] }]);
  });

  it("counts a publication only when the answer matches the drafts sent (B-6)", async () => {
    const answer = (published: number) => draftCommentsPortFor(() => stub({
      "work.comments.publish-selected.post": () => ({ ok: true, status: 200, body: { published } }),
    }));
    expect(await publishDraftGroup(answer(2), WORK, ["a", "b"])).toEqual({ kind: "published", ids: ["a", "b"] });
    expect(await publishDraftGroup(answer(3), WORK, ["a", "b"])).toEqual({ kind: "unknown" });
    expect(await publishDraftGroup(answer(1), WORK, ["a", "b"])).toEqual({ kind: "unknown" });
  });

  it("reports 409 as changed drafts with nothing published", async () => {
    const port = draftCommentsPortFor(() => stub({ "work.comments.publish-selected.post": () => ({ ok: false, status: 409 }) }));
    const result = await publishDraftGroup(port, WORK, ["a"]);
    expect(result).toEqual({ kind: "changed" });
    expect(publishMessage(result)).toBe("Skice su se u međuvremenu promijenile. Osvježite popis.");
  });

  it("maps the other refusals as before: 401 signed out, 4xx rejected, 5xx unknown", async () => {
    const status = (code: number) => draftCommentsPortFor(() => stub({ "work.comments.publish-selected.post": () => ({ ok: false, status: code }) }));
    expect(await publishDraftGroup(status(401), WORK, ["a"])).toEqual({ kind: "signedOut" });
    expect(await publishDraftGroup(status(403), WORK, ["a"])).toEqual({ kind: "rejected" });
    expect(await publishDraftGroup(status(404), WORK, ["a"])).toEqual({ kind: "rejected" });
    expect(await publishDraftGroup(status(422), WORK, ["a"])).toEqual({ kind: "rejected" });
    expect(await publishDraftGroup(status(503), WORK, ["a"])).toEqual({ kind: "unknown" });
  });
});

describe("comment bank port (WEB-1704)", () => {
  it("reads the bank with its kind as the title", async () => {
    const port = commentBankPortFor(() => stub({
      "teacher.comment-bank.get": () => ({ ok: true, status: 200, body: { entries: [{ id: C1, kind: "must", text: "Navedite izvor.", createdAt: "2026-11-23T10:00:00.000Z" }] } }),
    }));
    expect(await port.read()).toEqual({ kind: "ready", entries: [{ id: C1, kind: "must", title: "Obavezno", label: null, body: "Navedite izvor." }] });
  });

  it("removes an entry only on the server's confirmation", async () => {
    const answer = (status: number) => commentBankPortFor(() => stub({
      "teacher.comment-bank.delete": () => (status === 204 ? { ok: true, status, body: undefined } : { ok: false, status }),
    }));
    expect(await removeBankEntry(answer(204), C1)).toEqual({ kind: "removed" });
    expect(await removeBankEntry(answer(503), C1)).toEqual({ kind: "unknown" });
    expect(await removeBankEntry(answer(404), C1)).toEqual({ kind: "rejected" });
  });

  it("reads the teacher's label of an entry", async () => {
    const port = commentBankPortFor(() => stub({
      "teacher.comment-bank.get": () => ({ ok: true, status: 200, body: { entries: [{ id: C1, kind: "q", text: "Zašto?", label: "Pitanje o izvoru", createdAt: "2026-11-23T10:00:00.000Z" }] } }),
    }));
    expect(await port.read()).toMatchObject({ entries: [{ kind: "q", label: "Pitanje o izvoru" }] });
  });

  it("sends an edited entry through the PUT route and shows it only after 204", async () => {
    const sent: unknown[] = [];
    const answer = (status: number) => commentBankPortFor(() => stub({
      "teacher.comment-bank-entry.put": (input) => { sent.push(input.body); return status === 204 ? { ok: true, status, body: undefined } : { ok: false, status }; },
    }));
    const input = { text: "Novi tekst", kind: "praise", label: "Pohvala" } as const;
    expect(await updateBankEntry(answer(204), C1, input)).toEqual({
      kind: "updated", entry: { id: C1, kind: "praise", title: "Pohvala", label: "Pohvala", body: "Novi tekst" },
    });
    expect(sent).toEqual([{ text: "Novi tekst", kind: "praise", label: "Pohvala" }]);
    expect(await updateBankEntry(answer(503), C1, input)).toEqual({ kind: "unknown" });
    expect(await updateBankEntry(answer(422), C1, input)).toEqual({ kind: "rejected" });
    expect(await updateBankEntry(answer(401), C1, input)).toEqual({ kind: "signedOut" });
  });

  it("treats another teacher's or a missing entry (404) as gone, never as updated", async () => {
    const port = commentBankPortFor(() => stub({ "teacher.comment-bank-entry.put": () => ({ ok: false, status: 404 }) }));
    expect(await updateBankEntry(port, C1, { text: "Tekst", kind: "sugg", label: null })).toEqual({ kind: "gone" });
  });

  it("sends nothing for a bad input (blank text, long text, long or control label)", async () => {
    const log: string[] = [];
    const port = commentBankPortFor(() => stub({
      "teacher.comment-bank.post": () => ({ ok: true, status: 201, body: { id: C1, createdAt: "2026-11-23T10:00:00.000Z" } }),
      "teacher.comment-bank-entry.put": () => ({ ok: true, status: 204, body: undefined }),
    }, log));
    for (const input of [
      { text: "   ", kind: "must", label: null },
      { text: "a".repeat(2001), kind: "must", label: null },
      { text: "Tekst", kind: "must", label: "x".repeat(41) },
      { text: "Tekst", kind: "must", label: "a\u0007b" },
    ] as const) {
      expect(await saveBankEntry(port, input)).toEqual({ kind: "rejected" });
      expect(await updateBankEntry(port, C1, input)).toEqual({ kind: "rejected" });
    }
    expect(log).toEqual([]);
  });

  it("saves a new entry as the server named it, and is unknown when the answer names none", async () => {
    const good = commentBankPortFor(() => stub({ "teacher.comment-bank.post": () => ({ ok: true, status: 201, body: { id: C1, createdAt: "2026-11-23T10:00:00.000Z" } }) }));
    expect(await saveBankEntry(good, { text: "Tekst", kind: "sugg", label: null })).toEqual({
      kind: "saved", entry: { id: C1, kind: "sugg", title: "Prijedlog", label: null, body: "Tekst" },
    });
    const empty = commentBankPortFor(() => stub({ "teacher.comment-bank.post": () => ({ ok: true, status: 201, body: {} }) }));
    expect(await saveBankEntry(empty, { text: "Tekst", kind: "sugg", label: null })).toEqual({ kind: "unknown" });
  });
});
