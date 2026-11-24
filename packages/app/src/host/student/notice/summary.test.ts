import { describe, expect, it } from "vitest";

import { summaryText } from "./messages.hr";
import { summaryLines } from "./summary";

const view = { dueAt: "2099-12-15T22:59:00.000Z", wordMin: 1500, wordMax: 3000, aiPurposes: ["proofreading", "formatting"] };
const time = (iso: string) => `T(${iso.slice(0, 10)})`;

describe("P-8 summary", () => {
  it("is five lines: deadline, length, allowed, recorded, not a consent", () => {
    const lines = summaryLines(view, time);
    expect(lines).toHaveLength(5);
    expect(lines[0]).toBe("Rok: T(2099-12-15)");
    expect(lines[1]).toMatch(/^Opseg: 1.?500–3.?000 riječi$/);
    expect(lines[2]).toBe("Dopušteno: lektoriranje i jezična provjera, formatiranje.");
    expect(lines[3]).toBe(summaryText.recorded);
    expect(lines[4]).toMatch(/^Potvrda nije privola\./);
  });
  it("says so when no length or no purpose is given, and skips a purpose it does not know", () => {
    const lines = summaryLines({ ...view, wordMin: null, wordMax: null, aiPurposes: [] }, time);
    expect(lines[1]).toBe(summaryText.lengthNone);
    expect(lines[2]).toBe(summaryText.allowedNone);
    expect(summaryLines({ ...view, aiPurposes: ["grade_it", "translation"] }, time)[2]).toBe("Dopušteno: prevođenje.");
    expect(summaryLines({ ...view, aiPurposes: ["grade_it"] }, time)[2]).toBe(summaryText.allowedNone);
  });
  it("keeps clear of the forbidden vocabulary and of any provider name", () => {
    const all = JSON.stringify(summaryText).toLowerCase();
    for (const word of ["plagijat", "varanje", "sumnjiv", "openai", "gpt", "claude", "gemini"]) expect(all).not.toContain(word);
  });
});
