// @vitest-environment node
import { createHash, generateKeyPairSync, sign as nodeSign } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { MAX_DOCUMENT_SNAPSHOT_BYTES } from "../../packages/editor-core/src/document/document/snapshot";
import { MAX_EVIDENCE_SEGMENT_BYTES } from "../../packages/editor-core/src/document/forensics/evidence-chain-v2";
import type { EvidenceReceiptPayloadV2, SignedEvidenceReceiptV2 } from "../../packages/editor-core/src/document/forensics/evidence-receipt";
import type { EvidenceDomainKey } from "../../packages/editor-core/src/document/forensics/evidence-receipt-verifier";
import { loadGoldenVectors } from "../../packages/editor-core/src/document/forensics/golden-vectors/load";
import { canonicalizeJcs } from "../../packages/editor-core/src/document/forensics/jcs";
import { ackedRevision, isRetryable } from "../../packages/editor-core/src/sync/drain";

import {
  commitEvidence,
  commitOutcomeFrom,
  createCommitProtocol,
  createReceiptVerifier,
  decodeBase64,
  encodeBase64,
  openWork,
  openedWorkFrom,
  type CommitProtocol,
  type FetchLike,
} from "./evidence-ingest";

/**
 * F-8 step 3c (DAN-37, plan #178): the client of the evidence routes. Every
 * key is made for the test and every id is invented.
 */

const { receiptV2 } = loadGoldenVectors();
const BASE = receiptV2.accepted[0]!.payload;
const DOC = BASE.documentId;
const DOMAIN = BASE.evidenceDomainId;
const SEGMENT = new TextEncoder().encode('{"izmisljeni":"odsjecak"}');
const SNAPSHOT = new TextEncoder().encode('{"izmisljeni":"dokument"}');
const SEGMENT_HASH = createHash("sha256").update(SEGMENT).digest("hex");

function receiptKey(keyId: string, scope: Partial<EvidenceDomainKey> = {}) {
  const pair = generateKeyPairSync("ed25519");
  const key: EvidenceDomainKey = {
    algorithm: "Ed25519",
    keyId,
    keyVersion: "1",
    encoding: "spki-der",
    keyBase64Url: pair.publicKey.export({ type: "spki", format: "der" }).toString("base64url"),
    evidenceDomainId: DOMAIN,
    purpose: "receipt",
    validFrom: "2026-01-01T00:00:00.000Z",
    validTo: null,
    revokedAt: null,
    ...scope,
  };
  const sign = (over: Partial<EvidenceReceiptPayloadV2>): SignedEvidenceReceiptV2 => {
    const payload = { ...BASE, segmentHash: SEGMENT_HASH, ...over };
    const digest = createHash("sha256").update(canonicalizeJcs(payload), "utf8").digest();
    const input = Buffer.concat([Buffer.from("ductus-evidence-receipt-v2\n"), digest]);
    return {
      payload,
      payloadDigestSha256: digest.toString("hex"),
      signature: {
        algorithm: "Ed25519", keyId, keyVersion: "1", signatureEncoding: "raw",
        signatureBase64Url: nodeSign(null, input, pair.privateKey).toString("base64url"),
      },
    };
  };
  return { key, sign };
}

const trusted = receiptKey("kljuc-izmisljeni-1");

/** createApi sends to the page's own origin; the test runs in node, so it names one. */
const ORIGIN = "https://ductura.example.invalid";
const ASSIGNMENT = "11111111-1111-4111-8111-111111111111";
beforeAll(() => { vi.stubGlobal("location", { origin: ORIGIN }); });
afterAll(() => { vi.unstubAllGlobals(); });

function openBody(over: Record<string, unknown> = {}) {
  return {
    status: "opened", documentId: DOC, evidenceProfileId: "profil-izmisljeni", currentRevision: 0,
    documentHash: "a".repeat(64), headSegmentHash: null, lastSequenceTo: 0,
    document: encodeBase64(SNAPSHOT), receiptKeys: [trusted.key], submitted: false, ...over,
  };
}

/** A fetch that answers each call with the next scripted response and records the requests. */
function scripted(...answers: (Response | Error)[]) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const next = answers.shift();
    if (next === undefined) throw new Error("unexpected request");
    if (next instanceof Error) throw next;
    return next;
  };
  return { calls, fetchImpl };
}

