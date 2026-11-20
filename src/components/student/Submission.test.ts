import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { oneAtATime, readWork, textOf } from "./Submission";

// WEB-26: the open of the work and the one-request guard. Invented work only.
const DOC = { schemaVersion: 1, nodes: [{ id: "11111111-1111-4111-8111-111111111111", type: "paragraph", children: [{ type: "text", text: "Izmišljeni tekst.", marks: [] }] }] };
const BYTES = Buffer.from(JSON.stringify(DOC), "utf8");
const HASH = createHash("sha256").update(BYTES).digest("hex");
const ASSIGNMENT = "7c1e2f3a-4b5c-4d6e-8f70-0a1b2c3d4e5f";

const opened = (over: Record<string, unknown> = {}) => ({
  status: "opened", documentId: "doc-izmisljeni-1", evidenceProfileId: "profil-izmisljeni", currentRevision: 3,
  documentHash: HASH, headSegmentHash: null, lastSequenceTo: 0, document: BYTES.toString("base64"),
  receiptKeys: [], submitted: false, ...over,
});

function server(status: number, body: unknown, seen: { headers?: Headers; body?: unknown } = {}) {
  return {
    baseUrl: "http://localhost",
    fetchImpl: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = new Request(input, init);
      seen.headers = request.headers;
      seen.body = await request.json();
      return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    }) as typeof fetch,
  };
}

describe("readWork (evidence.open.post through createApi)", () => {
  it("shows the revision on the server with its text, asked under ductus-protocol 1 for this assignment only", async () => {
    const seen: { headers?: Headers; body?: unknown } = {};
    const read = await readWork(ASSIGNMENT, server(200, opened(), seen));
    expect(read).toEqual({
      kind: "ready", documentId: "doc-izmisljeni-1", revision: 3,
      nodes: [{ id: DOC.nodes[0]?.id, type: "paragraph", children: [{ type: "text", text: "Izmišljeni tekst.", marks: [] }] }],
    });
    expect(seen.headers?.get("ductus-protocol")).toBe("1");
    expect(seen.body).toEqual({ assignmentId: ASSIGNMENT });
  });

  it("never shows a text that does not hash to what the server named", async () => {
    expect(await readWork(ASSIGNMENT, server(200, opened({ documentHash: "0".repeat(64) })))).toEqual({ kind: "unavailable" });
  });

  it("revision 0 and a work not started have nothing to submit", async () => {
    expect(await readWork(ASSIGNMENT, server(200, opened({ currentRevision: 0 })))).toEqual({ kind: "empty" });
    expect(await readWork(ASSIGNMENT, server(409, { status: "not_started" }))).toEqual({ kind: "empty" });
  });

  it("a notice not acknowledged, a signed-out session and anything else are their own places", async () => {
    expect(await readWork(ASSIGNMENT, server(409, { status: "not_accepting" }))).toEqual({ kind: "notice" });
    expect(await readWork(ASSIGNMENT, server(401, { status: "unauthenticated" }))).toEqual({ kind: "signIn" });
    expect(await readWork(ASSIGNMENT, server(503, { status: "unavailable", stage: "context" }))).toEqual({ kind: "unavailable" });
    expect(await readWork(ASSIGNMENT, server(200, { ...opened(), extra: true }))).toEqual({ kind: "unavailable" });
  });
});

describe("textOf", () => {
  it("refuses bytes that are not a document", async () => {
    const bytes = Buffer.from(JSON.stringify({ nodes: [{ type: "image" }] }));
    expect(await textOf(bytes.toString("base64"), createHash("sha256").update(bytes).digest("hex"))).toBeNull();
    expect(await textOf("@@", HASH)).toBeNull();
  });
});

describe("oneAtATime: a double click sends one request", () => {
  it("drops a call made while the first is on its way, and sends again after it", async () => {
    let sent = 0;
    let release: () => void = () => undefined;
    const send = oneAtATime(() => { sent += 1; return new Promise<string>((done) => { release = () => done("odgovor"); }); });
    const first = send(undefined);
    expect(await send(undefined)).toBeNull();
    expect(sent).toBe(1);
    release();
    expect(await first).toBe("odgovor");
    const third = send(undefined);
    release();
    await third;
    expect(sent).toBe(2);
  });
});
