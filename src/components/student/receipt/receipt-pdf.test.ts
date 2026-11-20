import { describe, expect, it } from "vitest";

import { fetchReceiptPdf, receiptPdfPath, runReceiptPdfDownload } from "./receipt-pdf";

// WEB-9E (S: PO-21). Invented identifiers only.
const ID = "44444444-4444-4444-8444-444444444444";
const pdf = (status = 200, type = "application/pdf", body = "%PDF-1.7 izmisljeno") =>
  (async () => new Response(body, { status, headers: { "content-type": type } })) as unknown as typeof fetch;

describe("receipt PDF client", () => {
  it("builds the route of the contract only for a real assignment id", () => {
    expect(receiptPdfPath(ID)).toBe(`/api/v1/student/assignments/${ID}/submission/pdf`);
    expect(receiptPdfPath("../x")).toBeNull();
  });

  it("maps every answer onto one outcome", async () => {
    expect((await fetchReceiptPdf(ID, { fetchImpl: pdf() })).kind).toBe("ok");
    expect((await fetchReceiptPdf(ID, { fetchImpl: pdf(404) })).kind).toBe("notFound");
    expect((await fetchReceiptPdf(ID, { fetchImpl: pdf(401) })).kind).toBe("signedOut");
    expect((await fetchReceiptPdf(ID, { fetchImpl: pdf(503) })).kind).toBe("unavailable");
    expect((await fetchReceiptPdf(ID, { fetchImpl: pdf(200, "text/html") })).kind).toBe("unavailable");
    expect((await fetchReceiptPdf(ID, { fetchImpl: pdf(200, "application/pdf", "") })).kind).toBe("unavailable");
    expect((await fetchReceiptPdf(ID, { fetchImpl: (async () => { throw new Error("mreža"); }) as typeof fetch })).kind).toBe("unavailable");
    expect((await fetchReceiptPdf("nije-id")).kind).toBe("notFound");
  });

  it("saves only a fetched file and reports the rest", async () => {
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