const json = (status: number, body: unknown) => Response.json(body, { status });
const committed = (status: "committed" | "duplicate", revision: number, signedReceipt: unknown) =>
  json(200, { status, revision, receipt: { status: "signed", signedReceipt } });
/** The answer of protocol 2 while the worker has not signed yet (4.13 t. 9, #1758). */
const pending = (status: "committed" | "duplicate", revision: number) =>
  Response.json({ status, revision, receipt: { status: "pending_signature" } }, { status: 202, headers: { "retry-after": "2" } });
const protocolsOf = (calls: { init: RequestInit }[]) =>
  calls.map(({ init }) => (init.headers as Record<string, string>)["ductus-protocol"]);

const INPUT = { documentId: DOC, clientTransactionId: BASE.clientTransactionId, baseRevision: 0, segment: SEGMENT, document: SNAPSHOT };

describe("F-8 3c: the commit envelope", () => {
  it("sends the exact bytes as padded base64 in a closed envelope with the protocol header", async () => {
    const { calls, fetchImpl } = scripted(committed("committed", BASE.revision, trusted.sign({})));
    await commitEvidence(INPUT, fetchImpl);
    const [{ url, init }] = calls as [{ url: string; init: RequestInit }];
    expect(url).toBe(`${ORIGIN}/api/v1/evidence/commit`);
    expect(init).toMatchObject({ method: "POST", redirect: "manual" });
    expect(init.headers).toEqual({ "content-type": "application/json", "ductus-protocol": "2" });
    const body = JSON.parse(init.body as string);
    expect(Object.keys(body).sort()).toEqual(["baseRevision", "clientTransactionId", "document", "documentId", "segments"]);
    expect(decodeBase64(body.segments[0])).toEqual(SEGMENT);
    expect(decodeBase64(body.document)).toEqual(SNAPSHOT);
    expect(body.segments).toHaveLength(1);
  });

  it("keeps a segment or snapshot over its limit and a malformed key on the device", async () => {
    const { calls, fetchImpl } = scripted();
    const big = (n: number) => new Uint8Array(n + 1);
    expect(await commitEvidence({ ...INPUT, segment: big(MAX_EVIDENCE_SEGMENT_BYTES) }, fetchImpl)).toEqual({ status: "too_large" });
    expect(await commitEvidence({ ...INPUT, document: big(MAX_DOCUMENT_SNAPSHOT_BYTES) }, fetchImpl)).toEqual({ status: "too_large" });
    expect(await commitEvidence({ ...INPUT, clientTransactionId: "" }, fetchImpl)).toEqual({ status: "invalid_client_transaction_id" });
    expect(calls).toEqual([]);
  });

  it("round-trips bytes of every value through base64 and refuses a second spelling", () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    expect(decodeBase64(encodeBase64(bytes))).toEqual(bytes);
    expect(decodeBase64("QQ")).toBeNull();
    expect(decodeBase64("QR==")).toBeNull();
    expect(decodeBase64("QQ==\n")).toBeNull();
  });
});

describe("F-8 3c: every answer of 4.13 t. 4 as a drain outcome", () => {
  const state = { currentRevision: 4, documentHash: "b".repeat(64), headSegmentHash: null, lastSequenceTo: 3 };
  it.each([
    [409, { status: "stale_base", ...state }, { status: "stale_base", currentRevision: 4 }],
    [409, { status: "chain_conflict", ...state }, { status: "stale_base", currentRevision: 4 }],
    [409, { status: "not_continuous", ...state }, { status: "stale_base", currentRevision: 4 }],
    [409, { status: "stale_base" }, { status: "invalid" }],
    [409, { status: "txid_reused" }, { status: "txid_reused" }],
    [422, { status: "invalid" }, { status: "invalid_document" }],
    [422, { status: "document_mismatch" }, { status: "invalid_document" }],
    [413, { status: "too_large" }, { status: "too_large" }],
    [404, { status: "not_found" }, { status: "not_found" }],
    [409, { status: "not_accepting" }, { status: "not_found" }],
    [401, { status: "unauthenticated" }, { status: "unauthenticated" }],
    [503, { status: "unavailable", stage: "signing" }, { status: "transport_error" }],
    [502, null, { status: "transport_error" }],
    [408, { status: "timeout" }, { status: "transport_error" }],
    [408, { status: "committed" }, { status: "invalid" }],
    [426, { status: "upgrade_required" }, { status: "invalid" }],
    [404, { status: "unauthenticated" }, { status: "invalid" }],
    [200, { status: "stale_base", currentRevision: 1 }, { status: "invalid" }],
    [200, { status: "committed", revision: 1 }, { status: "invalid" }],
    [200, { status: "signed_by_proxy" }, { status: "invalid" }],
    [400, { status: "bad_request" }, { status: "invalid" }],
  ])("HTTP %i %j → %j", (http, body, expected) => {
    expect(commitOutcomeFrom(http, body)).toEqual(expected);
  });

  it("a lost answer is a transport error, never a refusal", async () => {
    const { fetchImpl } = scripted(new TypeError("Failed to fetch"));
    expect(await commitEvidence(INPUT, fetchImpl)).toEqual({ status: "transport_error" });
    const cut = scripted(new Response("<html>", { status: 504 }));
    expect(await commitEvidence(INPUT, cut.fetchImpl)).toEqual({ status: "transport_error" });
    const garbled = scripted(new Response("{", { status: 200 }));
    expect(await commitEvidence(INPUT, garbled.fetchImpl)).toEqual({ status: "invalid" });
  });
});

