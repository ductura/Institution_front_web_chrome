import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../scripts/forbidden-terms/terms.ts";

import { signInText, signInTextFor } from "./text";

describe("P-15 sign-in texts", () => {
  it("name the faculty administrator as the one who gives a role (A-5)", () => {
    expect(signInText.hr.noRoleWho).toBe("Ulogu dodjeljuje administrator fakulteta.");
    expect(signInText.hr.noRoleContact).toContain("administratoru fakulteta");
    expect(signInText.hr.refusedContact).toContain("administratoru fakulteta");
  });
  it("say a refusal is not a fault and claim no cause (N-19)", () => {
    expect(signInText.hr.refusedBody).toContain("To nije kvar prijave");
    expect(signInText.hr.refusedTitle).toBe("Prijava je odbijena");
  });
  it("have every key in English, and Croatian for any other language", () => {
    expect(Object.keys(signInText.en).sort()).toEqual(Object.keys(signInText.hr).sort());
    expect(signInTextFor("en")).toBe(signInText.en);
    expect(signInTextFor("hr")).toBe(signInText.hr);
    expect(signInTextFor("de")).toBe(signInText.hr);
  });
  it("hold no forbidden term (Ductus PRODUCT §5)", () => {
    for (const text of [...Object.values(signInText.hr), ...Object.values(signInText.en)]) {
      expect(text.trim()).not.toBe("");
      expect(findForbiddenTerms(text)).toEqual([]);
    }
  });
});
