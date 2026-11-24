import { describe, expect, it } from "vitest";
import { noticeLines, wordsText } from "./notice-preview";

const base = { versionNo: 2, dueAt: "2026-11-08T22:59:00.000Z", aiPolicy: "partially_allowed", aiPurposes: ["summarising", "unknown"], importAllowed: false, wordMin: 800, wordMax: 1200 } as const;

describe("notice preview", () => {
  it("lists the fields in a fixed order, deadline in Zagreb time", () => {
    const l = noticeLines(base);
    expect(l.map((x) => x.label)).toEqual(["Rok", "Alati", "Opseg", "Uvoz teksta", "Verzija obavijesti"]);
    expect(l[0]!.value).toBe("8. 11. 2026. u 23:59");
    expect(l[1]!.value).toBe("Asistent je dopušten za: sažimanje");
    expect(l[2]!.value).toBe("800–1200 riječi");
    expect(l[3]!.value).toBe("nije dopušten");
  });
  it("says no assistant when prohibited or no known purpose", () => {
    expect(noticeLines({ ...base, aiPolicy: "prohibited" })[1]!.value).toBe("Asistent nije dopušten");
    expect(noticeLines({ ...base, aiPurposes: ["unknown"] })[1]!.value).toBe("Asistent nije dopušten");
  });
  it("words text covers open ends", () => {
    expect(wordsText(null, null)).toBe("bez ograničenja");
    expect(wordsText(500, null)).toBe("najmanje 500 riječi");
    expect(wordsText(null, 900)).toBe("najviše 900 riječi");
  });
  it("names no AI provider or model and uses no forbidden term", () => {
    const all = JSON.stringify(noticeLines(base));
    expect(all).not.toMatch(/plagijat|varanje|sumnjiv|provjera AI/i);
  });
});
