// Ported from Ductus 0cdb0f1 src/client/comments.test.ts. threadsFromList is
// tested unchanged; the calls go to collaboration.comments.post of the
// contract (/api/v1/comments/<action>) through createApi, so the stubbed
// answers carry the JSON content type, and the last block runs the route's
// vectors on the fake server from @ductura/test-fakes.
import type { AddressInfo } from "node:net";
import { createFakeServer, FAKE_VECTOR_HEADER, VECTORS, type FakeVector } from "@ductura/test-fakes/fake-server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { TextAnchor } from "../../packages/editor-core/src/document/collaboration";

import type { ApiOptions } from "./api";
import { changeThreadState, createComment, listComments, replyComment, threadsFromList } from "./comments";

const ORIGIN = "https://ductura.example.invalid";

const T1 = "aaaaaaaa-0000-4000-8000-000000000001";
const T2 = "aaaaaaaa-0000-4000-8000-000000000002";
const anchor = {
  nodeId: "0f8e2a64-1b3c-4d5e-8f60-718293a4b5c6", quote: "knjižnice", prefix: "Gradske ", suffix: " su",
  startHint: 8, endHint: 17,
};
let n = 0;
const row = (threadId: string, position: number, extra: Record<string, unknown> = {}) => ({
  threadId, commentId: `bbbbbbbb-0000-4000-8000-${String(++n).padStart(12, "0")}`, position,
  authorRole: position === 1 ? "teacher" : "student", isOwn: position !== 1, body: `Tekst ${position}`,
  anchor: position === 1 ? anchor : null, state: "answered", createdWindow: "2026-10-18T10:05:00.000Z",
  deletedWindow: null, ...extra,
});

describe("threadsFromList", () => {
  it("groups rows into numbered threads in order", () => {
    const threads = threadsFromList({ comments: [row(T1, 1), row(T1, 2), row(T2, 1, { state: "open" })] })!;
    expect(threads.map((t) => [t.number, t.id, t.state, t.comments.length])).toEqual([
      [1, T1, "answered", 2],
      [2, T2, "open", 1],
    ]);
    expect(threads[0]!.anchor).toEqual(anchor);
    expect(threads[0]!.comments[1]).toMatchObject({ role: "student", isOwn: true, body: "Tekst 2" });
  });

  it("keeps a thread whose stored anchor is out of shape, without a place", () => {
    const threads = threadsFromList({ comments: [row(T1, 1, { anchor: { ...anchor, extra: 1 } })] })!;
    expect(threads[0]!.anchor).toBeNull();
  });

  it("keeps a body with markup as plain text", () => {
    const threads = threadsFromList({ comments: [row(T1, 1, { body: "<script>alert(1)</script>" })] })!;
    expect(threads[0]!.comments[0]!.body).toBe("<script>alert(1)</script>");
  });

  it("keeps a deleted comment at its place, without text, with the window of deletion", () => {
    const deletedWindow = "2026-10-18T11:20:00.000Z";
    const threads = threadsFromList({ comments: [row(T1, 1), row(T1, 2, { body: null, deletedWindow }), row(T1, 3)] })!;
    expect(threads[0]!.comments.map((c) => c.body)).toEqual(["Tekst 1", null, "Tekst 3"]);
    expect(threads[0]!.comments[1]).toMatchObject({ role: "student", isOwn: true, deletedWindow });
  });

  it.each([
    ["not an object", null],
    ["no text and no deletion", { comments: [row(T1, 1, { body: null })] }],
    ["text after deletion", { comments: [row(T1, 1, { deletedWindow: "2026-10-18T11:20:00.000Z" })] }],
    ["bad deletion time", { comments: [row(T1, 1, { body: null, deletedWindow: "jučer" })] }],
    ["no deletion field", { comments: [row(T1, 1, { deletedWindow: undefined })] }],
    ["no list", {}],
    ["unknown role", { comments: [row(T1, 1, { authorRole: "admin" })] }],
    ["unknown state", { comments: [row(T1, 1, { state: "closed" })] }],
    ["reply before its thread", { comments: [row(T1, 2)] }],
    ["gap in positions", { comments: [row(T1, 1), row(T1, 3)] }],
    ["anchor on a reply", { comments: [row(T1, 1), row(T1, 2, { anchor })] }],
    ["thread opened twice", { comments: [row(T1, 1), row(T2, 1), row(T1, 1)] }],
    ["bad id", { comments: [row("x", 1)] }],
    ["bad time", { comments: [row(T1, 1, { createdWindow: "jučer" })] }],
  ])("refuses the whole list: %s", (_name, value) => {
    expect(threadsFromList(value)).toBeNull();
  });
});

