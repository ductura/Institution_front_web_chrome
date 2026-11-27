// ED-113: the defence outline, from invented facts only.
import { describe, expect, it } from "vitest";

import { findForbiddenTerms } from "../../../../../../scripts/forbidden-terms/terms.ts";

import { defenseText, parseDefense } from "./defense-model";
import { mentorCardHr } from "./messages.hr";

const t = mentorCardHr.defense;

describe("ED-113 Kostur za obranu", () => {
  it("numbers the title, the question, each chapter's first sentence and the parts left to the student", () => {
    const text = defenseText({
      title: "Kišni vrtovi u izmišljenom gradu",
      question: "Smanjuju li kišni vrtovi otjecanje?",
      chapters: [
        { title: "Uvod", firstParagraph: "Grad je izmišljen. Vrtovi su mali." },
        { title: "Metoda", firstParagraph: null },
        { title: "Zaključak", firstParagraph: "Vrtovi zadržavaju vodu. Trošak je nizak. Treća rečenica ne ulazi." },
      ],
      hypotheses: ["H1", "H2"],
    });
    expect(text).toBe([
      `1. ${t.titleRow}\n   Kišni vrtovi u izmišljenom gradu`,
      `2. ${t.question}\n   Smanjuju li kišni vrtovi otjecanje?`,
      "3. Uvod\n   Grad je izmišljen.",
      `4. Metoda\n   ${t.noText}`,
      "5. Zaključak\n   Vrtovi zadržavaju vodu. Trošak je nizak.",
      `6. ${t.hypotheses}\n   H1, H2: ${t.hypothesesAsk}`,
      `7. ${t.limits}\n   ${t.fillIn}`,
      `8. ${t.thanks}`,
    ].join("\n\n"));
  });

  it("asks for what the work does not hold yet instead of writing it", () => {
    const text = defenseText({ title: null, question: "", chapters: [], hypotheses: [] });
    expect(text).toBe([
      `1. ${t.titleRow}\n   ${t.noTitle}`,
      `2. ${t.question}\n   ${t.noQuestion}`,
      `3. ${t.limits}\n   ${t.fillIn}`,
      `4. ${t.thanks}`,
    ].join("\n\n"));
  });

  it("reads back only a saved string", () => {
    expect(parseDefense("1. Naslov")).toBe("1. Naslov");
    expect(parseDefense(3)).toBeNull();
    expect(parseDefense(null)).toBeNull();
  });

  it("has no forbidden terms in its texts", () => {
    expect(findForbiddenTerms(Object.values(t).join("\n"), "hr")).toEqual([]);
  });
});
