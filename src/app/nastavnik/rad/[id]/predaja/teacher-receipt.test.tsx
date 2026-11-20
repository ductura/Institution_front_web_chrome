import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { readSubmissionState, type SubmissionReceipt } from "../../../../../client/submission";
import type { TeacherCall } from "../../../../../client/teacher-reads";
import { ReceiptPanel, studentReceiptRead, type ReceiptRead } from "../../../../../components/predaja/ReceiptPanel";

import { loadTeacherReceipt, readTeacherWork, type TeacherWork, type WorkCall } from "./teacher-receipt";

// WEB-35 (N-07). The routes wait for the contract (TODO(ugovor)); every
// answer here is invented: identifiers, names, times and digests.
const DOCUMENT = "doc-izmisljeni-1";
const ASSIGNMENT = "44444444-4444-4444-8444-444444444444";
const STUDENT = "0b6f1c2e-4a5d-4e8f-9a1b-2c3d4e5f6a7b";
const PAYLOAD: SubmissionReceipt["payload"] = {
  receiptSchema: "ductus-submission-receipt-v2",
  submissionId: "11111111-1111-4111-8111-111111111111",
  evidenceDomainId: "22222222-2222-4222-8222-222222222222",
  principalId: "33333333-3333-4333-8333-333333333333",
  assignmentId: ASSIGNMENT,
  assignmentVersion: 2,
  documentId: DOCUMENT,
  evidencePackageId: "pkg-izmisljeni-1",
  revision: 7,
  artifactSha256: "0123456789abcdef".repeat(4),
  evidenceHeadSegmentHash: "f".repeat(64),
  evidenceRecord: "continuous",
  requestedAt: "2026-11-19T13:05:00.000000Z",
  dueAt: "2026-11-20T22:59:00.000000Z",
  afterDeadline: false,
  signedAt: "2026-11-19T13:05:01.000000Z",
};
const RECEIPT: SubmissionReceipt = {
  payload: PAYLOAD,
  payloadDigestSha256: "e".repeat(64),
  signature: { algorithm: "Ed25519", keyId: "kljuc-izmisljeni", keyVersion: "1", signatureEncoding: "raw", signatureBase64Url: "A".repeat(86) },
};
const WORK: TeacherWork = {
  documentId: DOCUMENT, studentId: STUDENT, studentName: "Ana Izmišljena", assignmentId: ASSIGNMENT,
  state: "predano", prevDocumentId: null, nextDocumentId: "doc-izmisljeni-2",
};

type Answer = { ok: true; status: number; body: unknown } | { ok: false; status: number; code: string };
const reply = (status: number, body: unknown): Answer => (status < 400 ? { ok: true, status, body } : { ok: false, status, code: "x" });
const work = (status: number, body: unknown, calls: unknown[] = []): WorkCall => async (...call) => (calls.push(call), reply(status, body));
const receipt = (status: number, body: unknown, calls: unknown[] = []): TeacherCall => async (...call) => (calls.push(call), reply(status, body));
const SIGNED = { state: "potvrdeno", receipt: RECEIPT };

const render = (read: ReceiptRead) => renderToStaticMarkup(<ReceiptPanel read={read} retryHref="/r" summaryHref="/s" />);
const SAYS_SUBMITTED = /\bPredano\b|Rad je predan/;
const readOf = async (w: WorkCall | undefined, r: TeacherCall | undefined) => {
  const view = await loadTeacherReceipt(w, r, DOCUMENT);
  if (view.kind !== "ready") throw new Error(`expected ready, got ${view.kind}`);
  return view.read;
};

