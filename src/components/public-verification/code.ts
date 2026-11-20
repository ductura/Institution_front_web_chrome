export type VerificationCode = { receiptId: string; fingerprint: string };

const receiptIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const fingerprintPattern = /^[0-9a-f]{64}$/i;

/** A QR fragment and its manually copied form carry the same two values. */
export function parseVerificationCode(value: string): VerificationCode | null {
  const code = value.trim();
  if (code.length > 160) return null;

  const fields = new URLSearchParams(code.replace(/^#/, ""));
  const receiptId = fields.get("r");
  const fingerprint = fields.get("o");
  if (fields.size !== 2 || !receiptId || !fingerprint ||
      !receiptIdPattern.test(receiptId) || !fingerprintPattern.test(fingerprint)) return null;

  return { receiptId: receiptId.toLowerCase(), fingerprint: fingerprint.toLowerCase() };
}
