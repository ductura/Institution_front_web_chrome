import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ReceiptPanel } from "./ReceiptPage";
import { receiptView } from "./model";
import { n07Messages as text } from "./messages.hr";

// Invented receipt of an invented work.
const SHA = "fedcba9876543210".repeat(4);
const view = receiptView({
  kind: "ready", state: "predano", studentName: "Iva Izmišljena",
  submission: { kind: "potvrdeno", receipt: { payload: {
    receiptSchema: "ductus-submission-receipt-v2", submissionId: "00000000-0000-4000-8000-0000000000c7", evidenceDomainId: "d",
    principalId: "p", assignmentId: "a", assignmentVersion: 1, documentId: "doc", evidencePackageId: "e", revision: 1,
    artifactSha256: SHA, evidenceHeadSegmentHash: "h", evidenceRecord: "with_gaps", requestedAt: "2026-11-05T20:14:07.482Z",
    dueAt: "2026-11-05T22:59:59.000Z", afterDeadline: false, signedAt: "2026-11-05T20:14:09.106Z",
  }, payloadDigestSha256: "x", signature: { algorithm: "Ed25519", keyId: "k", keyVersion: "1", signatureEncoding: "raw", signatureBase64Url: "s" } } },
});
const html = (v: Parameters<typeof ReceiptPanel>[0]["view"]) =>
  renderToStaticMarkup(<ReceiptPanel view={v} onRetry={() => {}} onCopy={() => {}} verifyHref={(p) => `/app/web${p}`} />);

describe("N-07 receipt panel", () => {
  it("puno shows the prototype's parts: title, UTC details, fingerprint, record, check link and QR sample", () => {
    const out = html(view);
    for (const part of ["Predano 5. 11. 2026. u 21:14", text.utc, text.fingerprintTitle, text.copy, "Zapis ima praznine.",
      text.recordKept, text.verifyNote, text.verifyLink, text.qrNote]) expect(out).toContain(part);
    expect(out).toContain(`href="/app/web/provjera#r=00000000-0000-4000-8000-0000000000c7&amp;o=${SHA}"`);
    expect(out).toContain('aria-hidden="true"');
  });
  it("loading, error and prazno use the prototype's words", () => {
    expect(html({ kind: "loading" })).toContain(text.loading);
    expect(html({ kind: "error" })).toContain(text.error);
    expect(html({ kind: "error" })).toContain(`>${text.retry}<`);
    expect(html({ kind: "notSubmitted", body: text.notSubmitted("U pisanju") })).toContain("Ovaj rad nije predan, pa potvrde nema. U pisanju.");
  });
  it("ceka offers a fresh read", () => {
    const out = html({ kind: "pending", title: text.pendingTitle, body: "b", rows: [] });
    expect(out).toContain(text.pendingTitle);
    expect(out).toContain(text.check);
  });
});
