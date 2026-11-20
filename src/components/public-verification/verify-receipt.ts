import type { VerificationCode } from "./code";

export type VerificationResult =
  | { kind: "matched"; submittedAt: string; signedAt: string; keyId: string }
  | { kind: "notMatched" | "unavailable" | "rateLimited" };

// TODO(ugovor) SRV-9B: call public.verification.post through createApi
// with a credential-free transport once W-A imports the server contract.
export async function verifyReceipt(_code: VerificationCode): Promise<VerificationResult> {
  return { kind: "unavailable" };
}
