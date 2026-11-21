import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { SubmissionReceipt } from "@/client/submission";
import { messagesHr } from "@/lib/i18n/messages.hr";

import { ReceiptPanel, studentReceiptRead, type ReceiptRead } from "./ReceiptPanel";

// WEB-27 (S: E-11). Invented identifiers, times and digests only.
const t = messagesHr.receipt;
const DIGEST = "0123456789abcdef".repeat(4);
const PAYLOAD: SubmissionReceipt["payload"] = {
  receiptSchema: "ductus-submission-receipt-v2",
  submissionId: "11111111-1111-4111-8111-111111111111",
  evidenceDomainId: "22222222-2222-4222-8222-222222222222",
  principalId: "33333333-3333-4333-8333-333333333333",
  assignmentId: "44444444-4444-4444-8444-444444444444",
  assignmentVersion: 2,
  documentId: "doc-izmisljeni-1",
  evidencePackageId: "pkg-izmisljeni-1",
  revision: 7,
  artifactSha256: DIGEST,
  evidenceHeadSegmentHash: "f".repeat(64),
  evidenceRecord: "continuous",
  requestedAt: "2026-11-19T13:05:00.000000Z",
  dueAt: "2026-11-20T22:59:00.000000Z",
  afterDeadline: false,
  signedAt: "2026-11-19T13:05:01.000000Z",
};
const receipt = (over: Partial<SubmissionReceipt["payload"]> = {}): SubmissionReceipt => ({
  payload: { ...PAYLOAD, ...over },
  payloadDigestSha256: "e".repeat(64),
  signature: { algorithm: "Ed25519", keyId: "kljuc-izmisljeni", keyVersion: "1", signatureEncoding: "raw", signatureBase64Url: "A".repeat(86) },
});

const render = (read: ReceiptRead) => renderToStaticMarkup(
  <ReceiptPanel read={read} retryHref="/rad/x/predaja/potvrda" summaryHref="/rad/x/predaja/pregled" submitHref="/rad/x/predaja" />,
);
const text = (markup: string) => markup.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ");
const SAYS_SUBMITTED = /\bPredano\b|Rad je predan/;

