import { browserTransport, createApi, type ApiOptions } from "../../client/api";

import type { VerificationCode } from "./code";

export type VerificationResult =
  | { kind: "matched"; submittedAt: string; signedAt: string; keyId: string }
  | { kind: "notMatched" | "unavailable" | "rateLimited" };

export async function verifyReceipt(
  code: VerificationCode,
  options: Pick<ApiOptions, "baseUrl" | "fetchImpl"> = {},
): Promise<VerificationResult> {
  const transport = options.fetchImpl ?? browserTransport;
  try {
    const api = createApi({
      baseUrl: options.baseUrl,
      fetchImpl: (input, init) => transport(input, { ...init, credentials: "omit", cache: "no-store" }),
    });
    const result = await api("public.verification.post", {
      params: undefined,
      query: undefined,
      body: { submissionId: code.receiptId, artifactSha256: code.fingerprint },
    });
    if (!result.ok) return { kind: result.status === 429 ? "rateLimited" : "unavailable" };
    if (!result.body.match) return { kind: "notMatched" };
    const { submittedAt, signedAt, keyId } = result.body;
    return { kind: "matched", submittedAt, signedAt, keyId };
  } catch {
    return { kind: "unavailable" };
  }
}
