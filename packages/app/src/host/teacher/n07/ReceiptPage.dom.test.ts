// @vitest-environment jsdom
// F4-NAS-R07 (NAS-38): on N-07 "Zatraži doradu" is the dd-h dialog of RevisionSection, with the mandatory deadline.
// The old ReturnForRevisionDialog (deadline optional) is gone from this page. Invented work and text only.
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ReceiptPdfRead } from "@/client/teacher-submissions";
import { revisionMessages as rev } from "../revision/messages.hr";
import { n07Messages as text } from "./messages.hr";

const SHA = "fedcba9876543210".repeat(4);
const returnStatus = vi.fn(async (..._a: unknown[]) => 200);

vi.mock("@/client/api", async (original) => ({
  ...(await original<Record<string, unknown>>()),
  createApi: () => async () => ({ ok: false, status: 404, code: "not_found" }), goToSignIn: () => {},
}));
vi.mock("@/client/teacher-work", () => ({
  readTeacherWorkReceipt: async () => ({
    kind: "ready", state: "predano", studentName: "Iva Izmišljena",
    submission: { kind: "potvrdeno", receipt: { payload: {
      receiptSchema: "ductus-submission-receipt-v2", submissionId: "00000000-0000-4000-8000-0000000000c7", evidenceDomainId: "d",
      principalId: "p", assignmentId: "a", assignmentVersion: 1, documentId: "doc", evidencePackageId: "e", revision: 1,
      artifactSha256: SHA, evidenceHeadSegmentHash: "h", evidenceRecord: "continuous", requestedAt: "2026-11-05T20:14:07.482Z",
      dueAt: "2026-11-05T22:59:59.000Z", afterDeadline: false, signedAt: "2026-11-05T20:14:09.106Z",
    }, payloadDigestSha256: "x", signature: { algorithm: "Ed25519", keyId: "k", keyVersion: "1", signatureEncoding: "raw", signatureBase64Url: "s" } } },
  }),
}));
vi.mock("@/client/return-for-revision", () => ({ returnStatus: (...a: unknown[]) => returnStatus(...a) }));
vi.mock("@/client/revision-requests", () => ({ listRevisionRequests: async () => ({ kind: "ok", requests: [] }) }));
vi.mock("@/components/teacher/SummaryCard", () => ({ useProcessSummary: () => ({ outcome: null, load: async () => {} }) }));
vi.mock("../n06/read", () => ({ readFrame: async () => ({ kind: "ready", facts: { state: "predano" } }) }));
vi.mock("../ai-declaration/AiDeclarationSection", () => ({ default: () => null }));
vi.mock("../pre-submit/PreSubmitPanel", () => ({ PreSubmitPanel: () => null, FallbackPanel: () => null }));
vi.mock("../../context", () => ({ useHost: () => ({ base: "/app/web" }) }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) { this.setAttribute("open", ""); };
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) { this.removeAttribute("open"); };

let root: Root | null = null;
let host: HTMLElement | null = null;
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; returnStatus.mockClear(); });

async function show(loadPdf?: (id: string) => Promise<ReceiptPdfRead>) {
  const { default: Page } = await import("./ReceiptPage");
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => { root!.render(h(Page, { documentId: "izmisljeni-rad-0001", workHref: "/app/web/nastavnik/rad/izmisljeni-rad-0001", current: () => true, ...(loadPdf ? { loadPdf } : {}) })); });
  await act(async () => {});
}
const button = (label: string) => [...host!.querySelectorAll("button")].find((b) => b.textContent === label) ?? null;

const PDF = new Blob(["%PDF-1.7"], { type: "application/pdf" });
describe("N-07 'Preuzmi PDF potvrde' (NAS-53)", () => {
  it("is offered on a signed receipt and saves the file the server built", async () => {
    const loadPdf = vi.fn(async (_id: string): Promise<ReceiptPdfRead> => ({ kind: "ok", blob: PDF, filename: "potvrda-predaje.pdf" }));
    const create = vi.fn(() => "blob:x");
    URL.createObjectURL = create;
    URL.revokeObjectURL = () => {};
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await show(loadPdf);
    const save = button(text.pdf);
    expect(save).not.toBeNull();
    await act(async () => { save!.click(); });
    expect(loadPdf).toHaveBeenCalledWith("izmisljeni-rad-0001");
    expect(create).toHaveBeenCalledWith(PDF);
    expect(host!.textContent).toContain(text.pdfSaved);
  });
  it("says so honestly when the server refuses (404 for somebody else's work, any other failure)", async () => {
    await show(async () => ({ kind: "notFound" as const }));
    await act(async () => { button(text.pdf)!.click(); });
    expect(host!.textContent).toContain(text.pdfNotFound);
    expect(host!.textContent).not.toContain(text.pdfSaved);
  });
  it("a failed read shows one message and saves nothing", async () => {
    const create = vi.fn(() => "blob:x");
    URL.createObjectURL = create;
    await show(async () => ({ kind: "failed" as const }));
    await act(async () => { button(text.pdf)!.click(); });
    expect(host!.textContent).toContain(text.pdfFailed);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("N-07 revision action (NAS-38)", () => {
  it("opens the dd-h dialog of RevisionSection: mandatory deadline hint, not the old optional one", async () => {
    await show();
    const ask = button(rev.ask);
    expect(ask).not.toBeNull();
    await act(async () => { ask!.click(); });
    const dialog = host!.querySelector("dialog");
    expect(dialog?.textContent).toContain(rev.explain);
    expect(dialog?.textContent).toContain(rev.dueHint);
    expect(dialog?.textContent).not.toContain("bez roka");
  });
  it("sends nothing while the instruction or the deadline is missing", async () => {
    await show();
    await act(async () => { button(rev.ask)!.click(); });
    await act(async () => { button(rev.send)!.click(); });
    expect(returnStatus).not.toHaveBeenCalled();
    expect(host!.querySelector("dialog")?.hasAttribute("open")).toBe(true);
  });
  it("keeps the other receipt buttons", async () => {
    await show();
    expect(host!.textContent).toContain(text.fastPath);
  });
});