describe("DAN-595: the 202 answer of protocol 2 as a drain outcome", () => {
  const PENDING = { status: "pending_signature" };
  const SIGNED = { status: "signed", signedReceipt: { payload: {}, signature: {} } };
  const at = (revision: unknown, receipt: unknown = PENDING) => ({ status: "committed", revision, receipt });
  const INVALID = { status: "invalid" };
  it.each([
    ["committed, pending, under 2", 202, at(3), "2", { status: "committed", revision: 3, receipt: PENDING }],
    ["duplicate, pending, under 2", 202, { ...at(3), status: "duplicate" }, "2", { status: "duplicate", revision: 3, receipt: PENDING }],
    ["pending to a request under 1", 202, at(3), "1", INVALID],
    ["a signed receipt in a 202", 202, at(3, SIGNED), "2", INVALID],
    ["pending that also carries signedReceipt", 202, at(3, { ...PENDING, signedReceipt: {} }), "2", INVALID],
    ["no receipt", 202, { status: "committed", revision: 3 }, "2", INVALID],
    ["an unknown receipt status", 202, at(3, { status: "queued" }), "2", INVALID],
    ["revision 0", 202, at(0), "2", INVALID],
    ["a fractional revision", 202, at(2.5), "2", INVALID],
    ["a negative revision", 202, at(-1), "2", INVALID],
    ["an unsafe revision", 202, at(2 ** 53), "2", INVALID],
    ["a revision as text", 202, at("3"), "2", INVALID],
    ["stale_base", 202, { status: "stale_base", currentRevision: 1 }, "2", INVALID],
    ["an unknown status", 202, { status: "pending", revision: 3, receipt: PENDING }, "2", INVALID],
    ["no body", 202, undefined, "2", INVALID],
    ["an array", 202, [at(3)], "2", INVALID],
    ["pending in a 200 under 2", 200, at(3), "2", INVALID],
    ["pending in a 200 under 1", 200, { ...at(3), status: "duplicate" }, "1", INVALID],
  ])("HTTP %#: %s", (_name, http, body, protocol, expected) => {
    const outcome = commitOutcomeFrom(http as number, body, protocol as "1" | "2");
    expect(outcome).toEqual(expected);
    // Pending is repeated by itself and never acknowledged; nothing else in this table is either.
    expect(isRetryable(outcome)).toBe(expected !== INVALID);
    expect(ackedRevision(outcome)).toBeNull();
  });

  it("a signed receipt is read alike under either protocol", () => {
    const body = at(3, SIGNED);
    expect(commitOutcomeFrom(200, body, "2")).toEqual(commitOutcomeFrom(200, body, "1"));
    expect(commitOutcomeFrom(200, body, "2")).toMatchObject({ receipt: { status: "signed" } });
  });
});

