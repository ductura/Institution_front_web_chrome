// WEB-22 (S: PO-17, B-6, B-8): the closed outcome table of the submission,
// every vector of submission.submit.post through createApi against the fake
// server of @ductura/test-fakes, and the reads that wait for contract 3.1.0
// (TODO(ugovor)) over invented answers. All data is invented.
import { answerFake, FAKE_VECTOR_HEADER, VECTORS, type FakeVector } from "@ductura/test-fakes/fake-server";
import { describe, expect, it } from "vitest";
import {
  addNote, NOTE_MAX, readNotes, readRequirements, readSubmissionState, submitOutcomeFrom, submitWork,
  type LocalCall, type SubmissionReceipt, type SubmitInput,
} from "./submission";

const BASE = "https://ductura.example.invalid";
const SUBMIT = VECTORS.filter((v) => v.route === "submission.submit.post");
const RECEIPT = (SUBMIT.find((v) => v.name === "submitted")?.response.body as { receipt: SubmissionReceipt }).receipt;
const ASSIGNMENT = RECEIPT.payload.assignmentId;
const SENT: SubmitInput = { assignmentId: ASSIGNMENT, documentId: RECEIPT.payload.documentId, revision: RECEIPT.payload.revision };

type Sent = { url: string; method: string; headers: Headers; body: string };

/** Answers every request as the fake server answers `vector`; the vector's own bytes stand in for the body. */
function fakeOf(vector: FakeVector, sent: Sent[]): typeof fetch {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    sent.push({ url: String(input), method: init?.method ?? "GET", headers: new Headers(headers), body: String(init?.body ?? "") });
    for (const [name, value] of Object.entries(vector.request.headers ?? {})) headers.set(name, value);
    headers.set(FAKE_VECTOR_HEADER, vector.name);
    const bytes = new TextEncoder().encode(vector.request.rawBody ?? JSON.stringify(vector.request.body));
    if (!headers.has("content-length")) headers.set("content-length", String(bytes.byteLength));
    const answer = answerFake({ method: init?.method ?? "GET", url: String(input), headers: Object.fromEntries(headers), body: bytes });
    const list = Object.entries(answer.headers).flatMap(([n, v]) => (Array.isArray(v) ? v : [v]).map((x) => [n, x] as [string, string]));
    return new Response(answer.body === "" ? null : answer.body, { status: answer.status, headers: list });
  };
}

function reply(status: number, body: unknown, contentType = "application/json"): typeof fetch {
  return async () => new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers: { "content-type": contentType } });
}

function local(status: number, body: unknown, calls: Parameters<LocalCall>[] = []): LocalCall {
  return async (...call) => {
    calls.push(call);
    return status < 400 ? { ok: true, status, body } : { ok: false, status, code: "x" };
  };
}

// The state read that agrees with the already-requested vector (409 revision 6).
const REQUESTED_AT = "2026-12-20T21:14:05.123456Z";
const WAITING = local(200, { state: "ceka", revision: 6, requestedAt: REQUESTED_AT });
const EXPECTED: Readonly<Record<string, object>> = {
  "submitted": { kind: "predano" },
  "submitted-after-deadline": { kind: "predano" },
  "forbidden": { kind: "greska", code: "forbidden" },
  "forbidden-cross-site": { kind: "greska", code: "forbidden" },
  "upgrade-required": { kind: "greska", code: "upgrade_required" },
  "unsupported-media-type": { kind: "greska", code: "unsupported_media_type" },
  "unauthenticated": { kind: "session-expired" },
  "too-large": { kind: "greska", code: "too_large" },
  "timeout": { kind: "nepoznato" },
  "bad-request": { kind: "greska", code: "bad_request" },
  "invalid-unknown-field": { kind: "greska", code: "invalid" },
  "invalid-negative-revision": { kind: "greska", code: "invalid" },
  "invalid-json": { kind: "greska", code: "invalid" },
  "not-found": { kind: "greska", code: "not_found" },
  "blocked-no-evidence": { kind: "odbijeno", reason: "no_evidence" },
  "blocked-record-mismatch": { kind: "nedovrseno" },
  "stale-revision": { kind: "greska", code: "stale_revision", currentRevision: 9 },
  "already-requested": { kind: "stanje", revision: 6, state: { kind: "ceka", revision: 6, requestedAt: REQUESTED_AT } },
  "not-acknowledged": { kind: "greska", code: "not_acknowledged" },
  "not-open": { kind: "greska", code: "not_open" },
  "unavailable-signing": { kind: "nepoznato" },
  "unavailable-verification": { kind: "nepoznato" },
};

