import { describe, expect, it } from "vitest";

import { receiptPdfOutcome, runReceiptPdfDownload } from "./receipt-pdf";

// WEB-9E (S: PO-21). Invented identifiers only.
const pdf = (status = 200, type = "application/pdf", body = "%PDF-1.7 izmisljeno") =>
  new Response(body, { status, headers: { "content-type": type } });

describe("receipt PDF client", () => {
  it("maps every answer onto one outcome", async () => {
    expect((await receiptPdfOutcome(pdf())).kind).toBe("ok");
    expect((await receiptPdfOutcome(pdf(404))).kind).toBe("notFound");
    expect((await receiptPdfOutcome(pdf(401))).kind).toBe("signedOut");
    expect((await receiptPdfOutcome(pdf(503))).kind).toBe("unavailable");
    expect((await receiptPdfOutcome(pdf(200, "text/html"))).kind).toBe("unavailable");
    expect((await receiptPdfOutcome(pdf(200, "application/pdf", ""))).kind).toBe("unavailable");
  });

  it("saves only a received file and reports the rest", async () => {
    const saved: Blob[] = [];
    const blob = new Blob(["x"]);
    expect(await runReceiptPdfDownload(async () => ({ kind: "ok", blob }), (b) => saved.push(b))).toBe("idle");
    expect(saved).toEqual([blob]);
    expect(await runReceiptPdfDownload(async () => ({ kind: "notFound" }), (b) => saved.push(b))).toBe("notFound");
    expect(await runReceiptPdfDownload(async () => ({ kind: "unavailable" }), (b) => saved.push(b))).toBe("failed");
    expect(await runReceiptPdfDownload(async () => ({ kind: "ok", blob }), () => { throw new Error("x"); })).toBe("failed");
    expect(saved).toHaveLength(1);
  });
});