describe("DAN-595: the Ductus-Protocol header", () => {
  const upgrade = () => json(426, { status: "upgrade_required" });

  it("refused before the body was read, the same bytes go out once more under 1", async () => {
    const { calls, fetchImpl } = scripted(upgrade(), committed("committed", BASE.revision, trusted.sign({})));
    expect(await commitEvidence(INPUT, fetchImpl)).toMatchObject({ status: "committed", revision: BASE.revision });
    expect(protocolsOf(calls)).toEqual(["2", "1"]);
    expect(calls[1]!.init.body).toBe(calls[0]!.init.body);
  });

  it("one refusal keeps the transport on 1, and a 426 under 1 is not repeated", async () => {
    const protocol: CommitProtocol = createCommitProtocol();
    const { calls, fetchImpl } = scripted(upgrade(), json(503, { status: "unavailable", stage: "repository" }), upgrade());
    expect(await commitEvidence(INPUT, fetchImpl, protocol)).toEqual({ status: "transport_error" });
    expect(await commitEvidence(INPUT, fetchImpl, protocol)).toEqual({ status: "invalid" });
    expect(protocolsOf(calls)).toEqual(["2", "1", "1"]);
  });

  it("only upgrade_required changes the protocol: a lost answer, a 503, a 202 or another 426 keep it", async () => {
    const protocol = createCommitProtocol();
    const { calls, fetchImpl } = scripted(
      new TypeError("offline"), json(503, { status: "unavailable", stage: "signing" }), pending("committed", 3),
      json(426, { status: "forbidden" }), new Response("", { status: 426 }), pending("duplicate", 3),
    );
    expect(await commitEvidence(INPUT, fetchImpl, protocol)).toEqual({ status: "transport_error" });
    expect(await commitEvidence(INPUT, fetchImpl, protocol)).toEqual({ status: "transport_error" });
    expect(await commitEvidence(INPUT, fetchImpl, protocol)).toMatchObject({ receipt: { status: "pending_signature" } });
    expect(await commitEvidence(INPUT, fetchImpl, protocol)).toEqual({ status: "invalid" });
    expect(await commitEvidence(INPUT, fetchImpl, protocol)).toEqual({ status: "invalid" });
    expect(await commitEvidence(INPUT, fetchImpl, protocol)).toMatchObject({ status: "duplicate" });
    expect(protocolsOf(calls)).toEqual(["2", "2", "2", "2", "2", "2"]);
  });

  /** A server that answers only when the test says so, oldest request first, so requests can overlap. */
  function held() {
    const calls: { url: string; init: RequestInit }[] = [];
    const waiting: ((answer: Response | Error) => void)[] = [];
    const fetchImpl: FetchLike = (url, init) => {
      calls.push({ url, init });
      return new Promise((resolve, reject) => {
        waiting.push((answer) => (answer instanceof Error ? reject(answer) : resolve(answer)));
      });
    };
    const answer = (next: Response | Error) => waiting.shift()!(next);
    const sent = async (count: number) => {
      await vi.waitFor(() => expect(calls).toHaveLength(count));
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(calls).toHaveLength(count);
    };
    return { calls, fetchImpl, answer, sent };
  }
  const OTHER_WORK = { ...INPUT, documentId: "dokument-izmisljeni-2", clientTransactionId: "tx-izmisljena-druga" };

  it("two works that send before the first answer pay one 426: the second waits for it, then goes under 1 (QA c.6731112408)", async () => {
    const protocol = createCommitProtocol();
    const server = held();
    const first = commitEvidence(INPUT, server.fetchImpl, protocol);
    const second = commitEvidence(OTHER_WORK, server.fetchImpl, protocol);
    await server.sent(1);
    server.answer(upgrade());
    await server.sent(3);
    expect(protocolsOf(server.calls)).toEqual(["2", "1", "1"]);
    expect(server.calls[1]!.init.body).toBe(server.calls[0]!.init.body);
    server.answer(json(503, { status: "unavailable", stage: "repository" }));
    server.answer(json(503, { status: "unavailable", stage: "repository" }));
    expect(await first).toEqual({ status: "transport_error" });
    expect(await second).toEqual({ status: "transport_error" });
    expect(protocol.version).toBe("1");
  });

  it.each([
    ["a lost answer", () => new TypeError("offline")],
    ["a 503", () => json(503, { status: "unavailable", stage: "repository" })],
    ["a 403 from the origin check", () => json(403, { status: "forbidden" })],
  ])("%s to the first 2 settles nothing: the waiting send asks under 2 itself, one at a time", async (_, unsettled) => {
    const protocol = createCommitProtocol();
    const server = held();
    const first = commitEvidence(INPUT, server.fetchImpl, protocol);
    const second = commitEvidence(OTHER_WORK, server.fetchImpl, protocol);
    await server.sent(1);
    server.answer(unsettled());
    await first;
    await server.sent(2);
    server.answer(upgrade());
    await server.sent(3);
    server.answer(json(503, { status: "unavailable", stage: "repository" }));
    expect(await second).toEqual({ status: "transport_error" });
    expect(protocolsOf(server.calls)).toEqual(["2", "2", "1"]);
  });

  it("once the server has answered 2, sends of the tab go out side by side under 2", async () => {
    const protocol = createCommitProtocol();
    const server = held();
    const opening = commitEvidence(INPUT, server.fetchImpl, protocol);
    await server.sent(1);
    server.answer(pending("committed", BASE.revision));
    expect(await opening).toMatchObject({ receipt: { status: "pending_signature" } });
    const first = commitEvidence(INPUT, server.fetchImpl, protocol);
    const second = commitEvidence(OTHER_WORK, server.fetchImpl, protocol);
    await server.sent(3);
    expect(protocolsOf(server.calls)).toEqual(["2", "2", "2"]);
    server.answer(pending("duplicate", BASE.revision));
    server.answer(pending("committed", BASE.revision));
    expect(await first).toMatchObject({ status: "duplicate" });
    expect(await second).toMatchObject({ status: "committed" });
  });

  it("the open route stays on protocol 1", async () => {
    const { calls, fetchImpl } = scripted(json(200, openBody()));
    await openWork(ASSIGNMENT, fetchImpl);
    expect(protocolsOf(calls)).toEqual(["1"]);
  });
});