describe("ReceiptPanel (WEB-27, S: E-11)", () => {
  it("variant puno: three rows in Zagreb time, one UTC block with the exact values, and the fingerprint", () => {
    const markup = render({ kind: "potvrdeno", receipt: receipt() });
    const shown = text(markup);
    expect(shown).toContain("Predano");
    expect(shown).toContain(`${t.submittedAt} 19. studenoga 2026. u 14:05`);
    expect(shown).toContain(`${t.dueAt} 20. studenoga 2026. u 23:59`);
    expect(shown).toContain(`${t.signingStarted} 19. studenoga 2026. u 14:05`);
    expect(markup.match(/<details/g)).toHaveLength(1);
    expect(markup).toMatch(new RegExp(`<summary[^>]*>${t.utc.replace(/[()]/g, "\\$&")}</summary>`));
    for (const iso of [PAYLOAD.requestedAt, PAYLOAD.dueAt, PAYLOAD.signedAt]) expect(markup).toContain(`<code>${iso}</code>`);
    expect(shown).not.toContain("Potvrda potpisana");
    expect(shown).toContain(`${t.assignmentVersion} 2`);
    expect(shown).toContain(`${t.revision} 7`);
    expect(shown).toContain(t.records.continuous);
    expect(markup).toContain(`<span>${DIGEST.slice(0, 4)}</span>`);
    expect(markup.match(/<code[^>]*>(<span>[0-9a-f]{4}<\/span>){16}<\/code>/)).not.toBeNull();
    expect(shown).toContain("Otisak u međuspremnik");
    expect(shown).toContain(t.fingerprintNote);
    expect(markup).toContain(`href="/rad/x/predaja/pregled">${t.summary}`);
    expect(shown).toContain(t.signatureNote);
    expect(shown).not.toContain(t.late);
  });

  it("variant nakonroka says after the deadline beside predano", () => {
    const shown = text(render({ kind: "potvrdeno", receipt: receipt({ afterDeadline: true, requestedAt: "2026-11-21T08:00:00.000000Z" }) }));
    expect(shown).toContain("Nakon roka");
    expect(shown).toContain(t.late);
    expect(shown).toContain(`${t.submittedAt} 21. studenoga 2026. u 09:00`);
  });

  it("variant praznine marks the gaps as a fact that does not undo the submission", () => {
    const shown = text(render({ kind: "potvrdeno", receipt: receipt({ evidenceRecord: "with_gaps" }) }));
    expect(shown).toContain("Predano");
    expect(shown).toContain("Praznina u zapisu");
    expect(shown).toContain(t.records.with_gaps);
    expect(shown).not.toContain(t.records.continuous);
  });

  it("variant ceka never says predano and offers a fresh read", () => {
    const markup = render({ kind: "ceka", revision: 7, requestedAt: PAYLOAD.requestedAt });
    const shown = text(markup);
    expect(shown).not.toMatch(SAYS_SUBMITTED);
    expect(markup).toContain(`<h2>${t.pendingTitle}</h2>`);
    expect(shown).toContain("Čeka potvrdu");
    expect(shown).toContain("Predaja je zabilježena 19. studenoga 2026. u 14:05. Potpis potvrde još se izdaje; vrijeme predaje se time ne mijenja.");
    expect(shown).toContain(`${t.signingStarted} ${t.notYetRecorded}`);
    expect(markup).toContain(`<code>${PAYLOAD.requestedAt}</code>`);
    expect(markup).toContain(`href="/rad/x/predaja/potvrda">${t.check}`);
    expect(markup).not.toContain("Otisak u međuspremnik");
  });

  it("variants prazno, ucitavanje and greska show no receipt and never say predano", () => {
    const empty = render({ kind: "none" });
    expect(empty).toContain(t.empty);
    expect(empty).toContain(`href="/rad/x/predaja">${t.toSubmit}`);
    expect(render({ kind: "loading" })).toContain(`<p role="status">${t.loading}</p>`);
    const error = render({ kind: "error" });
    expect(error).toContain(`<p role="alert">${t.error}</p>`);
    expect(error).toContain(`href="/rad/x/predaja/potvrda">${t.retry}`);
    for (const markup of [empty, render({ kind: "loading" }), error]) {
      expect(text(markup)).not.toMatch(SAYS_SUBMITTED);
      expect(markup).not.toContain(DIGEST.slice(0, 4));
    }
  });

  it("a reader who cannot submit gets no link to the submission", () => {
    expect(renderToStaticMarkup(<ReceiptPanel read={{ kind: "none" }} retryHref="/x" />)).not.toContain("<a ");
  });
});

describe("studentReceiptRead (WEB-27)", () => {
  const signed = { kind: "potvrdeno", receipt: receipt() } as const;

  it("shows a receipt or a pending signature as read", () => {
    expect(studentReceiptRead(signed, "submitted")).toEqual(signed);
    expect(studentReceiptRead({ kind: "ceka", revision: 7, requestedAt: PAYLOAD.requestedAt }, "in_progress"))
      .toEqual({ kind: "ceka", revision: 7, requestedAt: PAYLOAD.requestedAt });
  });

  it("a submitted work without a readable receipt is an error, never prazno", () => {
    for (const read of [{ kind: "nepoznato" }, { kind: "none" }, { kind: "greska", code: "not_found" }] as const) {
      expect(studentReceiptRead(read, "submitted")).toEqual({ kind: "error" });
      expect(studentReceiptRead(read, null).kind).not.toBe("potvrdeno");
    }
    expect(studentReceiptRead({ kind: "nepoznato" }, null)).toEqual({ kind: "error" });
  });

  it("a work that is not submitted has no receipt (prazno)", () => {
    expect(studentReceiptRead({ kind: "none" }, "in_progress")).toEqual({ kind: "none" });
    expect(studentReceiptRead({ kind: "nepoznato" }, "not_started")).toEqual({ kind: "none" });
  });
});
