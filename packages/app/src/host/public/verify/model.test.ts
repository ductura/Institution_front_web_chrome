import { describe, expect, it } from "vitest";

import { publicVerificationHr } from "@/components/public-verification/messages.hr";

import { EMPTY_CODE, formCode, fragmentCode, runCheck, verifyHref, VERIFY_PATH } from "./model";

// Invented values: a receipt number and a fingerprint of no real work.
const ID = "0f0e0d0c-0b0a-4909-8807-060504030201";
const FP = "ab".repeat(32);
const CODE = { receiptId: ID, fingerprint: FP };

describe("verifyHref", () => {
  it("carries a valid pair in the fragment, lower-cased", () => {
    expect(verifyHref("/app/web/provjera", ID.toUpperCase(), FP.toUpperCase())).toBe(`/app/web/provjera#r=${ID}&o=${FP}`);
  });
  it("leads to the plain page without a valid pair", () => {
    expect(verifyHref("/app/web/provjera", "", FP)).toBe("/app/web/provjera");
    expect(verifyHref("/app/web/provjera", ID, "abc")).toBe("/app/web/provjera");
  });
  it("is the page's route", () => {
    expect(VERIFY_PATH).toBe("/provjera");
  });
});

describe("fragmentCode", () => {
  it("asks nothing for no fragment and for the skip link", () => {
    for (const hash of ["", "#", "#sadrzaj"]) expect(fragmentCode(hash)).toBeNull();
  });
  it("reads the QR fragment", () => {
    expect(fragmentCode(`#r=${ID}&o=${FP}`)).toEqual({ code: CODE });
  });
  it("asks for an invalid code when the fragment is not one", () => {
    expect(fragmentCode("#r=nesto&o=drugo")).toEqual({ code: null });
    expect(fragmentCode(`#r=${ID}&o=${FP}&x=1`)).toEqual({ code: null });
  });
});

describe("formCode", () => {
  it("reads the two fields, trimmed", () => {
    expect(formCode({ receiptId: ` ${ID} `, fingerprint: `${FP}\n` })).toEqual(CODE);
  });
  it("reads a pasted QR text from the first field alone", () => {
    expect(formCode({ receiptId: `r=${ID}&o=${FP}`, fingerprint: "" })).toEqual(CODE);
  });
  it("refuses anything else", () => {
    expect(formCode(EMPTY_CODE)).toBeNull();
    expect(formCode({ receiptId: ID, fingerprint: "ab" })).toBeNull();
  });
});

describe("runCheck", () => {
  it("is invalid without asking the server", async () => {
    let asked = false;
    const state = await runCheck(null, async () => {
      asked = true;
      return { kind: "notMatched" };
    });
    expect(state).toEqual({ kind: "invalid" });
    expect(asked).toBe(false);
  });
  it("passes on each answer of the server", async () => {
    const matched = { kind: "matched", submittedAt: "2026-11-12T20:15:00.000000Z", signedAt: "2026-11-12T20:15:01.000000Z", keyId: "kljuc-izmisljen-1" } as const;
    for (const answer of [matched, { kind: "notMatched" }, { kind: "rateLimited" }, { kind: "unavailable" }] as const) {
      expect(await runCheck(CODE, async (code) => {
        expect(code).toEqual(CODE);
        return answer;
      })).toEqual(answer);
    }
  });
  it("is unavailable when the check throws", async () => {
    expect(await runCheck(CODE, async () => { throw new Error("mreza"); })).toEqual({ kind: "unavailable" });
  });
  it("has a text for every state the page shows", () => {
    for (const kind of ["invalid", "pending", "matched", "notMatched", "rateLimited", "unavailable"] as const) {
      expect(publicVerificationHr[kind]).toMatch(/\S/);
    }
  });
});
