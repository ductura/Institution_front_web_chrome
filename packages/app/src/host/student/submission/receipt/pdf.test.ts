// NF-3 PR-12 (E-11a, PO-43): the receipt's PDF through the shared client. Invented bytes only.
import { describe, expect, it } from "vitest";

import { createApi } from "../../../../../../../src/client/api.ts";
import { receiptPdf } from "./pdf";

const ASSIGNMENT = "00000000-0000-4000-8000-0000000000a1";
// "%PDF-1.7 izmišljeno" in Base64, as the contract's pattern asks (JVBERi0…).
const PDF = btoa("%PDF-1.7 izmisljeno");

function server(status: number, body: unknown) {
  const asked: string[] = [];
  const fetchImpl: typeof fetch = async (input) => {
    asked.push(String(input));
    return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  };
  return { asked, call: createApi({ baseUrl: "https://ductura.example.invalid", fetchImpl }) };
}
const refusal = (status: number, code: string) => ({ error: code, code, messageKey: "errors.x", status, requestId: "00000000-0000-4000-8000-000000000000" });

describe("receiptPdf", () => {
  it("asks student.receipt-pdf.get for the work and gives the decoded PDF with the server's name", async () => {
    const s = server(200, { filename: "potvrda-predaje.pdf", pdfBase64: PDF });
    const outcome = await receiptPdf(s.call, ASSIGNMENT);
    expect(s.asked).toHaveLength(1);
    expect(s.asked[0]).toContain(`/student/assignments/${ASSIGNMENT}/submission/pdf`);
    expect(outcome.kind).toBe("ok");
    if (outcome.kind !== "ok") return;
    expect(outcome.filename).toBe("potvrda-predaje.pdf");
    expect(outcome.blob.type).toBe("application/pdf");
    expect(await outcome.blob.text()).toBe("%PDF-1.7 izmisljeno");
  });

  it("a 401 signs in again; every other failure is one and the same", async () => {
    expect(await receiptPdf(server(401, refusal(401, "unauthorized")).call, ASSIGNMENT)).toEqual({ kind: "signedOut" });
    for (const [status, code] of [[403, "forbidden"], [404, "not_found"], [503, "unavailable"]] as const) {
      expect(await receiptPdf(server(status, refusal(status, code)).call, ASSIGNMENT), code).toEqual({ kind: "failed" });
    }
    // A body outside the contract is not saved as a PDF.
    expect(await receiptPdf(server(200, { filename: "x.pdf", pdfBase64: "nije pdf" }).call, ASSIGNMENT)).toEqual({ kind: "failed" });
  });

  it("a broken connection is a failure, never an exception", async () => {
    const call = createApi({ baseUrl: "https://ductura.example.invalid", fetchImpl: async () => { throw new TypeError("offline"); } });
    expect(await receiptPdf(call, ASSIGNMENT)).toEqual({ kind: "failed" });
  });
});