describe("F-8 3c: the open route", () => {
  it("reads the work, its snapshot bytes and the domain of its receipt keys", async () => {
    const { calls, fetchImpl } = scripted(json(200, openBody()));
    const opened = await openWork(ASSIGNMENT, fetchImpl);
    expect(opened).toMatchObject({ status: "opened", work: { documentId: DOC, evidenceDomainId: DOMAIN, document: SNAPSHOT } });
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ assignmentId: ASSIGNMENT });
  });

  // DAN-331 (F-137): start goes on the wire only when the caller asks for it.
  it.each([
    [undefined, { assignmentId: ASSIGNMENT }],
    [{}, { assignmentId: ASSIGNMENT }],
    [{ start: false }, { assignmentId: ASSIGNMENT }],
    [{ start: true }, { assignmentId: ASSIGNMENT, start: true }],
  ] as const)("with options %j sends %j", async (options, sent) => {
    const { calls, fetchImpl } = scripted(json(200, openBody()));
    await openWork(ASSIGNMENT, fetchImpl, options);
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual(sent);
  });

  it.each([
    ["an unknown key", openBody({ package: "x" })],
    ["a missing key", Object.fromEntries(Object.entries(openBody()).filter(([key]) => key !== "headSegmentHash"))],
    ["no receipt key", openBody({ receiptKeys: [] })],
    ["keys of two domains", openBody({ receiptKeys: [trusted.key, { ...trusted.key, keyId: "k2", evidenceDomainId: "druga" }] })],
    ["a checkpoint key", openBody({ receiptKeys: [{ ...trusted.key, purpose: "checkpoint" }] })],
    ["a snapshot in a second spelling", openBody({ document: "QR==" })],
    ["a fractional revision", openBody({ currentRevision: 1.5 })],
    ["a short hash", openBody({ documentHash: "a" })],
    // #733: the profile rule of the journal and segment v2.
    ["a profile of only spaces", openBody({ evidenceProfileId: "   " })],
    ["a profile of 121 UTF-16 units", openBody({ evidenceProfileId: "p".repeat(121) })],
    ["a profile with a lone surrogate", openBody({ evidenceProfileId: "profil-\uD83D" })],
    // DAN-289 O2: never submitted: false by assumption.
    ["no submitted", Object.fromEntries(Object.entries(openBody()).filter(([key]) => key !== "submitted"))],
    ["submitted as a string", openBody({ submitted: "false" })],
    ["submitted as a number", openBody({ submitted: 0 })],
    ["submitted as null", openBody({ submitted: null })],
    ["submitted with an extra key", openBody({ submittedAt: "2026-10-25T10:00:00.000Z" })],
  ])("refuses %s", (_name, body) => {
    expect(openedWorkFrom(body)).toBeNull();
  });

  it.each([true, false])("reads submitted as the server says it (%s)", (submitted) => {
    expect(openedWorkFrom(openBody({ submitted }))?.submitted).toBe(submitted);
  });

  it("an answer of a server without submitted is unavailable at open (DAN-289 O2)", async () => {
    const old = Object.fromEntries(Object.entries(openBody()).filter(([key]) => key !== "submitted"));
    expect(await openWork(ASSIGNMENT, scripted(json(200, old)).fetchImpl))
      .toEqual({ status: "unavailable" });
  });

  it("a profile of 60 characters outside the BMP (120 units) is read (#733)", () => {
    expect(openedWorkFrom(openBody({ evidenceProfileId: "\u{1F4D6}".repeat(60) }))?.evidenceProfileId)
      .toBe("\u{1F4D6}".repeat(60));
  });

  it("an answer with a refused profile is unavailable at open (#733)", async () => {
    const { fetchImpl } = scripted(json(200, openBody({ evidenceProfileId: "   " })));
    expect(await openWork(ASSIGNMENT, fetchImpl)).toEqual({ status: "unavailable" });
  });

  it.each([
    [401, { status: "unauthenticated" }, "unauthenticated"],
    [404, { status: "not_found" }, "not_found"],
    [409, { status: "not_accepting" }, "not_accepting"],
    [409, { status: "not_started" }, "unavailable"],
    [426, { status: "upgrade_required" }, "upgrade_required"],
    [503, { status: "unavailable", stage: "context" }, "unavailable"],
    [200, { status: "opened" }, "unavailable"],
  ])("HTTP %i → %s", async (http, body, status) => {
    expect(await openWork(ASSIGNMENT, scripted(json(http, body)).fetchImpl)).toEqual({ status });
  });

  it("no network is unavailable", async () => {
    expect(await openWork(ASSIGNMENT, scripted(new TypeError("offline")).fetchImpl)).toEqual({ status: "unavailable" });
  });
});

