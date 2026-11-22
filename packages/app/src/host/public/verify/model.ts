import { parseVerificationCode, readVerificationFields, type VerificationCode } from "@/components/public-verification/code";
import type { VerificationState } from "@/components/public-verification/VerificationForm";
import type { VerificationResult } from "@/components/public-verification/verify-receipt";

// WEB-2111 (R-41, V-5, C-6): the public check of a receipt, /provjera, in the host.
// Pure functions; VerifyPage does the effects.

/** The route of the page, without the base. */
export const VERIFY_PATH = "/provjera";

export const EMPTY_CODE: VerificationCode = { receiptId: "", fingerprint: "" };

/**
 * The link to the check of one receipt: the QR fragment `#r=<receipt>&o=<fingerprint>`
 * fills the form and checks at once. The fragment never reaches a server. Without a
 * valid pair the plain page, where the code is typed in.
 */
export function verifyHref(page: string, receiptId: string, fingerprint: string): string {
  const code = readVerificationFields({ receiptId, fingerprint });
  return code === null ? page : `${page}#${new URLSearchParams({ r: code.receiptId, o: code.fingerprint }).toString()}`;
}

/**
 * What a location fragment asks for: nothing for none and for the skip link's
 * "#sadrzaj"; else the code it carries, or null when it is not a valid code.
 */
export function fragmentCode(hash: string): { readonly code: VerificationCode | null } | null {
  if (hash === "" || hash === "#" || hash === "#sadrzaj") return null;
  return { code: parseVerificationCode(hash) };
}

/**
 * The code the form sends: the two fields, or, when only the first is filled,
 * the text of the QR code pasted there ("r=…&o=…"). Null when it is not valid.
 */
export function formCode(code: VerificationCode): VerificationCode | null {
  return code.fingerprint.trim() === "" ? parseVerificationCode(code.receiptId) : readVerificationFields(code);
}

export type Verify = (code: VerificationCode) => Promise<VerificationResult>;

/** One check: "invalid" without asking the server, else what the server answers. */
export async function runCheck(code: VerificationCode | null, verify: Verify): Promise<VerificationState> {
  if (code === null) return { kind: "invalid" };
  try {
    return await verify(code);
  } catch {
    return { kind: "unavailable" };
  }
}
