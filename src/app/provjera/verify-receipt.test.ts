import { describe, expect, it, vi } from "vitest";

import { verifyReceipt } from "../../components/public-verification/verify-receipt";

const baseUrl = "https://ductura.example.invalid";
const code = { receiptId: "00000000-0000-4000-8000-00000000c0de", fingerprint: "ab".repeat(32) };
const metadata = {
  submittedAt: "2026-11-20T10:15:30.123456Z",
  signedAt: "2026-11-20T10:15:31.654321Z",
  keyId: "izmisljeni-kljuc-potvrde",
};

function respond(body: object, status = 200) {
  return vi.fn<typeof fetch>(async () => Response.json(body, { status }));
}

describe("WEB-9C public receipt request", () => {
  it("posts only the number and fingerprint with credentials omitted and redirects disabled", async () => {
    const fetchImpl = respond({ match: true, ...metadata });
    expect(await verifyReceipt(code, { baseUrl, fetchImpl })).toEqual({ kind: "matched", ...metadata });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe(`${baseUrl}/api/v1/public/verification`);
    expect(init).toMatchObject({ method: "POST", credentials: "omit", redirect: "manual", cache: "no-store" });
    const headers = new Headers(init?.headers);
    expect(headers.has("cookie")).toBe(false);
    expect(headers.has("authorization")).toBe(false);
    expect(JSON.parse(String(init?.body))).toEqual({ submissionId: code.receiptId, artifactSha256: code.fingerprint });
  });

  it("does not confirm a receipt when the response reports no match, has extra fields, or is malformed", async () => {
    expect(await verifyReceipt(code, { baseUrl, fetchImpl: respond({ match: false }) })).toEqual({ kind: "notMatched" });
    for (const body of [{ match: true }, { match: true, ...metadata, name: "izmisljeno" }, { match: false, ...metadata }]) {
      expect(await verifyReceipt(code, { baseUrl, fetchImpl: respond(body) })).toEqual({ kind: "unavailable" });
    }
  });

  it("keeps a rate limit distinct and handles refusals and network failures without any login action", async () => {
    const call = (status: number) => verifyReceipt(code, { baseUrl, fetchImpl: respond({}, status) });
    expect(await call(429)).toEqual({ kind: "rateLimited" });
    for (const status of [303, 401, 503]) expect(await call(status)).toEqual({ kind: "unavailable" });
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("offline"));
    expect(await verifyReceipt(code, { baseUrl, fetchImpl })).toEqual({ kind: "unavailable" });
  });
});
