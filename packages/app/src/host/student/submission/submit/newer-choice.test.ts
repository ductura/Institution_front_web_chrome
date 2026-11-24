// NF-3 PR-10: the version chosen on step 3 is taken once, and only for the same confirmed revision.
import { describe, expect, it } from "vitest";

import { rememberChoice, takeChoice } from "./newer-choice";

const A = "00000000-0000-4000-8000-0000000000a1";
const V3 = { documentId: "izmisljeni-dokument-1", revision: 3 };

describe("newer-choice (PR-10)", () => {
  it("gives the choice for the same revision once", () => {
    rememberChoice(A, V3, "latest");
    expect(takeChoice(A, V3)).toBe("latest");
    expect(takeChoice(A, V3)).toBeNull();
  });

  it("a choice for another revision, document or work is no choice, and is dropped", () => {
    for (const other of [[A, { ...V3, revision: 4 }], [A, { ...V3, documentId: "drugi" }], ["00000000-0000-4000-8000-0000000000a2", V3]] as const) {
      rememberChoice(A, V3, "confirmed");
      expect(takeChoice(other[0], other[1])).toBeNull();
      expect(takeChoice(A, V3)).toBeNull();
    }
  });
});