describe("submitWork over the contract's vectors", () => {
  it("has an outcome for every vector of the route, and no other", () => {
    expect(SUBMIT.map((v) => v.name).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  it.each(SUBMIT.map((v) => [v.name, v] as const))("%s", async (name, vector) => {
    const sent: Sent[] = [];
    const outcome = await submitWork(SENT, { local: WAITING, api: { baseUrl: BASE, fetchImpl: fakeOf(vector, sent) } });
    expect(outcome).toMatchObject(EXPECTED[name] ?? { kind: "missing" });
    if (outcome.kind === "predano") expect(outcome.receipt).toEqual((vector.response.body as { receipt: unknown }).receipt);
    expect(sent).toHaveLength(1);
  });
});

describe("submitWork", () => {
  const ok = SUBMIT.find((v) => v.name === "submitted") as FakeVector;

  it("sends exactly the document and the revision, under ductus-protocol 1", async () => {
    const sent: Sent[] = [];
    await submitWork(SENT, { api: { baseUrl: BASE, fetchImpl: fakeOf(ok, sent) } });
    expect(sent).toHaveLength(1);
    expect(sent[0]?.url).toBe(`${BASE}/api/v1/submission`);
    expect(sent[0]?.method).toBe("POST");
    expect(sent[0]?.headers.get("ductus-protocol")).toBe("1");
    expect(JSON.parse(sent[0]?.body ?? "")).toEqual({ documentId: SENT.documentId, revision: SENT.revision });
  });

  it("sends nothing once the session has ended here", async () => {
    const sent: Sent[] = [];
    expect(await submitWork(SENT, { current: () => false, api: { baseUrl: BASE, fetchImpl: fakeOf(ok, sent) } }))
      .toEqual({ kind: "session-expired" });
    expect(sent).toHaveLength(0);
  });

  it("sends nothing the contract refuses", async () => {
    const sent: Sent[] = [];
    const outcome = await submitWork({ ...SENT, revision: -1 }, { api: { baseUrl: BASE, fetchImpl: fakeOf(ok, sent) } });
    expect(outcome).toEqual({ kind: "greska", code: "client_rejected" });
    expect(sent).toHaveLength(0);
  });

  it("is nepoznato, never a throw, when the connection breaks", async () => {
    const broken: typeof fetch = async () => { throw new TypeError("network"); };
    expect(await submitWork(SENT, { api: { baseUrl: BASE, fetchImpl: broken } })).toEqual({ kind: "nepoznato" });
  });

  const submitted = (receipt: unknown) => ({ status: "submitted", receipt });
  it.each([
    ["an extra field in the receipt", submitted({ ...RECEIPT, extra: 1 })],
    ["an extra field in the payload", submitted({ ...RECEIPT, payload: { ...RECEIPT.payload, keyId: "k" } })],
    ["an extra field beside the receipt", { ...submitted(RECEIPT), note: "x" }],
    ["a v1 receipt", submitted({ ...RECEIPT, payload: { ...RECEIPT.payload, receiptSchema: "ductus-submission-receipt-v1" } })],
    ["another revision", submitted({ ...RECEIPT, payload: { ...RECEIPT.payload, revision: 6 } })],
    ["another document", submitted({ ...RECEIPT, payload: { ...RECEIPT.payload, documentId: "izmisljeni-rad-0002" } })],
    ["another assignment", submitted({ ...RECEIPT, payload: { ...RECEIPT.payload, assignmentId: "00000000-0000-4000-8000-0000000000a2" } })],
    ["no receipt", { status: "submitted" }],
  ])("a 200 with %s is nepoznato, never predano", async (_, body) => {
    expect(await submitWork(SENT, { api: { baseUrl: BASE, fetchImpl: reply(200, body) } })).toEqual({ kind: "nepoznato" });
  });

  it("names the assignment in any case of its id", async () => {
    const outcome = await submitWork({ ...SENT, assignmentId: ASSIGNMENT.toUpperCase() }, {
      api: { baseUrl: BASE, fetchImpl: reply(200, submitted(RECEIPT)) },
    });
    expect(outcome.kind).toBe("predano");
  });

  it.each([
    [200, "not json", "application/json"],
    [409, { status: "blocked", reason: "something_new" }, "application/json"],
    [409, { status: "something_new" }, "application/json"],
    [409, { status: "already_requested" }, "application/json"],
    [429, { status: "too_many_requests" }, "application/json"],
    [500, { status: "internal" }, "application/json"],
    [502, "<html></html>", "text/html"],
  ] as const)("%i %j is nepoznato", async (status, body, type) => {
    expect(await submitWork(SENT, { api: { baseUrl: BASE, fetchImpl: reply(status, body, type) } })).toEqual({ kind: "nepoznato" });
  });

  describe("on already_requested (409 revision 6)", () => {
    const vector = SUBMIT.find((v) => v.name === "already-requested") as FakeVector;
    const api = { baseUrl: BASE, fetchImpl: fakeOf(vector, []) };
    const six = { ...RECEIPT, payload: { ...RECEIPT.payload, revision: 6 } };

    it("reads the state of this assignment and keeps a receipt for revision 6 of the document sent", async () => {
      const calls: Parameters<LocalCall>[] = [];
      expect(await submitWork(SENT, { api, local: local(200, { state: "potvrdeno", receipt: six }, calls) }))
        .toEqual({ kind: "stanje", revision: 6, state: { kind: "potvrdeno", receipt: six } });
      expect(calls).toEqual([["student.submission.get", { params: { assignmentId: ASSIGNMENT } }]]);
    });

    it.each([
      ["none", { state: "none" }],
      ["ceka for revision 4", { state: "ceka", revision: 4, requestedAt: REQUESTED_AT }],
      ["ceka for revision 7", { state: "ceka", revision: 7, requestedAt: REQUESTED_AT }],
      ["potvrdeno for revision 4", { state: "potvrdeno", receipt: { ...RECEIPT, payload: { ...RECEIPT.payload, revision: 4 } } }],
      ["potvrdeno for the revision sent, not the one held", { state: "potvrdeno", receipt: RECEIPT }],
      ["potvrdeno for another document", { state: "potvrdeno", receipt: { ...six, payload: { ...six.payload, documentId: "izmisljeni-rad-0002" } } }],
      ["an answer out of shape", { state: "ceka", revision: 6 }],
    ])("is nepoznato, never not submitted, when the read gives %s", async (_, body) => {
      expect(await submitWork(SENT, { api, local: local(200, body) })).toEqual({ kind: "nepoznato" });
    });

    it.each([[404, { kind: "nepoznato" }], [503, { kind: "nepoznato" }], [401, { kind: "session-expired" }]])(
      "a read answered %i is %j", async (status, outcome) => {
        expect(await submitWork(SENT, { api, local: local(status, null) })).toEqual(outcome);
      },
    );

    it("sends no read once the session ended while the submission was on its way", async () => {
      const calls: Parameters<LocalCall>[] = [];
      let live = true;
      const ending: typeof fetch = async (url, init) => {
        const answer = await fakeOf(vector, [])(url, init);
        live = false;
        return answer;
      };
      const outcome = await submitWork(SENT, {
        current: () => live, api: { baseUrl: BASE, fetchImpl: ending }, local: local(200, { state: "ceka", revision: 6, requestedAt: REQUESTED_AT }, calls),
      });
      expect(outcome).toEqual({ kind: "session-expired" });
      expect(calls).toHaveLength(0);
    });

    it("is nepoznato without a reader", async () => {
      expect(await submitWork(SENT, { api })).toEqual({ kind: "nepoznato" });
    });
  });

  it.each([
    [{ status: "stale_revision" }],
    [{ status: "stale_revision", currentRevision: "9" }],
    [{ status: "not_open", extra: 1 }],
  ])("a 409 %j out of the contract's shape is nepoznato, never a known refusal", async (body) => {
    expect(await submitWork(SENT, { api: { baseUrl: BASE, fetchImpl: reply(409, body) } })).toEqual({ kind: "nepoznato" });
  });

  it("reads a 409 from its kept body, never from the code alone", () => {
    const result = { ok: false, status: 409, code: "stale_revision" };
    expect(submitOutcomeFrom(result, { status: "stale_revision" }, SENT)).toEqual({ kind: "nepoznato" });
    expect(submitOutcomeFrom(result, undefined, SENT)).toEqual({ kind: "nepoznato" });
    expect(submitOutcomeFrom({ ...result, code: "not_open" }, { status: "not_open" }, SENT)).toEqual({ kind: "greska", code: "not_open" });
  });

  it("is session-expired on a 401 session_expired", async () => {
    const outcome = await submitWork(SENT, { api: { baseUrl: BASE, fetchImpl: reply(401, { code: "session_expired" }) } });
    expect(outcome).toEqual({ kind: "session-expired" });
  });
});

describe("readSubmissionState (TODO(ugovor))", () => {
  it.each([
    [{ state: "none" }, { kind: "none" }],
    [{ state: "ceka", revision: 7, requestedAt: "2026-12-20T21:14:05.123456Z" }, { kind: "ceka", revision: 7, requestedAt: "2026-12-20T21:14:05.123456Z" }],
    [{ state: "potvrdeno", receipt: RECEIPT }, { kind: "potvrdeno", receipt: RECEIPT }],
    [{ state: "ceka", revision: 7, requestedAt: "2026-12-20T21:14:05Z" }, { kind: "nepoznato" }],
    [{ state: "ceka", revision: 0, requestedAt: "2026-12-20T21:14:05.123456Z" }, { kind: "nepoznato" }],
    [{ state: "none", receipt: RECEIPT }, { kind: "nepoznato" }],
    [{ state: "potvrdeno", receipt: { ...RECEIPT, extra: 1 } }, { kind: "nepoznato" }],
    [{ state: "potvrdeno", receipt: { ...RECEIPT, payload: { ...RECEIPT.payload, assignmentId: "00000000-0000-4000-8000-0000000000a2" } } }, { kind: "nepoznato" }],
    [{ state: "submitted" }, { kind: "nepoznato" }],
  ])("200 %j reads as %j", async (body, read) => {
    expect(await readSubmissionState(local(200, body), ASSIGNMENT)).toEqual(read);
  });

  it.each([
    [401, { kind: "session-expired" }],
    [404, { kind: "greska", code: "not_found" }],
    [503, { kind: "nepoznato" }],
    [201, { kind: "nepoznato" }],
  ])("%i reads as %j", async (status, read) => {
    expect(await readSubmissionState(local(status, { state: "none" }), ASSIGNMENT)).toEqual(read);
  });

  it("is nepoznato when the transport throws", async () => {
    expect(await readSubmissionState(async () => { throw new Error("x"); }, ASSIGNMENT)).toEqual({ kind: "nepoznato" });
  });
});

describe("readRequirements (TODO(ugovor))", () => {
  it.each([
    [{ wordRange: null }, { kind: "ready", wordRange: null }],
    [{ wordRange: { min: 1200, max: 1600 } }, { kind: "ready", wordRange: { min: 1200, max: 1600 } }],
    [{ wordRange: { min: 1600, max: 1200 } }, { kind: "nepoznato" }],
    [{ wordRange: { min: 1200 } }, { kind: "nepoznato" }],
    [{ wordRange: null, extra: 1 }, { kind: "nepoznato" }],
    [{}, { kind: "nepoznato" }],
  ])("200 %j reads as %j", async (body, read) => {
    const calls: Parameters<LocalCall>[] = [];
    expect(await readRequirements(local(200, body, calls), ASSIGNMENT)).toEqual(read);
    expect(calls).toEqual([["student.assignment-requirements.get", { params: { assignmentId: ASSIGNMENT } }]]);
  });
});

describe("notes (TODO(ugovor))", () => {
  const note = { id: "izmisljena-napomena-1", text: "Izmišljena napomena uz predaju.", createdAt: "2026-12-20T21:00:00.000000Z" };

  it("reads the list, and nothing out of shape", async () => {
    expect(await readNotes(local(200, { notes: [note] }), ASSIGNMENT)).toEqual({ kind: "ready", notes: [note] });
    expect(await readNotes(local(200, { notes: [{ ...note, author: "x" }] }), ASSIGNMENT)).toEqual({ kind: "nepoznato" });
    expect(await readNotes(local(401, null), ASSIGNMENT)).toEqual({ kind: "session-expired" });
  });

  it("sends the assignment and the text, and reads the added note", async () => {
    const calls: Parameters<LocalCall>[] = [];
    expect(await addNote(local(201, { note }, calls), ASSIGNMENT, note.text)).toEqual({ kind: "added", note });
    expect(calls).toEqual([["student.submission-notes.post", { params: { assignmentId: ASSIGNMENT }, body: { assignmentId: ASSIGNMENT, text: note.text } }]]);
    expect(await addNote(local(422, null), ASSIGNMENT, note.text)).toEqual({ kind: "greska", code: "invalid" });
  });

  it.each([["empty", ""], ["blank", " \n\t "], ["601 characters", "a".repeat(NOTE_MAX + 1)]])(
    "does not send %s text", async (_, text) => {
      const calls: Parameters<LocalCall>[] = [];
      expect(await addNote(local(201, { note }, calls), ASSIGNMENT, text)).toEqual({ kind: "greska", code: "invalid" });
      expect(calls).toHaveLength(0);
    },
  );

  it("counts characters, not UTF-16 units: 600 emoji go", async () => {
    const text = "🌱".repeat(NOTE_MAX);
    expect(await addNote(local(201, { note: { ...note, text } }), ASSIGNMENT, text)).toEqual({ kind: "added", note: { ...note, text } });
  });
});
