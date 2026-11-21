import { describe, expect, it } from "vitest";

import { parseVerificationCode, readVerificationFields } from "../../components/public-verification/code";

const receiptId = "11111111-2222-4333-8444-555555555555";
const fingerprint = "ab".repeat(32);
const code = `r=${receiptId}&o=${fingerprint}`;

describe("WEB-9C verification code", () => {
  it("reads the receipt and the full fingerprint from a QR or copied code", () => {
    for (const input of [`#${code}`, ` ${code} `, code.replace(fingerprint, fingerprint.toUpperCase())]) {
      expect(parseVerificationCode(input)).toEqual({ receiptId, fingerprint });
    }
  });

  it("reads the two fields printed on the PDF", () => {
    expect(readVerificationFields({ receiptId: ` ${receiptId.toUpperCase()} `, fingerprint })).toEqual({ receiptId, fingerprint });
    expect(readVerificationFields({ receiptId, fingerprint: "" })).toBeNull();
  });

  it.each([
    "", "DUC-1234-5678-9012", `r=${receiptId}`, `o=${fingerprint}`,
    `r=wrong&o=${fingerprint}`, `r=${receiptId}&o=${fingerprint.slice(1)}`,
    `${code}&r=${receiptId}`, `${code}&extra=1`,
    `https://demo.example.invalid/provjera#${code}`,
  ])("rejects an incomplete or ambiguous input (%s)", (input) => {
    expect(parseVerificationCode(input)).toBeNull();
  });
});