describe("F-8 3c: the receipt verifier (plan #178 attack 1)", () => {
  const work = { evidenceDomainId: DOMAIN, receiptKeys: [trusted.key] };
  const verify = createReceiptVerifier(work, (txid) => (txid === BASE.clientTransactionId ? SEGMENT_HASH : null));
  const expected = { documentId: DOC, clientTransactionId: BASE.clientTransactionId, revision: BASE.revision };

  it("accepts a receipt of a key from the open route for the sent segment", async () => {
    expect(await verify(trusted.sign({}), expected)).toBe(true);
  });

  it.each([
    ["another document", { documentId: "dokument-drugi" }],
    ["another transaction", { clientTransactionId: "tx-drugi" }],
    ["another revision", { revision: BASE.revision + 1 }],
    ["another segment", { segmentHash: "c".repeat(64) }],
    ["another domain", { evidenceDomainId: "domena-druga" }],
  ])("refuses a validly signed receipt for %s", async (_name, over) => {
    expect(await verify(trusted.sign(over as Partial<EvidenceReceiptPayloadV2>), expected)).toBe(false);
  });

  it("refuses a key the receipt brings, a revoked key and an unknown transaction", async () => {
    const stranger = receiptKey("kljuc-izmisljeni-2");
    expect(await verify(stranger.sign({}), expected)).toBe(false);
    const revoked = receiptKey("kljuc-izmisljeni-3", { revokedAt: "2026-02-01T00:00:00.000Z" });
    const withRevoked = createReceiptVerifier({ evidenceDomainId: DOMAIN, receiptKeys: [revoked.key] }, () => SEGMENT_HASH);
    expect(await withRevoked(revoked.sign({}), expected)).toBe(false);
    const forgetful = createReceiptVerifier(work, () => null);
    expect(await forgetful(trusted.sign({}), expected)).toBe(false);
    const throwing = createReceiptVerifier(work, () => {
      throw new Error("x");
    });
    expect(await throwing(trusted.sign({}), expected)).toBe(false);
  });
});