describe("WEB-35 teacher receipt (N-07)", () => {
  it("reads the work by its document id, then the receipt of that student for that assignment", async () => {
    const workCalls: unknown[] = [];
    const receiptCalls: unknown[] = [];
    const view = await loadTeacherReceipt(work(200, WORK, workCalls), receipt(200, SIGNED, receiptCalls), DOCUMENT);
    expect(workCalls).toEqual([["teacher.work.get", { params: { documentId: DOCUMENT } }]]);
    expect(receiptCalls).toEqual([["teacher.submission-receipt.get", { params: { assignmentId: ASSIGNMENT, studentId: STUDENT } }]]);
    expect(view).toEqual({ kind: "ready", work: WORK, read: { kind: "potvrdeno", receipt: RECEIPT } });
  });

  it("shows the same panel, word for word, as the student's step 5 (rule 5)", async () => {
    const teacher = render(await readOf(work(200, WORK), receipt(200, SIGNED)));
    const student = render(studentReceiptRead(await readSubmissionState(async () => reply(200, SIGNED), ASSIGNMENT), "submitted"));
    expect(teacher).toBe(student);
    expect(teacher.replace(/<[^>]*>/g, "")).toContain(PAYLOAD.artifactSha256);
    expect(teacher).toMatch(SAYS_SUBMITTED);
  });

  it("without a transport (TODO(ugovor)) shows the error variant, never predano", async () => {
    for (const read of [await readOf(undefined, undefined), await readOf(work(200, WORK), undefined)]) {
      expect(read).toEqual({ kind: "error" });
      expect(render(read)).not.toMatch(SAYS_SUBMITTED);
    }
  });

  it("ceka: recorded but not signed is the pending variant, never predano", async () => {
    const ceka = { state: "ceka", revision: 3, requestedAt: "2026-11-19T13:05:00.000000Z" };
    const read = await readOf(work(200, { ...WORK, state: "ceka" }), receipt(200, ceka));
    expect(read).toEqual({ kind: "ceka", revision: 3, requestedAt: ceka.requestedAt });
    expect(render(read)).not.toMatch(SAYS_SUBMITTED);
  });

  it("nedovrseno: a work not submitted shows that the server holds no receipt", async () => {
    const read = await readOf(work(200, { ...WORK, state: "nije_predano" }), receipt(200, { state: "none" }));
    expect(read).toEqual({ kind: "none" });
    expect(render(read)).not.toMatch(SAYS_SUBMITTED);
  });

  it.each([
    ["no transport", undefined],
    ["a 503", receipt(503, null)],
    ["a malformed answer", receipt(200, { state: "none", extra: 1 })],
    ["a broken connection", (() => Promise.reject(new TypeError("Failed to fetch"))) as TeacherCall],
  ])("a work not submitted whose receipt read fails (%s) is an error, never prazno", async (_name, call) => {
    expect(await readOf(work(200, { ...WORK, state: "nije_predano" }), call)).toEqual({ kind: "error" });
  });

  it.each(["predano", "nakon_roka", "ceka"] as const)("a work %s without a receipt is an error, never prazno", async (state) => {
    expect(await readOf(work(200, { ...WORK, state }), receipt(200, { state: "none" }))).toEqual({ kind: "error" });
  });

  it.each([
    ["a receipt of another work", receipt(200, { state: "potvrdeno", receipt: { ...RECEIPT, payload: { ...PAYLOAD, documentId: "doc-izmisljeni-2" } } })],
    ["a receipt of another assignment", receipt(200, { state: "potvrdeno", receipt: { ...RECEIPT, payload: { ...PAYLOAD, assignmentId: STUDENT } } })],
    ["an unknown field on the receipt", receipt(200, { state: "potvrdeno", receipt: { ...RECEIPT, viewedBy: STUDENT } })],
    ["a receipt without a signature", receipt(200, { state: "potvrdeno", receipt: { ...RECEIPT, signature: null } })],
    ["a 503", receipt(503, null)],
    ["a broken connection", (() => Promise.reject(new TypeError("Failed to fetch"))) as TeacherCall],
  ])("%s is the error variant, never shown", async (_name, call) => {
    const read = await readOf(work(200, WORK), call);
    expect(read).toEqual({ kind: "error" });
    expect(render(read)).not.toMatch(SAYS_SUBMITTED);
  });

  it("signed out on either read goes to sign-in; another teacher's work is 404", async () => {
    expect(await loadTeacherReceipt(work(401, null), receipt(200, SIGNED), DOCUMENT)).toEqual({ kind: "signedOut" });
    expect(await loadTeacherReceipt(work(200, WORK), receipt(401, null), DOCUMENT)).toEqual({ kind: "signedOut" });
    expect(await loadTeacherReceipt(work(404, null), receipt(200, SIGNED), DOCUMENT)).toEqual({ kind: "notFound" });
    expect(await loadTeacherReceipt(work(200, WORK), receipt(404, null), DOCUMENT)).toEqual({ kind: "notFound" });
  });

  it("does not read a receipt when the work cannot be read", async () => {
    const receiptCalls: unknown[] = [];
    expect(await readOf(work(503, null), receipt(200, SIGNED, receiptCalls))).toEqual({ kind: "error" });
    expect(receiptCalls).toEqual([]);
  });

  it.each([
    ["another work than the one asked for", { ...WORK, documentId: "doc-izmisljeni-2" }],
    ["an unknown field", { ...WORK, email: "ana@example.invalid" }],
    ["an unknown state", { ...WORK, state: "spremljeno" }],
    ["an empty name instead of null", { ...WORK, studentName: "" }],
    ["a student id that is not a uuid", { ...WORK, studentId: "demo-student-3" }],
    ["a missing neighbour field", { ...WORK, nextDocumentId: undefined }],
  ])("the work with %s is nepoznato", async (_name, body) => {
    expect(await readTeacherWork(work(200, JSON.parse(JSON.stringify(body))), DOCUMENT)).toEqual({ kind: "nepoznato" });
  });

  it("the work as given, a missing name stays null", async () => {
    const nameless = { ...WORK, studentName: null };
    expect(await readTeacherWork(work(200, nameless), DOCUMENT)).toEqual({ kind: "ready", work: nameless });
    expect(await readTeacherWork(work(201, WORK), DOCUMENT)).toEqual({ kind: "nepoznato" });
    expect(await readTeacherWork(work(403, null), DOCUMENT)).toEqual({ kind: "nepoznato" });
  });
});