describe("listComments and replyComment", () => {
  // The page's own origin and fetch, as the components call these functions.
  beforeEach(() => vi.stubGlobal("location", { origin: ORIGIN }));
  afterEach(() => vi.unstubAllGlobals());

  const answer = (status: number, body?: unknown) =>
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), {
      status, headers: body === undefined ? {} : { "content-type": "application/json" },
    })));

  it("posts only the document id and maps the answers", async () => {
    answer(200, { comments: [row(T1, 1)] });
    expect((await listComments("doc-1")).kind).toBe("ok");
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toBe(`${ORIGIN}/api/v1/comments/list`);
    expect(JSON.parse(String(init!.body))).toEqual({ documentId: "doc-1" });

    answer(403);
    expect(await listComments("doc-1")).toEqual({ kind: "forbidden" });
    answer(401);
    expect(await listComments("doc-1")).toEqual({ kind: "signedOut" });
    answer(200, { comments: [row(T1, 2)] });
    expect(await listComments("doc-1")).toEqual({ kind: "unavailable" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    expect(await listComments("doc-1")).toEqual({ kind: "unavailable" });
  });

  it("sends a reply in NFC with the thread id alone", async () => {
    answer(200, { id: T2 });
    expect(await replyComment(T1, "Hvala, dopunit ču.")).toBe("ok");
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]![1]!.body))).toEqual({ threadId: T1, body: "Hvala, dopunit ču." });
    for (const [status, outcome] of [[401, "signedOut"], [403, "forbidden"], [409, "conflict"], [422, "invalid"], [503, "unavailable"]] as const) {
      answer(status);
      expect(await replyComment(T1, "Da.")).toBe(outcome);
    }
  });

  it("opens a thread with the document, the body in NFC and the anchor alone", async () => {
    answer(200, { id: T2 });
    expect(await createComment("doc-1", "Dodaj izvor.", anchor as TextAnchor)).toBe("ok");
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toBe(`${ORIGIN}/api/v1/comments/create`);
    expect(JSON.parse(String(init!.body))).toEqual({ documentId: "doc-1", body: "Dodaj izvor.", anchor });
    for (const [status, outcome] of [[401, "signedOut"], [403, "forbidden"], [422, "invalid"], [503, "unavailable"]] as const) {
      answer(status);
      expect(await createComment("doc-1", "Da.", anchor as TextAnchor)).toBe(outcome);
    }
  });

  it("resolves and reopens a thread by its id, 204 being success", async () => {
    answer(204);
    expect(await changeThreadState(T1, "resolve")).toBe("ok");
    expect(String(vi.mocked(fetch).mock.calls[0]![0])).toBe(`${ORIGIN}/api/v1/comments/resolve`);
    expect(JSON.parse(String(vi.mocked(fetch).mock.calls[0]![1]!.body))).toEqual({ threadId: T1 });
    answer(204);
    expect(await changeThreadState(T1, "reopen")).toBe("ok");
    expect(String(vi.mocked(fetch).mock.calls[0]![0])).toBe(`${ORIGIN}/api/v1/comments/reopen`);
    for (const [status, outcome] of [[200, "unavailable"], [401, "signedOut"], [403, "forbidden"], [409, "conflict"], [503, "unavailable"]] as const) {
      answer(status);
      expect(await changeThreadState(T1, "resolve")).toBe(outcome);
    }
  });

  it("sends nothing once the session of the page has ended (F-093)", async () => {
    answer(200, { id: T2 });
    expect(await createComment("doc-1", "Da.", anchor as TextAnchor, () => false)).toBe("signedOut");
    expect(await changeThreadState(T1, "resolve", () => false)).toBe("signedOut");
    expect(await replyComment(T1, "Da.", () => false)).toBe("signedOut");
    expect(await listComments("doc-1", () => false)).toEqual({ kind: "signedOut" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("refuses input the contract refuses before any request, as the route's 422", async () => {
    answer(200, { id: T2 });
    expect(await replyComment(T1, "   ")).toBe("invalid");
    expect(await createComment("doc-1", "Da.", { ...anchor, extra: 1 } as unknown as TextAnchor)).toBe("invalid");
    expect(await changeThreadState("x", "resolve")).toBe("invalid");
    expect(await listComments("")).toEqual({ kind: "unavailable" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("an answer outside the contract is unavailable, never success", async () => {
    answer(200, { id: T2, extra: 1 });
    expect(await replyComment(T1, "Da.")).toBe("unavailable");
    answer(200, { comments: [{ ...row(T1, 1), extra: 1 }] });
    expect(await listComments("doc-1")).toEqual({ kind: "unavailable" });
  });
});

describe("the route's vectors on the fake server", () => {
  const server = createFakeServer();
  let baseUrl = "";
  beforeAll(async () => {
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((done) => server.close(() => done())));

  const vector = (name: string) => {
    const found = VECTORS.find((v) => v.route === "collaboration.comments.post" && v.name === name);
    if (found === undefined) throw new Error(`no vector ${name}`);
    return found;
  };
  /** createApi over the fake server answering with the named vector, with what a browser adds (cookie, Origin). */
  const through = (v: FakeVector, sent: string[] = []): ApiOptions => ({
    baseUrl,
    fetchImpl: (input, init) => {
      sent.push(String(init?.body));
      const headers = new Headers(init?.headers);
      for (const [name, value] of Object.entries(v.request.headers ?? {})) if (name !== "content-length") headers.set(name, value);
      headers.set(FAKE_VECTOR_HEADER, v.name);
      return fetch(input, { ...init, headers });
    },
  });
  const body = (v: FakeVector) => v.request.body as Record<string, unknown>;

  it("lists the threads of the listed vector", async () => {
    const v = vector("listed");
    const outcome = await listComments(String(body(v).documentId), () => true, through(v));
    expect(outcome.kind).toBe("ok");
    expect(outcome.kind === "ok" && outcome.threads).toEqual(threadsFromList(v.response.body));
  });

  it("creates, replies and resolves, sending exactly the vector's body", async () => {
    const created = vector("created");
    const sent: string[] = [];
    const c = body(created);
    expect(await createComment(String(c.documentId), String(c.body), c.anchor as TextAnchor, () => true, through(created, sent))).toBe("ok");
    const replied = vector("replied");
    const r = body(replied);
    expect(await replyComment(String(r.threadId), String(r.body), () => true, through(replied, sent))).toBe("ok");
    const resolved = vector("resolved");
    expect(await changeThreadState(String(body(resolved).threadId), "resolve", () => true, through(resolved, sent))).toBe("ok");
    expect(sent.map((text) => JSON.parse(text))).toEqual([c, r, body(resolved)]);
  });

  it.each([
    ["unauthorized", "signedOut"], ["forbidden", "forbidden"], ["origin-mismatch", "forbidden"], ["cross-site", "forbidden"],
  ] as const)("resolve answered by %s is %s", async (name, outcome) => {
    const v = vector(name);
    expect(await changeThreadState(String(body(v).threadId), "resolve", () => true, through(v))).toBe(outcome);
  });

  it("a reply answered by conflict is conflict", async () => {
    const v = vector("conflict");
    expect(await replyComment(String(body(v).threadId), String(body(v).body), () => true, through(v))).toBe("conflict");
  });

  it("a list answered by unavailable is unavailable", async () => {
    const v = vector("unavailable");
    expect(await listComments(String(body(v).documentId), () => true, through(v))).toEqual({ kind: "unavailable" });
  });
});
