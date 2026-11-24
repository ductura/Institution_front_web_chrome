import { describe, expect, it } from "vitest";

import { aiDeclarationMessages } from "../../ai-declaration/messages.hr";
import { matchText } from "../../provenance/match-messages.hr";
import { provenanceText } from "../../provenance/messages.hr";
import { originText } from "../../provenance/origin-messages.hr";
import { teacherAiLabels } from "../ai-attachments/messages.hr";
import { teacherWorkMessages } from "../messages.hr";
import { forbiddenInReview, NEVER } from "./forbidden";
import { reviewMessages } from "./messages.hr";

/** Every text of a table: strings as they are, functions with invented arguments, nested tables flattened. */
function texts(table: Record<string, unknown>): string[] {
  return Object.values(table).flatMap((value): string[] => {
    if (typeof value === "string") return [value];
    if (typeof value === "function") return [String((value as (...a: unknown[]) => unknown)("Kolegij A", "Seminarski rad", "Naslov"))];
    if (value !== null && typeof value === "object") return texts(value as Record<string, unknown>);
    return [];
  });
}

// PG-14 (WEB-NUZ-PG): one pass over the texts of the work review: the new review, the work page, the provenance map,
// the assistant match and the declaration on the teacher's side.
const OWN = {
  review: reviewMessages, work: teacherWorkMessages, provenance: provenanceText, origin: originText,
  match: matchText, declaration: aiDeclarationMessages,
};

describe("PG-14: messages and forbidden terms of the work review", () => {
  it("hold no forbidden term of PRODUCT §5; „dokaz autorstva” only as „nije dokaz autorstva”", () => {
    for (const [name, table] of Object.entries({ ...OWN, aiLabels: teacherAiLabels })) {
      for (const text of texts(table as Record<string, unknown>)) expect([name, text, forbiddenInReview(text)]).toEqual([name, text, []]);
    }
  });

  it("draw no verdict and name no provider or model of the Asistent (Q-10)", () => {
    for (const [name, table] of Object.entries(OWN)) {
      for (const text of texts(table as Record<string, unknown>)) expect([name, text, NEVER.test(text)]).toEqual([name, text, false]);
    }
    expect(aiDeclarationMessages.assistant).toBe("Asistent");
  });

  it("still finds „dokaz autorstva” outside the negation, and every other term", () => {
    expect(forbiddenInReview("Ovo je dokaz autorstva.")).toEqual(["dokaz autorstva"]);
    expect(forbiddenInReview("Sumnjivo lijepljenje")).toEqual(["sumnjivo"]);
    expect(forbiddenInReview("12 % · nije dokaz autorstva")).toEqual([]);
    expect(NEVER.test("Moguće varanje")).toBe(true);
    expect(NEVER.test("Plagijat")).toBe(true);
    expect(NEVER.test("Provjera AI-ja")).toBe(true);
  });

  it("put „nije dokaz autorstva” next to the share line and the grade in Merlin and Studomat in the header", () => {
    expect(reviewMessages.notProof).toBe("nije dokaz autorstva");
    expect(matchText.notProof).toBe("nije dokaz autorstva");
    expect(reviewMessages.gradeExternal).toBe("Ocjenu upisujete u Merlin i Studomat.");
    // NF5-Q4: the review adds no text about the input rhythm.
    expect(Object.keys(reviewMessages).filter((key) => /rhythm/i.test(key))).toEqual([]);
  });
});