describe("WEB-38: both routes through createApi and the contract", () => {
  it("an assignment id the contract refuses is unavailable and never sent", async () => {
    const { calls, fetchImpl } = scripted();
    expect(await openWork("zadatak-izmisljeni", fetchImpl)).toEqual({ status: "unavailable" });
    expect(calls).toEqual([]);
  });

  it("a commit the contract refuses is never sent, holds the row and settles no protocol", async () => {
    const protocol = createCommitProtocol();
    const { calls, fetchImpl } = scripted();
    expect(await commitEvidence({ ...INPUT, baseRevision: 2 ** 53 }, fetchImpl, protocol)).toEqual({ status: "invalid" });
    expect(calls).toEqual([]);
    expect(protocol).toMatchObject({ version: "2", agreed: false, probe: null });
  });

  it("a signed answer with a field the contract does not name is never read, so never SYNCED", async () => {
    const signed = { status: "committed", revision: BASE.revision, receipt: { status: "signed", signedReceipt: trusted.sign({}) } };
    const { fetchImpl } = scripted(json(200, { ...signed, extra: true }));
    expect(await commitEvidence(INPUT, fetchImpl)).toEqual({ status: "invalid" });
  });

  it("a refusal whose body the contract does not declare is not that refusal", async () => {
    const { fetchImpl } = scripted(json(409, { status: "txid_reused", extra: 1 }), json(426, { status: "upgrade_required", extra: 1 }));
    expect(await commitEvidence(INPUT, fetchImpl)).toEqual({ status: "invalid" });
    expect(await openWork(ASSIGNMENT, fetchImpl)).toEqual({ status: "upgrade_required" });
  });

  it("an answer declared JSON that is not JSON holds the row and settles nothing", async () => {
    const protocol = createCommitProtocol();
    const broken = new Response("{", { status: 200, headers: { "content-type": "application/json" } });
    const { calls, fetchImpl } = scripted(broken, pending("committed", BASE.revision));
    expect(await commitEvidence(INPUT, fetchImpl, protocol)).toEqual({ status: "invalid" });
    expect(protocol).toMatchObject({ version: "2", agreed: false });
    expect(await commitEvidence(INPUT, fetchImpl, protocol)).toMatchObject({ receipt: { status: "pending_signature" } });
    expect(protocol.agreed).toBe(true);
    expect(protocolsOf(calls)).toEqual(["2", "2"]);
  });

  // WEB-ER (Ductus#2028 c.7020060555): a 5xx stays a 5xx when its JSON cannot be read.
  it("a 5xx declared JSON that is not JSON holds the row and the same key goes out again", async () => {
    const protocol = createCommitProtocol();
    const broken = (status: number) => new Response("{", { status, headers: { "content-type": "application/json" } });
    const { calls, fetchImpl } = scripted(broken(500), broken(503), committed("committed", BASE.revision, trusted.sign({})));
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const outcome = await commitEvidence(INPUT, fetchImpl, protocol);
      expect(outcome).toEqual({ status: "transport_error" });
      expect(isRetryable(outcome)).toBe(true);
      expect(ackedRevision(outcome)).toBeNull();
      expect(protocol).toMatchObject({ version: "2", agreed: false, probe: null });
    }
    expect(await commitEvidence(INPUT, fetchImpl, protocol)).toMatchObject({ status: "committed", revision: BASE.revision });
    expect(protocolsOf(calls)).toEqual(["2", "2", "2"]);
    const keys = calls.map(({ init }) => JSON.parse(init.body as string).clientTransactionId);
    expect(keys).toEqual([INPUT.clientTransactionId, INPUT.clientTransactionId, INPUT.clientTransactionId]);
    expect(calls[1]!.init.body).toBe(calls[0]!.init.body);
    expect(calls[2]!.init.body).toBe(calls[0]!.init.body);
  });

  it("an unreadable success still confirms nothing, and an unreadable 4xx is not retried by itself", async () => {
    const broken = (status: number) => new Response("{", { status, headers: { "content-type": "application/json" } });
    for (const status of [200, 202, 409, 422]) {
      const outcome = await commitEvidence(INPUT, scripted(broken(status)).fetchImpl);
      expect(outcome).toEqual({ status: "invalid" });
      expect(isRetryable(outcome)).toBe(false);
      expect(ackedRevision(outcome)).toBeNull();
    }
    expect(await openWork(ASSIGNMENT, scripted(broken(503)).fetchImpl)).toEqual({ status: "unavailable" });
  });

  it("without a transport of its own goes out through the browser's, under the same rules", async () => {
    const browser = vi.fn<typeof globalThis.fetch>(async () => json(426, { status: "upgrade_required" }));
    vi.stubGlobal("fetch", browser);
    try {
      expect(await openWork(ASSIGNMENT)).toEqual({ status: "upgrade_required" });
      expect(String(browser.mock.calls[0]?.[0])).toBe(`${ORIGIN}/api/v1/evidence/open`);
      expect(new Headers(browser.mock.calls[0]?.[1]?.headers).get("ductus-protocol")).toBe("1");
    } finally {
      vi.unstubAllGlobals();
      vi.stubGlobal("location", { origin: ORIGIN });
    }
  });
});
