import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../../scripts/forbidden-terms/terms.ts";
import { conversationsLine, conversationsRow } from "./attached-count";
import { declarationStepText } from "./messages.hr";

// F4-PRE-R02: the count on step 3 and step 4 in the prototype's words; unknown is never "none".
describe("attached conversations on steps 3 and 4 (F4-PRE-R02)", () => {
  it("step 3 says the count, none, or that it is unknown", () => {
    expect(conversationsLine({ total: 3, attached: 1 })).toBe("Razgovora: 3, priloženo: 1. Nastavnik vidi samo priložene razgovore.");
    expect(conversationsLine({ total: 0, attached: 0 })).toBe("Nema razgovora za prilaganje.");
    expect(conversationsLine(null)).toBe("Broj priloženih razgovora trenutačno nije dostupan.");
    expect(conversationsLine("loading")).toBe("Broj priloženih razgovora trenutačno nije dostupan.");
  });

  it("step 4 shows the row only when there are conversations and the count is known", () => {
    expect(conversationsRow({ total: 2, attached: 2 })).toBe("2 priloženo");
    expect(conversationsRow({ total: 0, attached: 0 })).toBeNull();
    expect(conversationsRow(null)).toBeNull();
  });

  it("the new words hold no forbidden term", () => {
    const words = [declarationStepText.attachFailed, declarationStepText.attachStale, declarationStepText.attachUnavailable,
      declarationStepText.chatsUnavailable, declarationStepText.chatUnavailable, declarationStepText.attachedCount];
    for (const text of words) expect({ text, hits: findForbiddenTerms(text) }).toEqual({ text, hits: [] });
  });
});
